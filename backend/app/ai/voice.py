"""Text to speech for /speak (CLAUDE.md sections 3 and 12): ElevenLabs first, Amazon Polly
as the fallback, then text only (the caller shows the text either way).

Never raises. Each ElevenLabs call is one attempt with an 8 s timeout. Errors log their type
or HTTP status only: never the text, never the key. Clips are cached in memory (never on
disk) so replays and the Maya demo don't spend credits twice.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv

from app.ai import polly
from app.ai.plain_text import plain_text
from app.models import Language

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger("dental_time_machine.voice")

VoiceName = Literal["elevenlabs", "polly"]

API_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128"
TIMEOUT_S = 8.0
DEFAULT_MODEL = "eleven_flash_v2_5"
VOICE_SETTINGS = {"stability": 0.5, "similarity_boost": 0.75}
MAX_CACHED_CLIPS = 200
# A long Summary clip can be several hundred KB, so the cache also has a size cap.
MAX_CACHED_BYTES = 50 * 1024 * 1024

# A short, natural pause between sentences. Only ElevenLabs gets it: Polly would read the tag out.
_BREAK = '<break time="0.4s" />'
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=\S)")


def with_breaks(text: str) -> str:
    """The text with a short break at each sentence boundary, otherwise unchanged."""
    return _SENTENCE_END.sub(f" {_BREAK} ", text.strip())


# What the log may show about the settings: never the key, only whether the others look right.
_LOOKS_LIKE_ID = re.compile(r"^[A-Za-z0-9]{10,40}$")
_SAFE_TOKEN = re.compile(r"^[a-z0-9_]{1,40}$")


def _setting(name: str) -> str:
    """A setting as it may have been pasted into a hosting dashboard, tidied: surrounding
    spaces and quotes and an accidental leading "NAME=" are removed. Locally, .env does this."""
    value = os.getenv(name, "").strip()
    if value.startswith(f"{name}="):
        value = value[len(name) + 1 :].strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1].strip()
    return value


def _settings() -> tuple[str, str, str] | None:
    """(key, voice id, model id), or None when ElevenLabs isn't set up."""
    key = _setting("ELEVENLABS_API_KEY")
    voice_id = _setting("ELEVENLABS_VOICE_ID")
    if not key or not voice_id:
        return None
    return key, voice_id, _setting("ELEVENLABS_MODEL_ID") or DEFAULT_MODEL


def _why(response: httpx.Response, voice_id: str, model: str) -> str:
    """ElevenLabs' short reason code (like "invalid_uid") and the shape of the settings, for the
    log. Its free-text message isn't kept: it can echo what was sent."""
    try:
        detail = response.json().get("detail")
        reason = detail.get("status", "") if isinstance(detail, dict) else ""
    except Exception:  # noqa: BLE001 - no JSON body: no reason to show
        reason = ""
    reason = reason if _SAFE_TOKEN.match(reason or "") else "no reason given"
    shape = "looks like an id" if _LOOKS_LIKE_ID.match(voice_id) else "not an id"
    model_text = model if _SAFE_TOKEN.match(model) else f"that doesn't look right ({len(model)} chars)"
    return f"{reason}; voice id {len(voice_id)} chars, {shape}; model {model_text}"


def speak_elevenlabs(text: str, language: Language) -> bytes | None:
    """MP3 audio from ElevenLabs, or None on a missing key, any error, a timeout or empty audio."""
    settings = _settings()
    if settings is None:
        return None
    key, voice_id, model = settings
    try:
        response = httpx.post(
            API_URL.format(voice_id=voice_id),
            headers={"xi-api-key": key, "accept": "audio/mpeg"},
            json={
                "text": with_breaks(plain_text(text) or text),
                "model_id": model,
                "language_code": language,
                "voice_settings": VOICE_SETTINGS,
            },
            timeout=TIMEOUT_S,
        )
    except Exception as exc:  # noqa: BLE001 - every failure means "try Polly"
        logger.warning("ElevenLabs call failed: %s", type(exc).__name__)
        return None
    if response.status_code != 200:
        logger.warning("ElevenLabs call failed: HTTP %d (%s)", response.status_code, _why(response, voice_id, model))
        return None
    return response.content or None


class AudioCache:
    """Least recently used clips, capped by count and total size. Memory only; thread-safe."""

    def __init__(self, max_items: int = MAX_CACHED_CLIPS, max_bytes: int = MAX_CACHED_BYTES) -> None:
        self.max_items, self.max_bytes = max_items, max_bytes
        self._clips: OrderedDict[str, bytes] = OrderedDict()
        self._size = 0
        self._lock = threading.Lock()

    def get(self, key: str) -> bytes | None:
        with self._lock:
            audio = self._clips.get(key)
            if audio is not None:
                self._clips.move_to_end(key)
            return audio

    def put(self, key: str, audio: bytes) -> None:
        if len(audio) > self.max_bytes:
            return
        with self._lock:
            old = self._clips.pop(key, None)
            if old is not None:
                self._size -= len(old)
            self._clips[key] = audio
            self._size += len(audio)
            while len(self._clips) > self.max_items or self._size > self.max_bytes:
                _, dropped = self._clips.popitem(last=False)
                self._size -= len(dropped)

    def clear(self) -> None:
        with self._lock:
            self._clips.clear()
            self._size = 0


_cache = AudioCache()


def clear_cache() -> None:
    _cache.clear()


def _cache_key(provider: VoiceName, voice: str, language: Language, text: str) -> str:
    return hashlib.sha256("\0".join((provider, voice, language, text)).encode()).hexdigest()


def speak(text: str, language: Language) -> tuple[bytes, VoiceName] | None:
    """Audio for the text and which voice made it: ElevenLabs, else Polly, else None.

    ElevenLabs is tried again on every miss (a failure is never cached), so a short outage
    doesn't leave replays on Polly.
    """
    settings = _settings()
    if settings is not None:
        _, voice_id, model = settings
        key = _cache_key("elevenlabs", f"{voice_id}/{model}", language, text)
        audio = _cache.get(key) or speak_elevenlabs(text, language)
        if audio:
            _cache.put(key, audio)
            return audio, "elevenlabs"

    key = _cache_key("polly", polly.VOICES[language], language, text)
    audio = _cache.get(key) or polly.synthesize(text, language)
    if audio:
        _cache.put(key, audio)
        return audio, "polly"
    return None
