"""Dollar guard tests (CLAUDE.md section 12).

Every money figure in LLM text must exist in the engine result passed to that call.
Allowed figures come from Maya's real engine output (section 9), never typed in here,
except for the section 9 headline numbers we assert on and figures chosen to be absent.
"""

from __future__ import annotations

import pytest

from app.ai.dollar_guard import allowed_amounts, extract_amounts, guard, unknown_amounts
from app.demo_data import maya_plan, maya_procedures
from app.models import OptimizeResult
from app.optimizer import optimize

FALLBACK = "Fixed fallback text."


@pytest.fixture(scope="module")
def maya_optimize() -> OptimizeResult:
    procedures = [
        p.model_copy(update={"can_wait": True}) if p.id in {"crown1", "crown2"} else p for p in maya_procedures()
    ]
    return optimize(procedures, maya_plan())


@pytest.fixture(scope="module")
def allowed(maya_optimize: OptimizeResult) -> set[float]:
    return allowed_amounts(maya_optimize)


# ---------- extract_amounts: formats per language ----------


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        # English
        ("You'll likely pay $1,975.", [1975]),
        ("You'll likely pay $1975.00 this year.", [1975]),
        ("That's 2,500 dollars in total.", [2500]),
        ("You could save USD 525.", [525]),
        ("Your plan pays $1,500 and you pay $2,500.", [1500, 2500]),
        ("A cost of $12.50", [12.5]),
        # Spanish
        ("Probablemente pagarás 1.975 $.", [1975]),
        ("Pagarías 1975 dólares.", [1975]),
        ("Ahorrarías 525 dólares.", [525]),
        ("El total es de 2.500,00 $", [2500]),
        ("Un dólar: 1 dólar", [1]),
        # French and Portuguese
        ("Vous paierez probablement 1 975 $.", [1975]),
        ("Vous paierez probablement 1 975,50 $.", [1975.5]),
        ("Você provavelmente pagará US$ 1.975,00.", [1975]),
    ],
)
def test_extract_money_formats(text: str, expected: list[float]) -> None:
    assert extract_amounts(text) == pytest.approx(expected)


@pytest.mark.parametrize(
    "text",
    [
        "You have 2 crowns and 2 fillings.",
        "Tooth 14 needs a filling.",
        "Your plan pays 80% for basic care.",
        "Crowns use code D2740.",
        "Your plan year resets on 01-01, so in 2027 benefits may be available again.",
        "Tu plan cubre el 50 % de la atención mayor.",
        "",
    ],
)
def test_non_money_numbers_are_ignored(text: str) -> None:
    assert extract_amounts(text) == []


def test_large_bare_numbers_count_as_money() -> None:
    # An LLM that drops the "$" must not slip a made-up figure past the guard.
    assert extract_amounts("You would pay 1234 this year.") == [1234]


# ---------- allowed_amounts and unknown_amounts ----------


def test_allowed_contains_section_9_figures(allowed: set[float]) -> None:
    for figure in (2500, 1975, 525, 1500, 100):
        assert figure in allowed


def test_allowed_walks_several_sources(maya_optimize: OptimizeResult) -> None:
    sources = allowed_amounts(maya_optimize.best, maya_procedures(), maya_plan())
    assert {1975, 1300, 50} <= sources


def test_bools_are_not_amounts() -> None:
    assert allowed_amounts({"flag": True}) == set()


@pytest.mark.parametrize(
    "text",
    [
        "If your dentist confirms crown 2 can wait, you'd likely pay $1,975 instead of $2,500.",
        "Si tu dentista confirma que la corona 2 puede esperar, probablemente pagarías 1.975 $ en vez de 2.500 $.",
        "Podrías ahorrar 525 dólares.",
        "You have $100 of your annual maximum left this year.",
        "No figures here at all.",
    ],
)
def test_engine_figures_pass(text: str, allowed: set[float]) -> None:
    assert unknown_amounts(text, allowed) == []


@pytest.mark.parametrize(
    ("text", "bad"),
    [
        ("You'd likely pay $1,234.", [1234]),
        ("You could save $600 by waiting.", [600]),
        ("Pagarías 1.999 $ este año.", [1999]),
        ("Ahorrarías 999 dólares.", [999]),
        ("You'll pay $1,975, saving $530.", [530]),
    ],
)
def test_invented_figures_are_caught(text: str, bad: list[float], allowed: set[float]) -> None:
    assert unknown_amounts(text, allowed) == pytest.approx(bad)


def test_rounded_engine_figure_passes() -> None:
    # The engine may produce cents; "about $513" for 512.5 is the engine's figure, rounded.
    assert unknown_amounts("About $513.", {512.5}) == []
    assert unknown_amounts("About $512.50.", {512.5}) == []


# ---------- guard: regenerate once, then fall back ----------


class FakeLLM:
    """Returns the queued replies in order and counts calls."""

    def __init__(self, *replies: str | None) -> None:
        self.replies = list(replies)
        self.calls = 0

    def __call__(self) -> str | None:
        self.calls += 1
        return self.replies.pop(0)


def test_guard_keeps_clean_text(allowed: set[float]) -> None:
    llm = FakeLLM("You'd likely pay $1,975.")
    assert guard(llm, allowed, FALLBACK) == "You'd likely pay $1,975."
    assert llm.calls == 1


def test_guard_regenerates_once(allowed: set[float]) -> None:
    llm = FakeLLM("You'd likely pay $1,234.", "Probablemente pagarías 1.975 $.")
    assert guard(llm, allowed, FALLBACK) == "Probablemente pagarías 1.975 $."
    assert llm.calls == 2


def test_guard_falls_back_after_two_bad_replies(allowed: set[float]) -> None:
    llm = FakeLLM("You'd likely pay $1,234.", "Pagarías 999 dólares.")
    assert guard(llm, allowed, FALLBACK) == FALLBACK
    assert llm.calls == 2


def test_guard_falls_back_when_llm_unavailable(allowed: set[float]) -> None:
    llm = FakeLLM(None)
    assert guard(llm, allowed, FALLBACK) == FALLBACK
    assert llm.calls == 1


def test_guard_falls_back_on_empty_reply(allowed: set[float]) -> None:
    llm = FakeLLM("   ", None)
    assert guard(llm, allowed, FALLBACK) == FALLBACK


def test_guard_accepts_callable_fallback(allowed: set[float]) -> None:
    llm = FakeLLM(None)
    assert guard(llm, allowed, lambda: "Built fallback.") == "Built fallback."
