"""Hosting settings (feature/chat): which frontends may call the API (CORS)."""

from __future__ import annotations

import pytest

from app.main import LOCAL_FRONTEND, frontend_origins


@pytest.mark.parametrize("value", [None, "", "   ", " , "])
def test_local_frontend_when_unset(value: str | None) -> None:
    assert frontend_origins(value) == [LOCAL_FRONTEND]


def test_hosted_frontends_from_a_comma_separated_list() -> None:
    value = " https://dental-time-machine.vercel.app/ ,https://example.com"
    assert frontend_origins(value) == ["https://dental-time-machine.vercel.app", "https://example.com"]


def test_wildcard_is_ignored() -> None:
    # "*" would let any site call the API; it falls back to the local frontend instead.
    assert frontend_origins("*") == [LOCAL_FRONTEND]
