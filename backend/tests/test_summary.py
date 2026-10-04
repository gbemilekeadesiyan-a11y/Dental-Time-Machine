"""POST /summary and POST /speak tests. AWS is replaced with fakes: no calls, no cost.

Summary rules (CLAUDE.md sections 2, 10 and 12): figures come only from the engine
(recomputed on the server, never trusted from the request), the dollar guard checks the
text, wording stays conditional, and the reset wording and disclaimer always end the text.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import sockets
from app.ai import bedrock, polly
from app.demo_data import maya_plan, maya_procedures
from app.main import app
from app.models import SummaryRequest
from app.optimizer import optimize


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class FakeBedrock:
    def __init__(self, *replies: str | None) -> None:
        self.replies = list(replies)
        self.calls: list[dict[str, Any]] = []

    def __call__(self, system: str, messages: list[dict[str, Any]], **kwargs: Any) -> str | None:
        self.calls.append({"system": system, "messages": messages})
        return self.replies.pop(0) if self.replies else None


@pytest.fixture
def llm(monkeypatch: pytest.MonkeyPatch):
    def install(*replies: str | None) -> FakeBedrock:
        fake = FakeBedrock(*replies)
        monkeypatch.setattr(bedrock, "call", fake)
        return fake

    return install


def summary_body(*can_wait: str, language: str = "en", style: str = "simple", **schedule: str) -> dict[str, Any]:
    procedures = [p.model_copy(update={"can_wait": True}) if p.id in can_wait else p for p in maya_procedures()]
    result = optimize(procedures, maya_plan())
    return {
        "procedures": [p.model_dump(mode="json") for p in procedures],
        "plan": maya_plan().model_dump(mode="json"),
        "schedule": schedule or result.best_schedule,
        "optimize": result.model_dump(mode="json"),
        "preferences": {"language": language, "style": style, "voice_on": False},
    }


def post_summary(client: TestClient, payload: dict[str, Any]) -> str:
    response = client.post("/summary", json=payload)
    assert response.status_code == 200, response.text
    return response.json()["text"]


GOOD_EN = (
    "If your dentist confirms Crown 2 can wait until your plan year resets, "
    "you'd likely pay $1,975 instead of $2,500, about $525 less."
)


# ---------- /summary ----------


def test_aws_failure_uses_fake_summary(client: TestClient, llm) -> None:
    llm(None)
    payload = summary_body("crown1", "crown2")
    assert post_summary(client, payload) == sockets.summary(SummaryRequest(**payload))


def test_good_summary_gets_reset_and_disclaimer(client: TestClient, llm) -> None:
    llm(GOOD_EN)
    text = post_summary(client, summary_body("crown1", "crown2"))
    assert text == f"{GOOD_EN} {sockets.RESET_TEXT['en']} {sockets.DISCLAIMERS['en']}"


def test_spanish_summary_passes_guard(client: TestClient, llm) -> None:
    spanish = "Si tu dentista confirma que la Corona 2 puede esperar, probablemente pagarías 1.975 $ en vez de 2.500 $."
    llm(spanish)
    text = post_summary(client, summary_body("crown1", "crown2", language="es"))
    assert text.startswith(spanish)
    assert text.endswith(sockets.DISCLAIMERS["es"])


def test_invented_figure_regenerates_once(client: TestClient, llm) -> None:
    fake = llm("You'd likely pay $1,234.", GOOD_EN)
    assert post_summary(client, summary_body("crown1", "crown2")).startswith(GOOD_EN)
    assert len(fake.calls) == 2


def test_invented_figure_twice_falls_back(client: TestClient, llm) -> None:
    llm("You'd likely pay $1,234.", "Pagarías 999 dólares.")
    payload = summary_body("crown1", "crown2")
    assert post_summary(client, payload) == sockets.summary(SummaryRequest(**payload))


@pytest.mark.parametrize(
    "bad",
    [
        "You should wait on Crown 2 and pay $1,975.",
        "Deberías esperar con la Corona 2.",
        "When your plan year resets you get a second annual maximum of $1,500.",
    ],
)
def test_unsafe_wording_is_rejected(client: TestClient, llm, bad: str) -> None:
    fake = llm(bad, bad)
    payload = summary_body("crown1", "crown2")
    assert post_summary(client, payload) == sockets.summary(SummaryRequest(**payload))
    assert len(fake.calls) == 2


@pytest.mark.parametrize(
    "bad",
    [
        "If your dentist confirms Crown 2 can wait, you'd likely pay $1,975 this year.",
        "Si tu dentista confirma que la Corona 2 puede esperar, pagarías $1,975 este año.",
        "Vous paieriez $1,975 cette année.",
        "Você pagaria $1,975 este ano.",
    ],
)
def test_two_year_total_called_this_year_is_rejected(client: TestClient, llm, bad: str) -> None:
    # Section 9: $1,975 covers both plan years once crown 2 moves.
    fake = llm(bad, bad)
    payload = summary_body("crown1", "crown2")
    assert post_summary(client, payload) == sockets.summary(SummaryRequest(**payload))
    assert len(fake.calls) == 2


def test_all_now_total_may_be_called_this_year(client: TestClient, llm) -> None:
    # With nothing moved, the total really is this plan year's.
    llm("Getting everything now, you'd likely pay $2,500 this year.")
    text = post_summary(client, summary_body())
    assert text.startswith("Getting everything now, you'd likely pay $2,500 this year.")


def test_tampered_figures_in_request_are_ignored(client: TestClient, llm) -> None:
    # A client can't smuggle a figure in through the optimize field: the server recomputes it.
    payload = summary_body("crown1", "crown2")
    payload["optimize"]["best"]["totals"]["you_pay"] = 999
    payload["optimize"]["savings"] = 1501
    llm("If your dentist confirms Crown 2 can wait, you'd likely pay $999, saving $1,501.", None)
    text = post_summary(client, payload)
    assert "$999" not in text and "$1,501" not in text
    assert "$1,975" in text and "$525" in text


def test_prompt_has_engine_facts_and_language(client: TestClient, llm) -> None:
    fake = llm(GOOD_EN)
    post_summary(client, summary_body("crown1", "crown2", language="pt", style="detailed"))
    system = fake.calls[0]["system"]
    for figure in ("$2,500", "$1,975", "$525"):
        assert figure in system
    assert "Portuguese" in system
    assert "Crown 2" in system


def test_chosen_schedule_figures_are_allowed(client: TestClient, llm) -> None:
    # The user's own timeline (all now) is a valid engine result to mention.
    llm("With your timing you'd likely pay $2,500.")
    text = post_summary(client, summary_body("crown1", "crown2", crown2="this_year"))
    assert text.startswith("With your timing you'd likely pay $2,500.")


def test_invalid_schedule_is_422(client: TestClient, llm) -> None:
    llm(GOOD_EN)
    payload = summary_body(root_canal="next_year")  # Locked procedure moved.
    response = client.post("/summary", json=payload)
    assert response.status_code == 422
    assert "locked" in response.json()["detail"]


# ---------- /speak ----------


@pytest.fixture
def voice(monkeypatch: pytest.MonkeyPatch):
    calls: list[tuple[str, str]] = []

    def install(audio: bytes | None):
        def fake(text: str, language: str) -> bytes | None:
            calls.append((text, language))
            return audio

        monkeypatch.setattr(polly, "synthesize", fake)
        return calls

    return install


def test_speak_returns_mp3(client: TestClient, voice) -> None:
    calls = voice(b"ID3fake-mp3")
    response = client.post("/speak", json={"text": "Hola", "language": "es"})
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.headers["cache-control"] == "no-store"
    assert response.content == b"ID3fake-mp3"
    assert calls == [("Hola", "es")]


def test_speak_unavailable_is_503_with_plain_message(client: TestClient, voice) -> None:
    voice(None)
    response = client.post("/speak", json={"text": "Hello", "language": "en"})
    assert response.status_code == 503
    assert "text" in response.json()["detail"].lower()


@pytest.mark.parametrize(
    "payload",
    [
        {"text": "", "language": "en"},
        {"text": "x" * 2001, "language": "en"},
        {"text": "Hello", "language": "de"},
        {"text": "Hello"},
    ],
)
def test_speak_bad_input_is_422(client: TestClient, voice, payload: dict[str, Any]) -> None:
    voice(b"ID3")
    assert client.post("/speak", json=payload).status_code == 422
