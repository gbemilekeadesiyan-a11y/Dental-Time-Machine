"""POST /narrate: the step-by-step guide. Fixed templates filled with engine figures, no LLM.

Maya's section 9 numbers: all now $2,500; with crown 2 next year $1,975, saving $525.
"""

from __future__ import annotations

import re
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import narrate as narrate_module
from app import sockets
from app.ai.dollar_guard import allowed_amounts, extract_amounts, unknown_amounts
from app.demo_data import maya_plan, maya_procedures
from app.engine import calculate
from app.main import app
from app.models import NarrateSegment
from app.optimizer import optimize

STEPS = ["what_it_means", "two_futures", "summary", "find_care", "your_year"]
LANGUAGES = ["en", "es", "fr", "pt"]
STYLES = ["simple", "detailed", "numbers"]


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def body(
    step: str,
    language: str = "en",
    style: str = "simple",
    crowns_can_wait: bool = False,
    schedule: dict[str, str] | None = None,
) -> dict[str, Any]:
    procedures = [p.model_dump(mode="json") for p in maya_procedures()]
    for p in procedures:
        if p["id"] in ("crown1", "crown2"):
            p["can_wait"] = crowns_can_wait
    return {
        "step": step,
        "preferences": {"language": language, "style": style, "voice_on": False},
        "procedures": procedures,
        "plan": maya_plan().model_dump(mode="json"),
        "schedule": schedule or {},
    }


def narrate(client: TestClient, payload: dict[str, Any]) -> dict[str, Any]:
    response = client.post("/narrate", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def texts(data: dict[str, Any]) -> list[str]:
    return [s["text"] for s in data["segments"]]


def by_target(data: dict[str, Any], target: str) -> list[str]:
    return [s["text"] for s in data["segments"] if s["target"] == target]


# ---------- what it means ----------


def test_what_it_means_total_for_maya(client: TestClient) -> None:
    data = narrate(client, body("what_it_means"))
    assert data["segments"][0]["target"] == "total"
    assert "$2,500" in data["segments"][0]["text"]
    assert data["next_step"] == "two_futures"
    assert data["next_label"]


def test_what_it_means_names_the_three_costliest_procedures(client: TestClient) -> None:
    # Maya, everything now: crown 2 $1,200, crown 1 $650, root canal $550 (fillings $70 and $30).
    data = narrate(client, body("what_it_means"))
    procs = [s for s in data["segments"] if s["target"] and s["target"].startswith("proc-")]
    assert [s["target"] for s in procs] == ["proc-crown2", "proc-crown1", "proc-root_canal"]
    assert "$1,200" in procs[0]["text"]
    assert by_target(data, "terms")


def test_what_it_means_follows_the_chosen_schedule(client: TestClient) -> None:
    # The page shows the user's own timing, so the guide says the same total.
    data = narrate(client, body("what_it_means", crowns_can_wait=True, schedule={"crown2": "next_year"}))
    assert "$1,975" in data["segments"][0]["text"]


# ---------- two futures ----------


def test_two_futures_savings_only_when_crown_can_wait(client: TestClient) -> None:
    data = narrate(client, body("two_futures", crowns_can_wait=True))
    best = " ".join(by_target(data, "best"))
    assert "$1,975" in best and "$525" in best
    assert "Crown 2" in best
    assert "$2,500" in " ".join(by_target(data, "all-now"))


def test_two_futures_when_nothing_can_wait(client: TestClient) -> None:
    data = narrate(client, body("two_futures", crowns_can_wait=False))
    best = " ".join(by_target(data, "best"))
    assert "getting everything now" in best
    assert "$1,975" not in " ".join(texts(data))
    assert "$525" not in " ".join(texts(data))


def test_two_futures_timeline_says_only_your_dentist_decides(client: TestClient) -> None:
    timeline = " ".join(by_target(narrate(client, body("two_futures")), "timeline"))
    assert "Only move care your dentist says can wait" in timeline


# ---------- summary ----------


def test_summary_figures_and_reset_wording(client: TestClient) -> None:
    data = narrate(client, body("summary", crowns_can_wait=True, schedule={"crown2": "next_year"}))
    # Section 9: crown 2 next year, plan pays $2,025 in total, you pay $1,975, $100 of the max left.
    assert "$2,025" in " ".join(by_target(data, "summary-plan"))
    assert "$1,975" in " ".join(by_target(data, "summary-you"))
    assert "$100" in " ".join(by_target(data, "summary-max"))
    reset = by_target(data, "reset")
    assert any("January 1" in t for t in reset)
    assert sockets.RESET_TEXT["en"] in reset  # Word for word (CLAUDE.md section 12).
    assert by_target(data, "reminder")
    assert data["next_step"] == "find_care"


def test_reset_date_in_words_per_language(client: TestClient) -> None:
    expected = {"es": "1 de enero", "fr": "1er janvier", "pt": "1º de janeiro"}
    for language, words in expected.items():
        reset = by_target(narrate(client, body("summary", language=language)), "reset")
        assert any(words in t for t in reset), language
        assert sockets.RESET_TEXT[language] in reset


# ---------- find care and your year ----------


def test_find_care_says_details_are_demo_data_and_never_ranks(client: TestClient) -> None:
    data = narrate(client, body("find_care"))
    joined = " ".join(texts(data)).lower()
    assert "demo" in joined
    assert "best plan" not in joined and "you should" not in joined
    assert by_target(data, "plan-compare")
    assert data["next_step"] == "your_year"


def test_your_year_splits_by_plan_year(client: TestClient) -> None:
    payload = body("your_year", crowns_can_wait=True, schedule={"crown2": "next_year"})
    data = narrate(client, payload)
    result = calculate(maya_procedures_can_wait(), maya_plan(), {"crown2": "next_year"})
    this_year = sum(line.you_pay for line in result.per_procedure if line.year == "this_year")
    next_year = sum(line.you_pay for line in result.per_procedure if line.year == "next_year")
    assert sockets.format_money(this_year) in " ".join(by_target(data, "year-this"))
    assert sockets.format_money(next_year) in " ".join(by_target(data, "year-next"))
    assert data["next_step"] is None and data["next_label"]


def test_your_year_skips_next_year_when_nothing_moved(client: TestClient) -> None:
    data = narrate(client, body("your_year"))
    assert by_target(data, "year-this")
    assert not by_target(data, "year-next")


def maya_procedures_can_wait():
    return [p.model_copy(update={"can_wait": p.id in ("crown1", "crown2")}) for p in maya_procedures()]


# ---------- every step, every language ----------


def _allowed(payload: dict[str, Any]) -> set[float]:
    procedures = [p.model_copy(update={"can_wait": payload["procedures"][i]["can_wait"]}) for i, p in enumerate(maya_procedures())]
    plan = maya_plan()
    current = calculate(procedures, plan, payload["schedule"])
    by_year = [sum(line.you_pay for line in current.per_procedure if line.year == y) for y in ("this_year", "next_year")]
    return allowed_amounts(optimize(procedures, plan), current, plan, procedures) | {round(v, 2) for v in by_year}


CASES = [
    (step, language, style, crowns, schedule)
    for step in STEPS
    for language in LANGUAGES
    for style in STYLES
    for crowns, schedule in ((False, {}), (True, {"crown2": "next_year"}))
]


@pytest.mark.parametrize(("step", "language", "style", "crowns", "schedule"), CASES)
def test_every_amount_comes_from_the_engine(
    client: TestClient, step: str, language: str, style: str, crowns: bool, schedule: dict[str, str]
) -> None:
    payload = body(step, language, style, crowns, schedule)
    data = narrate(client, payload)
    assert data["segments"], "every step says something"
    allowed = _allowed(payload)
    for text in texts(data):
        assert not unknown_amounts(text, allowed), text


@pytest.mark.parametrize(("step", "language", "style", "crowns", "schedule"), CASES)
def test_wording_is_safe(client: TestClient, step: str, language: str, style: str, crowns: bool, schedule: dict[str, str]) -> None:
    data = narrate(client, body(step, language, style, crowns, schedule))
    joined = " ".join(texts(data)).lower()
    for banned in ("should wait", "best plan", "recommend", "recomend", "recommand", "you should", "you owe"):
        assert banned not in joined, banned
    assert not re.search(r"\b(second|another|two|extra) (annual )?max", joined)
    # Every step ends with the disclaimer, not tied to any element.
    assert data["segments"][-1] == {"text": sockets.DISCLAIMERS[language], "target": None, "pause_ms": 0}


@pytest.mark.parametrize("step", STEPS)
def test_english_segments_are_short_single_sentences(client: TestClient, step: str) -> None:
    for style in ("simple", "detailed"):
        # The last segment is the section 12 disclaimer, which is two short sentences by design.
        for text in texts(narrate(client, body(step, style=style, crowns_can_wait=True)))[:-1]:
            assert len(text.split()) < 20, text
            assert text.count(". ") == 0, text  # One sentence per segment.


def test_spanish_reads_in_spanish_and_passes_the_guard(client: TestClient) -> None:
    payload = body("two_futures", language="es", crowns_can_wait=True)
    data = narrate(client, payload)
    joined = " ".join(texts(data))
    assert "pagarías" in joined or "pagarias" in joined
    assert "$1,975" in joined and "$525" in joined
    assert not unknown_amounts(joined, _allowed(payload))


def test_simple_and_detailed_styles_differ(client: TestClient) -> None:
    simple = texts(narrate(client, body("what_it_means", style="simple")))
    detailed = texts(narrate(client, body("what_it_means", style="detailed")))
    assert simple != detailed
    # "numbers" reuses "detailed".
    assert texts(narrate(client, body("what_it_means", style="numbers"))) == detailed


def test_steps_chain_in_order(client: TestClient) -> None:
    chain = [narrate(client, body(step))["next_step"] for step in STEPS]
    assert chain == ["two_futures", "summary", "find_care", "your_year", None]


# ---------- the guard drops what it can't vouch for ----------


def test_segment_with_an_unknown_amount_is_dropped() -> None:
    segments = [
        NarrateSegment(text="You'd likely pay $2,500.", target="total", pause_ms=600),
        NarrateSegment(text="That's $999 less.", target="best", pause_ms=600),
        NarrateSegment(text="You should wait for your crown.", target="best", pause_ms=600),
    ]
    kept = narrate_module.guarded(segments, {2500.0})
    assert [s.text for s in kept] == ["You'd likely pay $2,500."]


def test_amounts_are_formatted_like_the_rest_of_the_app(client: TestClient) -> None:
    amounts = [a for t in texts(narrate(client, body("two_futures", crowns_can_wait=True))) for a in extract_amounts(t)]
    assert {2500.0, 1975.0, 525.0} <= set(amounts)


# ---------- errors ----------


def test_unknown_step_is_a_plain_422(client: TestClient) -> None:
    response = client.post("/narrate", json=body("tell_us"))
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, str) and "step" in detail.lower()


def test_moving_locked_care_is_a_plain_422(client: TestClient) -> None:
    response = client.post("/narrate", json=body("summary", crowns_can_wait=False, schedule={"crown2": "next_year"}))
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
