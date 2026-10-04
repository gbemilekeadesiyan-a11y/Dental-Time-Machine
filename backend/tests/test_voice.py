"""Text to speech: ElevenLabs first, then Polly, then text only (CLAUDE.md sections 3 and 12).

httpx and Polly are replaced with fakes: no real API calls, no cost.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.ai import polly, voice
from app.main import app
from app.routers.chat import VOICE_UNAVAILABLE

KEY = "sk_test_secret_key_that_must_never_leak_0123456789ab"
VOICE_ID = "TestVoice123"
SAID = "Your plan likely pays $1,500. You'd likely pay $2,500."


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class FakeHttp:
    """Stands in for httpx.post: answers with a status and body, or raises."""

    def __init__(self, status: int = 200, content: bytes = b"ID3eleven-audio", error: Exception | None = None) -> None:
        self.status, self.content, self.error = status, content, error
        self.calls: list[dict[str, Any]] = []

    def __call__(self, url: str, **kwargs: Any) -> httpx.Response:
        self.calls.append({"url": url, **kwargs})
        if self.error:
            raise self.error
        return httpx.Response(self.status, content=self.content, request=httpx.Request("POST", url))


@pytest.fixture
def eleven(monkeypatch):
    """Sets the ElevenLabs key and voice and installs a fake HTTP call."""

    def install(fake: FakeHttp | None = None, key: str | None = KEY, voice_id: str | None = VOICE_ID) -> FakeHttp:
        fake = fake or FakeHttp()
        if key is not None:
            monkeypatch.setenv("ELEVENLABS_API_KEY", key)
        if voice_id is not None:
            monkeypatch.setenv("ELEVENLABS_VOICE_ID", voice_id)
        monkeypatch.setattr(voice.httpx, "post", fake)
        return fake

    return install


@pytest.fixture
def polly_says(monkeypatch):
    """Replaces Polly: returns audio, or None when unavailable. Records the text it got."""

    def install(audio: bytes | None = b"ID3polly-audio") -> list[str]:
        heard: list[str] = []

        def fake(text: str, language: str) -> bytes | None:
            heard.append(text)
            return audio

        monkeypatch.setattr(polly, "synthesize", fake)
        return heard

    return install


def speak(client: TestClient, text: str = SAID, language: str = "en") -> httpx.Response:
    return client.post("/speak", json={"text": text, "language": language})


# ---------- ElevenLabs first ----------


def test_uses_elevenlabs_when_the_key_is_set(client: TestClient, eleven, polly_says) -> None:
    fake = eleven()
    heard = polly_says()
    response = speak(client, language="es")
    assert response.status_code == 200
    assert response.content == b"ID3eleven-audio"
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.headers["x-voice"] == "elevenlabs"
    assert heard == []  # Polly wasn't needed.

    call = fake.calls[0]
    assert call["url"] == f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128"
    assert call["headers"]["xi-api-key"] == KEY
    assert call["timeout"] == 8.0
    body = call["json"]
    assert body["model_id"] == "eleven_flash_v2_5"
    assert body["language_code"] == "es"
    assert body["voice_settings"] == {"stability": 0.5, "similarity_boost": 0.75}


def test_model_id_comes_from_the_environment(client: TestClient, eleven, polly_says, monkeypatch) -> None:
    fake = eleven()
    monkeypatch.setenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
    polly_says()
    speak(client)
    assert fake.calls[0]["json"]["model_id"] == "eleven_multilingual_v2"


def test_sentences_get_a_short_break_for_elevenlabs_only(client: TestClient, eleven, polly_says) -> None:
    fake = eleven()
    polly_says()
    speak(client)
    assert fake.calls[0]["json"]["text"] == 'Your plan likely pays $1,500. <break time="0.4s" /> You\'d likely pay $2,500.'

    # Polly gets the text without break tags (it would read them out).
    voice.clear_cache()
    eleven(FakeHttp(status=503))
    heard = polly_says()
    speak(client)
    assert heard == [SAID]


def test_with_breaks_keeps_the_text_otherwise_unchanged() -> None:
    assert voice.with_breaks("One sentence only.") == "One sentence only."
    assert voice.with_breaks("Is it covered? Yes! Good.") == (
        'Is it covered? <break time="0.4s" /> Yes! <break time="0.4s" /> Good.'
    )
    assert voice.with_breaks("You'd pay $1,975.50 in total.") == "You'd pay $1,975.50 in total."


# ---------- falling back to Polly ----------


@pytest.mark.parametrize(
    "fake",
    [
        FakeHttp(error=httpx.ReadTimeout("timed out")),
        FakeHttp(error=httpx.ConnectError("no network")),
        FakeHttp(status=401),
        FakeHttp(status=429),
        FakeHttp(status=500),
        FakeHttp(status=200, content=b""),
    ],
    ids=["timeout", "network", "401", "429", "500", "empty audio"],
)
def test_falls_back_to_polly(client: TestClient, eleven, polly_says, fake: FakeHttp) -> None:
    eleven(fake)
    polly_says()
    response = speak(client)
    assert response.status_code == 200
    assert response.content == b"ID3polly-audio"
    assert response.headers["x-voice"] == "polly"
    assert len(fake.calls) == 1  # One attempt only.


@pytest.mark.parametrize(("key", "voice_id"), [(None, VOICE_ID), ("", VOICE_ID), ("   ", VOICE_ID), (KEY, None)])
def test_falls_back_when_not_configured(client: TestClient, eleven, polly_says, key, voice_id) -> None:
    fake = eleven(key=key, voice_id=voice_id)
    polly_says()
    response = speak(client)
    assert response.headers["x-voice"] == "polly"
    assert fake.calls == []  # Never called without a key and a voice.


def test_both_voices_down_is_the_same_503(client: TestClient, eleven, polly_says) -> None:
    eleven(FakeHttp(status=429))
    polly_says(None)
    response = speak(client)
    assert response.status_code == 503
    assert response.json() == {"detail": VOICE_UNAVAILABLE}


def test_key_is_trimmed(client: TestClient, eleven, polly_says) -> None:
    fake = eleven(key=f"  {KEY}\r\n")
    polly_says()
    speak(client)
    assert fake.calls[0]["headers"]["xi-api-key"] == KEY


# ---------- cache ----------


def test_cache_hit_does_not_call_the_api_again(client: TestClient, eleven, polly_says) -> None:
    fake = eleven()
    polly_says()
    first, second = speak(client), speak(client)
    assert first.content == second.content == b"ID3eleven-audio"
    assert second.headers["x-voice"] == "elevenlabs"
    assert len(fake.calls) == 1
    speak(client, language="es")  # A different language is a different clip.
    assert len(fake.calls) == 2


def test_failures_are_not_cached_and_elevenlabs_is_tried_again(client: TestClient, eleven, polly_says) -> None:
    eleven(FakeHttp(status=429))
    polly_says()
    assert speak(client).headers["x-voice"] == "polly"
    fake = eleven(FakeHttp())  # ElevenLabs is back.
    assert speak(client).headers["x-voice"] == "elevenlabs"
    assert len(fake.calls) == 1


def test_polly_clips_are_cached_too(client: TestClient, polly_says) -> None:
    heard = polly_says()
    speak(client)
    speak(client)
    assert len(heard) == 1


def test_cache_drops_the_oldest_beyond_its_limits() -> None:
    cache = voice.AudioCache(max_items=2, max_bytes=10)
    cache.put("a", b"1234")
    cache.put("b", b"1234")
    assert cache.get("a") == b"1234"  # "a" is now the most recent.
    cache.put("c", b"1234")  # Over 2 items: "b" goes.
    assert cache.get("b") is None
    assert cache.get("a") == b"1234" and cache.get("c") == b"1234"
    cache.put("d", b"12345678")  # Over 10 bytes: the oldest go until it fits.
    assert cache.get("a") is None and cache.get("c") is None
    assert cache.get("d") == b"12345678"
    cache.put("huge", b"x" * 11)  # Bigger than the whole cache: not kept.
    assert cache.get("huge") is None


def test_default_cache_limits() -> None:
    assert voice.MAX_CACHED_CLIPS == 200


# ---------- secrets ----------


def test_key_and_text_never_appear_in_logs_or_responses(client: TestClient, eleven, polly_says, caplog) -> None:
    caplog.set_level(logging.DEBUG)
    eleven(FakeHttp(status=401, content=b'{"detail": "invalid api key"}'))
    polly_says()
    response = speak(client)
    assert KEY not in caplog.text
    assert SAID not in caplog.text
    assert "401" in caplog.text  # The status helps debugging; it isn't secret.
    assert KEY not in response.text and KEY not in str(response.headers)


def test_error_log_has_the_type_only_for_network_errors(client: TestClient, eleven, polly_says, caplog) -> None:
    caplog.set_level(logging.WARNING)
    eleven(FakeHttp(error=httpx.ReadTimeout(f"timed out sending {SAID} with {KEY}")))
    polly_says()
    speak(client)
    assert "ReadTimeout" in caplog.text
    assert KEY not in caplog.text and SAID not in caplog.text


def test_x_voice_header_is_readable_by_the_browser(client: TestClient, polly_says) -> None:
    polly_says()
    response = client.post(
        "/speak", json={"text": "Hello", "language": "en"}, headers={"Origin": "http://localhost:5173"}
    )
    assert "x-voice" in response.headers.get("access-control-expose-headers", "").lower()
