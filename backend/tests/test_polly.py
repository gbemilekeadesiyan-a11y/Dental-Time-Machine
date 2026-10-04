"""Polly helper tests. AWS is never called: the client is replaced with a fake."""

from __future__ import annotations

import io
import logging
from typing import Any

import pytest
from botocore.exceptions import ClientError, ReadTimeoutError

from app.ai import polly

SECRET_TEXT = "my private dental history"


class FakePolly:
    def __init__(self, audio: bytes = b"ID3fake-mp3", error: Exception | None = None) -> None:
        self.audio = audio
        self.error = error
        self.kwargs: dict[str, Any] = {}

    def synthesize_speech(self, **kwargs: Any) -> dict[str, Any]:
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return {"AudioStream": io.BytesIO(self.audio)}


@pytest.fixture
def use_client(monkeypatch: pytest.MonkeyPatch):
    def install(client: FakePolly) -> FakePolly:
        monkeypatch.setattr(polly, "_client", lambda: client)
        return client

    return install


@pytest.mark.parametrize("language", ["en", "es", "fr", "pt"])
def test_each_language_has_a_neural_voice(use_client, language: str) -> None:
    client = use_client(FakePolly())
    assert polly.synthesize("Hello", language) == b"ID3fake-mp3"  # type: ignore[arg-type]
    assert client.kwargs["VoiceId"] == polly.VOICES[language]
    assert client.kwargs["Engine"] == "neural"
    assert client.kwargs["OutputFormat"] == "mp3"
    assert client.kwargs["Text"] == "Hello"


@pytest.mark.parametrize(
    "error",
    [
        ClientError({"Error": {"Code": "AccessDeniedException", "Message": "nope"}}, "SynthesizeSpeech"),
        ReadTimeoutError(endpoint_url="https://polly"),
        RuntimeError("anything"),
    ],
)
def test_returns_none_on_any_error(use_client, error: Exception) -> None:
    use_client(FakePolly(error=error))
    assert polly.synthesize("Hello", "en") is None


def test_returns_none_on_empty_audio(use_client) -> None:
    use_client(FakePolly(audio=b""))
    assert polly.synthesize("Hello", "en") is None


def test_errors_never_log_text(use_client, caplog: pytest.LogCaptureFixture) -> None:
    use_client(FakePolly(error=RuntimeError(SECRET_TEXT)))
    with caplog.at_level(logging.DEBUG):
        polly.synthesize(SECRET_TEXT, "en")
    assert "RuntimeError" in caplog.text
    assert SECRET_TEXT not in caplog.text
