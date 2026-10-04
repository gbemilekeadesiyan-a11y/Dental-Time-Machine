"""Tests for AI term explanations on POST /explain (feature/documents, CLAUDE.md section 12).

The route contract is unchanged: {term, language, style} -> {text}. The text is
AI-written when Bedrock works, always passes the dollar guard, and falls back to
the fixed glossary otherwise. Symptom questions never reach the AI.
Bedrock is always mocked here (see conftest.py).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import sockets
from app.main import app
from app.routers import term_explainer
from app.routers.term_explainer import explain_term

GOOD = "Your deductible is the part you pay first each plan year before your plan starts to share the cost."


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def fake_bedrock(*answers):
    """A stand-in for Bedrock that returns the given answers in order and records each call."""
    calls = []
    queue = list(answers)

    def ask(term, language, style):
        calls.append((term, language, style))
        return queue.pop(0) if queue else None

    return ask, calls


def test_ai_explanation_is_used_when_it_has_no_money(monkeypatch):
    ask, calls = fake_bedrock(GOOD)
    monkeypatch.setattr(term_explainer, "_ask_bedrock", ask)
    assert explain_term("deductible", "en", "simple") == GOOD
    assert calls == [("deductible", "en", "simple")]


def test_dollar_figure_is_regenerated_once_then_kept_if_clean(monkeypatch):
    ask, calls = fake_bedrock("Most people pay about $50 first.", GOOD)
    monkeypatch.setattr(term_explainer, "_ask_bedrock", ask)
    assert explain_term("deductible") == GOOD
    assert len(calls) == 2


@pytest.mark.parametrize("bad", ["You'll pay $1,500 at most.", "Le maximum est de 1.500 $.", "Son 1975 dólares."])
def test_dollar_figures_twice_fall_back_to_the_glossary(monkeypatch, bad):
    ask, calls = fake_bedrock(bad, bad)
    monkeypatch.setattr(term_explainer, "_ask_bedrock", ask)
    assert explain_term("annual maximum") == sockets.explain("annual maximum")
    assert len(calls) == 2


def test_percentages_are_allowed(monkeypatch):
    text = "With coinsurance, your plan pays a share, such as 80%, and you'll likely pay the rest."
    ask, _ = fake_bedrock(text)
    monkeypatch.setattr(term_explainer, "_ask_bedrock", ask)
    assert explain_term("coinsurance") == text


def test_aws_failure_uses_the_glossary_without_retry(monkeypatch):
    ask, calls = fake_bedrock()  # returns None: AWS unavailable
    monkeypatch.setattr(term_explainer, "_ask_bedrock", ask)
    assert explain_term("plan year") == sockets.explain("plan year")
    assert len(calls) == 1


@pytest.mark.parametrize("term", ["my tooth pain", "swollen gums", "toothache", "bleeding"])
def test_symptoms_get_the_safety_reply_and_never_reach_the_ai(monkeypatch, term):
    ask, calls = fake_bedrock(GOOD)
    monkeypatch.setattr(term_explainer, "_ask_bedrock", ask)
    assert explain_term(term) == sockets.SAFETY_REPLY
    assert calls == []


def test_unknown_terms_can_be_explained_by_the_ai(monkeypatch):
    text = "A frequency limitation means your plan only covers some care a set number of times."
    ask, _ = fake_bedrock(text)
    monkeypatch.setattr(term_explainer, "_ask_bedrock", ask)
    assert explain_term("frequency limitation") == text


def test_route_contract_is_unchanged(client, monkeypatch):
    ask, calls = fake_bedrock(GOOD)
    monkeypatch.setattr(term_explainer, "_ask_bedrock", ask)
    response = client.post("/explain", json={"term": "deductible", "language": "es", "style": "simple"})
    assert response.status_code == 200
    assert response.json() == {"text": GOOD}
    assert calls == [("deductible", "es", "simple")]


def test_route_falls_back_when_aws_is_down(client):
    # conftest.py makes Bedrock unavailable.
    response = client.post("/explain", json={"term": "deductible"})
    assert response.json()["text"] == sockets.explain("deductible")


# ---------- the Bedrock call itself (client mocked) ----------


class FakeClient:
    def __init__(self, reply=None, error=None):
        self.reply, self.error, self.sent = reply, error, {}

    def converse(self, **kwargs):
        self.sent = kwargs
        if self.error:
            raise self.error
        return {"output": {"message": {"content": [{"text": self.reply}]}}}


def real_ask(monkeypatch, client):
    """Undo conftest's stub for _ask_bedrock and point it at a fake boto3 client."""
    monkeypatch.setattr(term_explainer, "_ask_bedrock", term_explainer._ask_bedrock_impl)
    monkeypatch.setattr(term_explainer, "_client", lambda: client)


def test_prompt_sets_the_rules_and_treats_the_term_as_data(monkeypatch):
    fake = FakeClient(reply="  " + GOOD + "  ")
    real_ask(monkeypatch, fake)
    assert term_explainer._ask_bedrock("deductible", "es", "detailed") == GOOD
    system = fake.sent["system"][0]["text"]
    assert "dollar" in system.lower()
    assert "data" in system.lower()
    assert "Spanish" in system
    assert term_explainer.RESET_WORDING in system
    assert "deductible" in fake.sent["messages"][0]["content"][0]["text"]


def test_bedrock_errors_return_none(monkeypatch):
    real_ask(monkeypatch, FakeClient(error=TimeoutError("slow")))
    assert term_explainer._ask_bedrock("deductible", "en", "simple") is None


@pytest.mark.parametrize("reply", ["", "   ", "x" * 2000])
def test_empty_or_rambling_replies_return_none(monkeypatch, reply):
    real_ask(monkeypatch, FakeClient(reply=reply))
    assert term_explainer._ask_bedrock("deductible", "en", "simple") is None
