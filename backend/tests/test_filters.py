"""Tests for Kuwa's filters feature: the filter parser and the dentist search.

The NPI Registry is never called: httpx.get is replaced with canned records.
Bedrock is never called either: _converse is replaced in every test.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import dentist_search, filter_ai
from app.routers.dentist_search import (
    UNAVAILABLE_NOTE,
    miles_between,
    prefixes_within,
    search_dentists,
    zip_centroids,
)
from app.routers.filter_parser import NOTHING_FOUND_NOTE, SAFETY_NOTE, parse_filters


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def no_bedrock(monkeypatch):
    """Bedrock is "down" unless a test sets an answer, so routes use the rules."""
    answer: dict[str, Any] = {}

    def fake_converse(text: str) -> dict[str, Any]:
        if "raw" not in answer:
            raise filter_ai.AiUnavailable("test")
        return answer["raw"]

    monkeypatch.setattr(filter_ai, "_converse", fake_converse)
    return answer


def changes(text: str) -> dict[str, Any]:
    return parse_filters(text).changes.model_dump(exclude_unset=True)


# ---------- parser: the two example requests ----------


def test_first_request_sets_distance_budget_network_and_week():
    assert changes("Find me an in-network dentist within 10 miles, under $200, that can see me this week.") == {
        "max_distance_miles": 10,
        "budget_this_year": 200,
        "in_network_only": True,
        "payment": "insurance",
        "availability": "this_week",
    }


def test_follow_up_only_changes_distance_and_availability():
    assert changes("Actually I'll drive 25 miles if someone can see me tomorrow.") == {
        "max_distance_miles": 25,
        "availability": "tomorrow",
    }


def test_route_returns_only_changed_keys(client):
    response = client.post("/filters/parse", json={"text": "Actually I'll drive 25 miles if someone can see me tomorrow."})
    assert response.status_code == 200, response.text
    assert response.json() == {
        "changes": {"max_distance_miles": 25.0, "availability": "tomorrow"},
        "reset": False,
        "note": None,
        "source": "rules",
    }


# ---------- parser: each filter ----------


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("near 27401", {"zip": "27401"}),
        ("within 5 mi", {"max_distance_miles": 5}),
        ("I'll go 500 miles", {"max_distance_miles": 100}),
        ("budget of 1,500", {"budget_this_year": 1500}),
        ("under 300 dollars", {"budget_this_year": 300}),
        ("price doesn't matter", {"budget_this_year": None}),
        ("out of network is fine", {"in_network_only": False}),
        ("I'll pay cash", {"payment": "self_pay", "in_network_only": False}),
        ("I don't have insurance", {"payment": "self_pay", "in_network_only": False}),
        ("use my insurance", {"payment": "insurance"}),
        ("use the demo plan", {"payment": "insurance", "preferred_plan_id": "demo_plan"}),
        ("I need a filling", {"service": "D2391"}),
        ("root canal", {"service": "D3330"}),
        ("a crown", {"service": "D2740"}),
        ("just a cleaning", {"service": "checkup"}),
        ("an orthodontist for braces", {"specialty": "orthodontics"}),
        ("oral surgeon for wisdom teeth", {"specialty": "oral_surgery"}),
        ("Dr. Patel please", {"dentist_name": "Patel"}),
        ("for my 8 year old", {"age_range": "under_18"}),
        ("I'm 70", {"age_range": "65_plus"}),
        ("I'm 34", {"age_range": "18_64"}),
        ("today", {"availability": "today"}),
        ("next week works", {"availability": "two_weeks"}),
        ("no rush", {"availability": "any"}),
        ("earliest available", {"sort": "earliest"}),
        ("accepting new patients", {"accepting_new_only": True}),
        ("speaks Spanish or Vietnamese", {"languages": ["Spanish", "Vietnamese"]}),
        ("any language", {"languages": []}),
        ("without a referral", {"no_referral_only": True}),
    ],
)
def test_each_filter(text, expected):
    assert changes(text) == expected


def test_numbers_are_not_mixed_up():
    # 10 miles is not a ZIP or a budget; $200 is not miles; the ZIP is not an age.
    assert changes("27401, 10 miles, $200") == {"zip": "27401", "max_distance_miles": 10, "budget_this_year": 200}


def test_last_time_mentioned_wins():
    assert changes("today, no actually tomorrow")["availability"] == "tomorrow"


def test_reset():
    result = parse_filters("clear all filters")
    assert result.reset is True
    assert result.note is None


def test_symptoms_get_the_safety_note_and_filters_still_apply():
    result = parse_filters("my tooth hurts, find someone today")
    assert result.note == SAFETY_NOTE
    assert result.changes.model_dump(exclude_unset=True) == {"availability": "today"}


def test_nothing_found_note():
    result = parse_filters("hello there")
    assert result.changes.model_dump(exclude_unset=True) == {}
    assert result.note == NOTHING_FOUND_NOTE


def test_budget_over_cap_is_left_alone():
    result = parse_filters("$90,000")
    assert "budget_this_year" not in result.changes.model_dump(exclude_unset=True)
    assert result.note and "$50,000" in result.note


@pytest.mark.parametrize("body", [{}, {"text": ""}, {"text": "x" * 2001}, {"text": "hi", "extra": 1}])
def test_parse_bad_input_is_plain_422(client, body):
    response = client.post("/filters/parse", json=body)
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


# ---------- Bedrock answers (mocked) ----------


def test_ai_answer_is_used_when_bedrock_works(client, no_bedrock):
    no_bedrock["raw"] = {"max_distance_miles": 25, "availability": "tomorrow"}
    response = client.post("/filters/parse", json={"text": "I'll drive 25 miles if someone can see me tomorrow"})
    assert response.json() == {
        "changes": {"max_distance_miles": 25.0, "availability": "tomorrow"},
        "reset": False,
        "note": None,
        "source": "ai",
    }


def test_ai_numbers_must_come_from_the_users_text(no_bedrock):
    # The model "invents" a budget, miles and a ZIP that the user never typed.
    no_bedrock["raw"] = {"budget_this_year": 150, "max_distance_miles": 30, "zip": "90210", "availability": "today"}
    result, source = filter_ai.understand("someone who can see me today")
    assert source == "ai"
    assert result.changes.model_dump(exclude_unset=True) == {"availability": "today"}


def test_ai_bad_fields_are_dropped_and_good_ones_kept(no_bedrock):
    no_bedrock["raw"] = {"specialty": "astrology", "languages": ["Klingon"], "unknown": 1, "in_network_only": True}
    result, _ = filter_ai.understand("in-network please")
    assert result.changes.model_dump(exclude_unset=True) == {"in_network_only": True}


def test_ai_distance_over_the_cap_is_clamped(no_bedrock):
    no_bedrock["raw"] = {"max_distance_miles": 500}
    result, _ = filter_ai.understand("I'll drive 500 miles")
    assert result.changes.max_distance_miles == 100


def test_ai_can_clear_the_budget_and_reset(no_bedrock):
    no_bedrock["raw"] = {"budget_this_year": None, "reset": True}
    result, _ = filter_ai.understand("start over, price doesn't matter")
    assert result.reset is True
    assert result.changes.model_dump(exclude_unset=True) == {"budget_this_year": None}


def test_safety_note_comes_from_rules_not_the_model(no_bedrock):
    no_bedrock["raw"] = {"availability": "today"}
    result, _ = filter_ai.understand("my tooth hurts, anyone today?")
    assert result.note == SAFETY_NOTE


def test_bedrock_down_falls_back_to_rules():
    result, source = filter_ai.understand("within 10 miles this week")
    assert source == "rules"
    assert result.changes.model_dump(exclude_unset=True) == {"max_distance_miles": 10, "availability": "this_week"}


# ---------- ZIP centroids and distance ----------


def test_centroid_table_loads():
    centroids = zip_centroids()
    assert len(centroids) > 30_000
    assert "27401" in centroids


def test_miles_between_known_cities():
    # Greensboro 27401 to Winston-Salem 27101 is roughly 25 miles.
    d = miles_between(zip_centroids()["27401"], zip_centroids()["27101"])
    assert 20 < d < 30


def test_prefixes_start_with_the_users_own():
    prefixes = prefixes_within("27401", 10)
    assert prefixes[0] == "2740"
    assert len(prefixes) <= dentist_search.MAX_PREFIXES


# ---------- dentist search (NPI mocked) ----------


def npi_record(npi: str, zip9: str, desc: str = "Dentist, General Practice", **basic: str) -> dict[str, Any]:
    return {
        "number": npi,
        "enumeration_type": "NPI-1",
        "basic": {"first_name": "JANE", "last_name": "DOE", "credential": "D.D.S.", **basic},
        "addresses": [
            {"address_purpose": "MAILING", "address_1": "PO BOX 1", "city": "X", "state": "NC", "postal_code": "99999"},
            {"address_purpose": "LOCATION", "address_1": "1 MAIN ST", "city": "GREENSBORO", "state": "NC", "postal_code": zip9},
        ],
        "taxonomies": [{"desc": desc, "primary": True}],
    }


class FakeResponse:
    def __init__(self, results: list[dict[str, Any]]):
        self._results = results

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict[str, Any]:
        return {"results": self._results}


@pytest.fixture
def fake_npi(monkeypatch):
    """Serve canned records and clear the prefix cache around each test."""
    records: list[dict[str, Any]] = []
    calls: list[dict[str, Any]] = []

    def fake_get(url, params, timeout):
        calls.append(params)
        prefix = params["postal_code"].rstrip("*")
        return FakeResponse([r for r in records if r["addresses"][1]["postal_code"].startswith(prefix)])

    monkeypatch.setattr(dentist_search.httpx, "get", fake_get)
    dentist_search._cache.clear()
    yield records, calls
    dentist_search._cache.clear()


def test_search_returns_nearest_first_and_drops_far_and_non_dentists(fake_npi):
    records, calls = fake_npi
    records += [
        npi_record("1000000001", "274081234"),  # a few miles away
        npi_record("1000000002", "274011234"),  # same ZIP
        npi_record("1000000003", "274011234", desc="Dental Hygienist"),  # not a dentist
        npi_record("1000000004", "274011234", desc="Dentist, Dental Public Health"),  # not patient care
        npi_record("1000000005", "274011234", desc="Dentist, Pediatric Dentistry"),
    ]
    result = search_dentists("27401", 10, today=date(2026, 10, 3))
    assert result.source == "npi"
    npis = [d.npi for d in result.dentists]
    assert npis[:2] == ["1000000002", "1000000005"] or npis[:2] == ["1000000005", "1000000002"]
    assert "1000000001" in npis
    assert "1000000003" not in npis and "1000000004" not in npis
    assert all(call["address_purpose"] == "LOCATION" for call in calls)
    assert all(len(call["postal_code"]) == 5 for call in calls)  # 4 digits + wildcard, never the full ZIP


def test_dentist_fields(fake_npi):
    records, _ = fake_npi
    records.append(npi_record("1000000005", "274011234", desc="Dentist, Pediatric Dentistry"))
    dentist = search_dentists("27401", 10, today=date(2026, 10, 3)).dentists[0]
    assert dentist.name == "Jane Doe, DDS"
    assert dentist.address == "1 Main St, Greensboro, NC 27401"
    assert dentist.distance_miles == 0
    assert dentist.specialty == "pediatric"
    assert dentist.no_referral_required is True
    assert dentist.languages[0] == "English"
    assert "2026-10-03" <= dentist.next_available <= "2026-10-17"


def test_demo_fields_are_stable(fake_npi):
    records, _ = fake_npi
    records.append(npi_record("1000000002", "274011234"))
    first = search_dentists("27401", 10, today=date(2026, 10, 3)).dentists[0]
    dentist_search._cache.clear()
    second = search_dentists("27401", 10, today=date(2026, 10, 3)).dentists[0]
    assert first == second


def test_registry_down_gives_empty_list_and_note(monkeypatch):
    def broken_get(*args, **kwargs):
        raise httpx.ConnectTimeout("timeout")

    monkeypatch.setattr(dentist_search.httpx, "get", broken_get)
    dentist_search._cache.clear()
    result = search_dentists("27401", 10)
    assert result.dentists == []
    assert result.source == "unavailable"
    assert result.note == UNAVAILABLE_NOTE


def test_dentists_route(client, fake_npi):
    records, _ = fake_npi
    records.append(npi_record("1000000002", "274011234"))
    response = client.get("/dentists", params={"zip": "27401", "max_distance_miles": "10"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "npi"
    assert body["dentists"][0]["npi"] == "1000000002"


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"zip": "2740"},
        {"zip": "abcde"},
        {"zip": "00000"},  # not a real ZIP
        {"zip": "27401", "max_distance_miles": "0"},
        {"zip": "27401", "max_distance_miles": "101"},
        {"zip": "27401", "max_distance_miles": "nan"},
        {"zip": "27401", "max_distance_miles": "far"},
    ],
)
def test_dentists_bad_input_is_plain_422(client, fake_npi, params):
    response = client.get("/dentists", params=params)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, str)
    assert "abcde" not in detail and "far" not in detail  # never echoes the input
