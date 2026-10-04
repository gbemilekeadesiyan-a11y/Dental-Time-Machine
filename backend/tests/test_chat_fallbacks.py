"""Fake chat and summary (sockets.py): what users see when Bedrock is down.

Fallback text must follow section 12: symptom safety reply in the user's language,
conditional savings copy, the reset wording, the disclaimer, and only engine figures.
"""

from __future__ import annotations

from typing import Any

import pytest

from app import sockets
from app.ai.dollar_guard import allowed_amounts, unknown_amounts
from app.demo_data import maya_plan, maya_procedures
from app.models import ChatRequest, ChatTurn, Preferences, SummaryRequest
from app.optimizer import optimize

LANGUAGES = ["en", "es", "fr", "pt"]


def prefs(language: str = "en", style: str = "simple") -> Preferences:
    return Preferences(language=language, style=style, voice_on=False)  # type: ignore[arg-type]


def chat_request(*turns: tuple[str, str], language: str = "en", with_care: bool = False) -> ChatRequest:
    return ChatRequest(
        turns=[ChatTurn(role=role, text=text) for role, text in turns],  # type: ignore[arg-type]
        preferences=prefs(language),
        procedures=maya_procedures() if with_care else [],
        plan=maya_plan() if with_care else None,
    )


def summary_request(*can_wait: str, language: str = "en", style: str = "simple") -> SummaryRequest:
    procedures = [p.model_copy(update={"can_wait": True}) if p.id in can_wait else p for p in maya_procedures()]
    result = optimize(procedures, maya_plan())
    return SummaryRequest(
        procedures=procedures,
        plan=maya_plan(),
        schedule=result.best_schedule,
        optimize=result,
        preferences=prefs(language, style),
    )


# ---------- symptoms ----------


@pytest.mark.parametrize(
    ("text", "language"),
    [
        ("My tooth hurts a lot", "en"),
        ("I have a toothache", "en"),
        ("Me duele la muela", "es"),
        ("Tengo la encía hinchada y sangra", "es"),
        ("J'ai mal aux dents", "fr"),
        ("Ma gencive est gonflée", "fr"),
        ("Estou com dor de dente", "pt"),
        ("Meu dente está quebrado", "pt"),
    ],
)
def test_symptoms_detected_in_each_language(text: str, language: str) -> None:
    assert sockets.has_symptoms(text)


@pytest.mark.parametrize(
    "text",
    [
        "My dentist said I need two crowns and a root canal.",
        "Mi dentista dijo que necesito dos coronas.",
        "Mon dentiste recommande une couronne.",
        "Meu dentista disse que preciso de uma coroa.",
        "Can the second crown wait until next year?",
    ],
)
def test_normal_care_talk_is_not_a_symptom(text: str) -> None:
    assert not sockets.has_symptoms(text)


@pytest.mark.parametrize("language", LANGUAGES)
def test_safety_reply_in_user_language(language: str) -> None:
    response = sockets.chat(chat_request(("user", "my tooth hurts"), language=language))
    assert response.say == sockets.SAFETY_REPLIES[language]
    assert response.proposed_procedures == []
    assert response.proposed_can_wait == []
    assert response.done_intake is False


def test_safety_reply_wins_even_with_care_entered() -> None:
    response = sockets.chat(chat_request(("user", "Me duele mucho"), language="es", with_care=True))
    assert response.say == sockets.SAFETY_REPLIES["es"]
    assert response.done_intake is False


# ---------- fake chat ----------


@pytest.mark.parametrize("language", LANGUAGES)
def test_chat_greets_when_no_user_turn(language: str) -> None:
    response = sockets.chat(chat_request(language=language))
    assert response.say == sockets.CHAT_TEXT["greet"][language]
    assert response.done_intake is False


def test_chat_points_to_form_when_care_missing() -> None:
    response = sockets.chat(chat_request(("user", "I need two crowns")))
    assert response.say == sockets.CHAT_TEXT["unavailable"]["en"]
    assert response.done_intake is False


def test_chat_done_when_care_and_plan_entered() -> None:
    response = sockets.chat(chat_request(("user", "That's everything"), with_care=True))
    assert response.say == sockets.CHAT_TEXT["ready"]["en"]
    assert response.done_intake is True


@pytest.mark.parametrize("with_care", [True, False])
def test_fake_chat_never_proposes(with_care: bool) -> None:
    # The fake must never invent procedures or decide that care can wait.
    response = sockets.chat(chat_request(("user", "My dentist said it can wait"), with_care=with_care))
    assert response.proposed_procedures == []
    assert response.proposed_can_wait == []


def test_chat_text_has_no_dollar_figures() -> None:
    for texts in [*sockets.CHAT_TEXT.values(), sockets.SAFETY_REPLIES]:
        for text in texts.values():
            assert unknown_amounts(text, set()) == []


# ---------- fake summary ----------


def test_summary_with_savings_english() -> None:
    text = sockets.summary(summary_request("crown1", "crown2"))
    # Section 9: all now 2,500; crown 2 next year 1,975; savings 525.
    assert "$2,500" in text
    assert "$1,975" in text
    assert "$525" in text
    assert "Crown 2" in text
    assert "If your dentist confirms" in text
    assert "should wait" not in text.lower()
    assert sockets.RESET_TEXT["en"] in text
    assert text.endswith(sockets.DISCLAIMERS["en"])


def test_summary_without_savings() -> None:
    text = sockets.summary(summary_request())
    assert "$2,500" in text
    assert "$1,975" not in text
    assert sockets.SUMMARY_TEXT["no_savings"]["en"] in text
    assert text.endswith(sockets.DISCLAIMERS["en"])


@pytest.mark.parametrize("language", LANGUAGES)
@pytest.mark.parametrize("style", ["simple", "detailed", "numbers"])
@pytest.mark.parametrize("can_wait", [(), ("crown1", "crown2")])
def test_summary_passes_dollar_guard(language: str, style: str, can_wait: tuple[str, ...]) -> None:
    request = summary_request(*can_wait, language=language, style=style)
    text = sockets.summary(request)
    assert unknown_amounts(text, allowed_amounts(request.optimize)) == []
    assert sockets.DISCLAIMERS[language] in text
    assert sockets.RESET_TEXT[language] in text


def test_detailed_summary_adds_plan_share_and_max_left() -> None:
    simple = sockets.summary(summary_request("crown1", "crown2"))
    detailed = sockets.summary(summary_request("crown1", "crown2", style="detailed"))
    assert len(detailed) > len(simple)
    assert "$2,025" in detailed  # Section 9: plan pays 1,400 + 625 with crown 2 next year.
    assert "$100" in detailed  # Section 9: max_left.this_year.


def test_summary_spanish() -> None:
    text = sockets.summary(summary_request("crown1", "crown2", language="es"))
    assert "Si tu dentista confirma" in text
    assert text.endswith(sockets.DISCLAIMERS["es"])


def test_every_language_has_every_text() -> None:
    tables: list[dict[str, Any]] = [
        sockets.SAFETY_REPLIES,
        sockets.DISCLAIMERS,
        sockets.RESET_TEXT,
        *sockets.CHAT_TEXT.values(),
        *sockets.SUMMARY_TEXT.values(),
    ]
    for table in tables:
        assert set(table) == set(LANGUAGES)
