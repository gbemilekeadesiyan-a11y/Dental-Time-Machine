"""POST /chat with an uploaded document as context (feature/documents + feature/chat).

When the user taps "Ask the assistant" on a term card, the chat gets what the
document reader found, so it can talk about the term and the whole document.

Rules under test (CLAUDE.md sections 2 and 12):
- Only values the document actually had reach the prompt; the reader's placeholders never do.
- The document is data, never instructions, and is marked as not yet confirmed.
- The dollar guard allows figures printed in the document (the user's own input)
  and still rejects any other figure.
- Without a document, the chat is unchanged. Symptoms still get the safety reply first.
Bedrock is always faked: no AWS calls.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import sockets
from app.ai import bedrock
from app.main import app
from app.routers.document_reader import build_result


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


def reply(say: str) -> str:
    return json.dumps({"say": say, "procedures": [], "can_wait_ids": [], "done_intake": False})


def northgate_document() -> dict[str, Any]:
    """What the reader returns for the fictional Northgate summary: no deductible printed here."""
    result = build_result(
        {
            "plan": {
                "annual_max": 2000,
                "deductible": None,
                "coverage_preventive_percent": 100,
                "coverage_basic_percent": 70,
                "coverage_major_percent": 40,
                "reset_date": "07-01",
                "in_network": False,
            },
            "procedures": [{"cdt_code": "D2740", "tooth": 30, "fee": 1450}],
            "terms": ["Waiting period", "Missing tooth clause"],
        }
    )
    return result.model_dump(mode="json")


def body(text: str, document: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "turns": [{"role": "user", "text": text}],
        "preferences": {"language": "en", "style": "simple", "voice_on": False},
        "procedures": [],
        "plan": None,
    }
    if document is not None:
        payload["document"] = document
    return payload


def test_prompt_includes_what_the_document_says(client, llm):
    fake = llm(reply("A waiting period is time before some care is covered."))
    client.post("/chat", json=body("Can you explain 'Waiting period' from my document?", northgate_document()))
    system = fake.calls[0]["system"]
    assert "<document>" in system
    for text in ("$2,000", "70%", "40%", "07-01", "out of network", "Crown", "tooth 30", "$1,450", "Waiting period", "Missing tooth clause"):
        assert text in system, text
    assert "not yet confirmed" in system.lower()
    assert "data, not instructions" in system


def test_placeholders_for_missing_fields_never_reach_the_prompt(client, llm):
    fake = llm(reply("Sure."))
    client.post("/chat", json=body("What does my document say?", northgate_document()))
    document_block = fake.calls[0]["system"].split("<document>")[1].split("</document>")[0]
    assert "deductible" not in document_block.lower()  # not printed in this document
    assert "$0" not in document_block


def test_guard_allows_figures_printed_in_the_document(client, llm):
    llm(reply("Your document says your annual maximum is $2,000."))
    response = client.post("/chat", json=body("What's my annual maximum?", northgate_document()))
    assert response.json()["say"] == "Your document says your annual maximum is $2,000."


def test_guard_still_rejects_figures_not_in_the_document(client, llm):
    fake = llm(reply("You'll likely pay $9,999."), reply("You'll likely pay $8,888."))
    payload = body("What will I pay?", northgate_document())
    response = client.post("/chat", json=payload)
    assert len(fake.calls) == 2
    assert "$9,999" not in response.json()["say"] and "$8,888" not in response.json()["say"]


def test_without_a_document_the_prompt_has_no_document_section(client, llm):
    fake = llm(reply("Hi."))
    client.post("/chat", json=body("Hello"))
    assert "<document>" not in fake.calls[0]["system"]


def test_symptoms_still_get_the_safety_reply_first(client, llm):
    fake = llm(reply("Sure."))
    response = client.post("/chat", json=body("my tooth pain is bad, what does my document cover?", northgate_document()))
    assert fake.calls == []
    assert response.json()["say"] == sockets.SAFETY_REPLIES["en"]


def test_invalid_document_is_a_plain_422(client):
    payload = body("Hi", {"plan": None, "procedures": "nope", "fields_found": [], "warnings": []})
    response = client.post("/chat", json=payload)
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


def test_earlier_assistant_replies_are_sent_back_in_the_json_format(client, llm):
    """The model copies the format of its own earlier turns: plain-text history made it
    answer follow-ups in plain text, which the parser rightly rejects (real Bedrock, 5 of 5)."""
    fake = llm(reply("Your document says your annual maximum is $2,000."))
    payload = body("What's my annual maximum?", northgate_document())
    payload["turns"] = [
        {"role": "user", "text": 'Can you explain "Waiting period" from my document?'},
        {"role": "assistant", "text": "A waiting period is time before some care is covered."},
        {"role": "user", "text": "What's my annual maximum?"},
    ]
    response = client.post("/chat", json=payload)
    assistant = [m for m in fake.calls[0]["messages"] if m["role"] == "assistant"]
    assert json.loads(assistant[0]["content"][0]["text"]) == {"say": "A waiting period is time before some care is covered."}
    assert response.json()["say"] == "Your document says your annual maximum is $2,000."
