"""API tests using FastAPI's TestClient.

Routes are thin, so these check the HTTP layer: shapes, status codes, plain 422
messages, CORS, and that request bodies never reach the logs. Dollar figures are
the section 9 known-good numbers, checked end to end over HTTP.
"""

from __future__ import annotations

import logging
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.demo_data import maya_plan, maya_procedures
from app.main import app
from app.models import MAX_FEE, MAX_PROCEDURES, MAX_TERM, MAX_TEXT

FRONTEND_ORIGIN = "http://localhost:5173"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def maya_body(*can_wait: str) -> dict[str, Any]:
    """Maya's procedures and plan as JSON, with the given ids confirmed as able to wait."""
    procedures = [p.model_dump(mode="json") for p in maya_procedures()]
    for p in procedures:
        if p["id"] in can_wait:
            p["can_wait"] = True
    return {"procedures": procedures, "plan": maya_plan().model_dump(mode="json")}


def assert_plain_422(response) -> str:
    """A 422 whose detail is one plain string, never a list and never a 500."""
    assert response.status_code == 422, response.text
    detail = response.json()["detail"]
    assert isinstance(detail, str)
    assert detail.strip()
    return detail


# ---------- The three requested checks ----------


def test_optimize_maya_all_now_2500_best_1975_moves_crown2(client):
    response = client.post("/optimize", json=maya_body("crown1", "crown2"))
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["all_now"]["totals"]["you_pay"] == 2500
    assert data["best"]["totals"]["you_pay"] == 1975
    assert data["moved"] == ["crown2"]
    assert data["savings"] == 525


def test_calculate_crown2_next_year_leaves_100_of_this_years_max(client):
    body = maya_body("crown1", "crown2") | {"schedule": {"crown2": "next_year"}}
    response = client.post("/calculate", json=body)
    assert response.status_code == 200, response.text
    assert response.json()["max_left"]["this_year"] == 100


def test_moving_a_locked_procedure_returns_422(client):
    body = maya_body() | {"schedule": {"crown2": "next_year"}}
    detail = assert_plain_422(client.post("/calculate", json=body))
    assert "locked" in detail


# ---------- Happy paths and shapes ----------


def test_demo_returns_maya_with_everything_locked(client):
    response = client.get("/demo")
    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"procedures", "plan"}
    assert [p["id"] for p in data["procedures"]] == ["filling1", "filling2", "root_canal", "crown1", "crown2"]
    assert all(p["can_wait"] is False for p in data["procedures"])
    assert data["plan"]["annual_max"] == 1500
    assert data["plan"]["deductible"] == 50


def test_catalog_returns_catalog_items(client):
    response = client.get("/catalog")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 3
    for item in items:
        assert set(item) == {"cdt_code", "name", "category", "default_fee"}


def test_calculate_all_now_matches_section_9(client):
    response = client.post("/calculate", json=maya_body())
    assert response.status_code == 200
    totals = response.json()["totals"]
    assert totals == {"plan_pays": 1500, "you_pay": 2500}


def test_calculate_without_schedule_means_all_now(client):
    response = client.post("/calculate", json=maya_body())
    assert {line["year"] for line in response.json()["per_procedure"]} == {"this_year"}


def test_result_shape_matches_section_6(client):
    data = client.post("/calculate", json=maya_body()).json()
    assert set(data) == {"per_procedure", "totals", "max_left", "warnings"}
    assert set(data["max_left"]) == {"this_year", "next_year"}
    assert set(data["per_procedure"][0]) == {
        "id", "year", "billed_fee", "allowed_fee", "deductible_applied", "plan_pays", "you_pay", "reasons",
    }


def test_optimize_shape_matches_section_6(client):
    data = client.post("/optimize", json=maya_body("crown1", "crown2")).json()
    assert set(data) == {"all_now", "best", "best_schedule", "savings", "moved"}


def test_demo_round_trips_into_calculate(client):
    demo = client.get("/demo").json()
    response = client.post("/calculate", json=demo)
    assert response.status_code == 200
    assert response.json()["totals"]["you_pay"] == 2500


# ---------- 422s: always one plain string ----------


def test_crown_before_root_canal_returns_422(client):
    body = maya_body("filling1", "filling2", "root_canal", "crown1", "crown2")
    body["schedule"] = {"root_canal": "next_year"}
    assert_plain_422(client.post("/calculate", json=body))


def test_more_than_eight_movable_returns_422(client):
    body = maya_body()
    filling = body["procedures"][0]
    body["procedures"] = [filling | {"id": f"f{i}", "can_wait": True} for i in range(9)]
    assert_plain_422(client.post("/optimize", json=body))


def test_fee_over_cap_returns_422(client):
    body = maya_body()
    body["procedures"][0]["billed_fee"] = MAX_FEE + 1
    body["procedures"][0]["allowed_fee"] = MAX_FEE + 1
    detail = assert_plain_422(client.post("/calculate", json=body))
    assert "billed_fee" in detail


def test_too_many_procedures_returns_422(client):
    body = maya_body()
    filling = body["procedures"][0]
    body["procedures"] = [filling | {"id": f"f{i}"} for i in range(MAX_PROCEDURES + 1)]
    assert_plain_422(client.post("/calculate", json=body))


def test_unknown_field_returns_422(client):
    body = maya_body()
    body["procedures"][0]["price"] = 1
    assert_plain_422(client.post("/calculate", json=body))


def test_missing_plan_returns_422(client):
    body = maya_body()
    del body["plan"]
    detail = assert_plain_422(client.post("/optimize", json=body))
    assert "plan" in detail


def test_broken_json_returns_422(client):
    response = client.post("/calculate", content="{not json", headers={"Content-Type": "application/json"})
    assert_plain_422(response)


def test_422_never_echoes_the_input(client):
    body = maya_body()
    body["procedures"][0]["billed_fee"] = "ECHO-MARKER"
    response = client.post("/calculate", json=body)
    assert_plain_422(response)
    assert "ECHO-MARKER" not in response.text


# ---------- Fake sockets ----------


def test_parse_returns_maya_procedures(client):
    response = client.post("/parse", json={"text": "My dentist said I need a root canal and two crowns."})
    assert response.status_code == 200
    assert [p["id"] for p in response.json()] == ["filling1", "filling2", "root_canal", "crown1", "crown2"]


@pytest.mark.parametrize("text", ["", "x" * (MAX_TEXT + 1)], ids=["empty", "too_long"])
def test_parse_rejects_empty_or_long_text(client, text):
    assert_plain_422(client.post("/parse", json={"text": text}))


@pytest.mark.parametrize("term", ["deductible", "Coinsurance", "annual maximum", "waiting period"])
def test_explain_known_terms_have_no_dollar_figures(client, term):
    response = client.post("/explain", json={"term": term, "language": "en", "style": "plain"})
    assert response.status_code == 200
    text = response.json()["text"]
    assert text
    assert "$" not in text


def test_explain_unknown_term_gets_calm_fallback(client):
    response = client.post("/explain", json={"term": "zirconia upcharge"})
    assert response.status_code == 200
    assert "plan" in response.json()["text"].lower()


@pytest.mark.parametrize("term", ["my tooth hurts", "swelling in my jaw", "I have a fever", "pain"])
def test_explain_refuses_symptoms(client, term):
    response = client.post("/explain", json={"term": term})
    assert response.status_code == 200
    assert "contact a dentist today" in response.json()["text"].lower()


def test_explain_rejects_long_term(client):
    assert_plain_422(client.post("/explain", json={"term": "x" * (MAX_TERM + 1)}))


# ---------- CORS ----------


def test_cors_allows_the_vite_dev_server(client):
    response = client.options(
        "/calculate",
        headers={"Origin": FRONTEND_ORIGIN, "Access-Control-Request-Method": "POST"},
    )
    assert response.headers.get("access-control-allow-origin") == FRONTEND_ORIGIN


def test_cors_blocks_other_origins(client):
    response = client.options(
        "/calculate",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in response.headers


# ---------- Privacy: request bodies never reach the logs ----------


def test_request_bodies_are_never_logged(client, caplog):
    caplog.set_level(logging.DEBUG)
    good = maya_body()
    good["procedures"][0]["name"] = "PRIVATE-MARKER"
    bad = maya_body()
    bad["procedures"][0]["name"] = "PRIVATE-MARKER"
    bad["procedures"][0]["billed_fee"] = -1

    client.post("/calculate", json=good)
    client.post("/calculate", json=bad)
    client.post("/parse", json={"text": "PRIVATE-MARKER"})
    client.post("/explain", json={"term": "PRIVATE-MARKER"})

    assert "PRIVATE-MARKER" not in caplog.text
