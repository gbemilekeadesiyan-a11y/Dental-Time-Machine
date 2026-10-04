"""Amazon Polly text-to-speech (CLAUDE.md section 3), for /speak. Malama owns.

synthesize() never raises: on any AWS error, timeout or empty audio it returns None and
the frontend keeps showing the text. Text is never logged; errors log their type only.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

import boto3

from app.ai.bedrock import client_config
from app.ai.plain_text import plain_text
from app.models import Language

logger = logging.getLogger("dental_time_machine.polly")

# One neural voice per language: US English, US Spanish, French, Brazilian Portuguese.
VOICES: dict[Language, str] = {"en": "Joanna", "es": "Lupe", "fr": "Lea", "pt": "Camila"}


@lru_cache(maxsize=1)
def _client() -> Any:
    return boto3.client("polly", config=client_config())


def synthesize(text: str, language: Language) -> bytes | None:
    """MP3 audio of the text in the language's voice, or None if anything goes wrong."""
    try:
        response = _client().synthesize_speech(
            Text=plain_text(text) or text, VoiceId=VOICES[language], Engine="neural", OutputFormat="mp3"
        )
        audio = response["AudioStream"].read()
    except Exception as exc:  # noqa: BLE001 - every failure means "show the text only"
        logger.warning("Polly call failed: %s", type(exc).__name__)
        return None
    return audio or None
