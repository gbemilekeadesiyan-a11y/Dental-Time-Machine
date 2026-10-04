"""Shared test setup.

Tests never call AWS, even when backend/.env holds real keys: every Bedrock
entry point is replaced with one that fails, so routes use their fixed fallbacks.
Tests that need an AI answer patch in their own fake on top of this.
"""

from __future__ import annotations

import pytest

from app.routers import document_reader, term_explainer


@pytest.fixture(autouse=True)
def _no_aws(monkeypatch):
    def no_client():
        raise RuntimeError("Tests must not call AWS")

    monkeypatch.setattr(document_reader, "_client", no_client)
    monkeypatch.setattr(term_explainer, "_ask_bedrock", lambda term, language, style: None)
