"""Shared test setup.

Tests never call AWS or ElevenLabs, even when backend/.env holds real keys: every
Bedrock entry point is replaced with one that fails, so routes use their fixed fallbacks,
the ElevenLabs settings are removed and its HTTP call fails, and the voice cache starts
empty. Tests that need an AI answer or a voice patch in their own fake on top of this.
"""

from __future__ import annotations

import pytest

from app.ai import bedrock, voice
from app.routers import term_explainer


@pytest.fixture(autouse=True)
def _no_aws(monkeypatch):
    def no_client():
        raise RuntimeError("Tests must not call AWS")

    monkeypatch.setattr(bedrock, "_client", no_client)
    monkeypatch.setattr(term_explainer, "_ask_bedrock", lambda term, language, style: None)


@pytest.fixture(autouse=True)
def _no_elevenlabs(monkeypatch):
    for name in ("ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL_ID"):
        monkeypatch.delenv(name, raising=False)

    def no_call(*args, **kwargs):
        raise RuntimeError("Tests must not call ElevenLabs")

    monkeypatch.setattr(voice.httpx, "post", no_call)
    voice.clear_cache()
