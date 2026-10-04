"""API tests using FastAPI's TestClient.

Routes are thin, so these check the HTTP layer: shapes, status codes, plain 422
messages, CORS, and that request bodies never reach the logs. Dollar figures are
the section 9 known-good numbers, checked end to end over HTTP.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import main as main_module
from app.demo_data import maya_plan, maya_procedures
from app.main import app
from app.models import MAX_FEE, MAX_PROCEDURES, MAX_TERM, MAX_TEXT
from app.sockets import SAFETY_REPLY, explain

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
    assert "billed fee" in detail


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
    assert "plan" in detail.lower()


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


# ======================================================================
# Section 10 validation: boundaries, plain-English 422s, never a 500
# ======================================================================

TECHNICAL_WORDING = ("Input should", "procedures.0", "body.", "Value error", "List should", "String should")


def mutate(fn) -> dict[str, Any]:
    body = maya_body()
    fn(body)
    return body


def set_fee(i: int, value: Any):
    def fn(body):
        body["procedures"][i]["billed_fee"] = value
        body["procedures"][i]["allowed_fee"] = value
    return fn


def set_coverage(category: str, value: Any):
    def fn(body):
        body["plan"]["coverage"][category] = value
    return fn


def raw_with(field_json: str, replacement: str) -> str:
    """Maya's body as raw JSON with one value swapped (for NaN/Infinity, which json.dumps can't write)."""
    text = json.dumps(maya_body())
    assert field_json in text
    return text.replace(field_json, replacement, 1)


class TestBoundariesAccepted:
    @pytest.mark.parametrize("fee", [0, MAX_FEE], ids=["zero", "max"])
    def test_fee_at_the_edges_is_accepted(self, client, fee):
        assert client.post("/calculate", json=mutate(set_fee(0, fee))).status_code == 200

    def test_exactly_twenty_procedures_is_accepted(self, client):
        body = maya_body()
        filling = body["procedures"][0]
        body["procedures"] = [filling | {"id": f"f{i}"} for i in range(MAX_PROCEDURES)]
        assert client.post("/calculate", json=body).status_code == 200

    def test_exactly_2000_characters_is_accepted(self, client):
        assert client.post("/parse", json={"text": "x" * MAX_TEXT}).status_code == 200

    @pytest.mark.parametrize("share", [0, 1], ids=["zero", "one"])
    def test_coverage_at_the_edges_is_accepted(self, client, share):
        assert client.post("/calculate", json=mutate(set_coverage("basic", share))).status_code == 200

    def test_uuid_style_ids_are_accepted(self, client):
        body = maya_body()
        body["procedures"][0]["id"] = "3f2b9c1e-8a4d-4f6b-9e2a-1c5d7b8e9f00"
        assert client.post("/calculate", json=body).status_code == 200


# (case id, path, JSON body or raw string, words the plain message must contain)
BAD_INPUT = [
    ("fee_negative", "/calculate", mutate(set_fee(0, -1)), ["Procedure 1", "billed fee", "between 0 and 50,000"]),
    ("fee_over_cap", "/calculate", mutate(set_fee(0, MAX_FEE + 0.01)), ["Procedure 1", "between 0 and 50,000"]),
    ("allowed_fee_over_cap", "/calculate",
     mutate(lambda b: b["procedures"][2].update(allowed_fee=MAX_FEE + 1)), ["Procedure 3", "allowed fee"]),
    ("fee_true", "/calculate", mutate(set_fee(0, True)), ["Procedure 1", "billed fee", "number"]),
    ("fee_string", "/calculate", mutate(set_fee(0, "150")), ["billed fee", "number"]),
    ("fee_nan", "/calculate", raw_with('"billed_fee": 150.0', '"billed_fee": NaN'), ["billed fee", "real number"]),
    ("fee_infinity", "/calculate", raw_with('"billed_fee": 150.0', '"billed_fee": Infinity'),
     ["billed fee", "real number"]),
    ("coverage_negative", "/calculate", mutate(set_coverage("major", -0.1)), ["Major coverage", "between 0 and 1"]),
    ("coverage_over_one", "/calculate", mutate(set_coverage("basic", 1.5)), ["Basic coverage", "between 0 and 1"]),
    ("coverage_preventive_over_one", "/calculate", mutate(set_coverage("preventive", 1.01)),
     ["Preventive coverage"]),
    ("coverage_nan", "/calculate", raw_with('"basic": 0.8', '"basic": NaN'), ["Basic coverage", "real number"]),
    ("no_procedures", "/calculate", mutate(lambda b: b.update(procedures=[])), ["at least one procedure"]),
    ("too_many_procedures", "/calculate",
     mutate(lambda b: b.update(procedures=[b["procedures"][0] | {"id": f"f{i}"} for i in range(MAX_PROCEDURES + 1)])),
     ["at most 20 procedures"]),
    ("text_too_long", "/parse", {"text": "x" * (MAX_TEXT + 1)}, ["Text", "2,000 characters"]),
    ("text_empty", "/parse", {"text": ""}, ["Text", "empty"]),
    ("term_too_long", "/explain", {"term": "x" * (MAX_TERM + 1)}, ["Term", "200 characters"]),
    ("locked_move", "/calculate", maya_body() | {"schedule": {"crown2": "next_year"}}, ["locked", "dentist"]),
    ("crown_before_root_canal", "/calculate",
     maya_body("filling1", "filling2", "root_canal", "crown1", "crown2") | {"schedule": {"root_canal": "next_year"}},
     ["can't be scheduled before", "Root canal"]),
    ("bad_year", "/calculate", maya_body() | {"schedule": {"crown2": "someday"}},
     ["schedule", "this_year", "next_year"]),
    ("bad_id_characters", "/calculate", mutate(lambda b: b["procedures"][0].update(id="crown 1!")),
     ["Procedure 1 id", "letters, numbers, dashes and underscores"]),
    ("bad_depends_on_characters", "/calculate",
     mutate(lambda b: b["procedures"][3].update(depends_on="root canal")), ["Procedure 4", "letters, numbers"]),
    ("waived_list_too_long", "/calculate",
     mutate(lambda b: b["plan"].update(deductible_waived_for=["preventive", "basic", "major", "basic"])),
     ["skip the deductible", "at most 3"]),
    ("waived_list_repeats", "/calculate",
     mutate(lambda b: b["plan"].update(deductible_waived_for=["basic", "basic"])), ["only be listed once"]),
    ("bad_reset_date", "/calculate", mutate(lambda b: b["plan"].update(reset_date="13-01")),
     ["Reset date", "MM-DD"]),
    ("tooth_out_of_range", "/calculate", mutate(lambda b: b["procedures"][0].update(tooth=33)),
     ["Procedure 1 tooth number", "between 1 and 32"]),
    ("bad_category", "/calculate", mutate(lambda b: b["procedures"][0].update(category="cosmetic")),
     ["Procedure 1 category", "preventive"]),
    ("unknown_field", "/calculate", mutate(lambda b: b["procedures"][0].update(price=1)),
     ["Procedure 1", "field we don't recognize"]),
    ("missing_plan", "/optimize", mutate(lambda b: b.pop("plan")), ["Plan", "missing"]),
    ("used_more_than_max", "/calculate", mutate(lambda b: b["plan"].update(used_this_year=1501)),
     ["can't be more than the annual maximum"]),
    ("body_is_a_list", "/calculate", [1, 2], ["JSON object"]),
    ("broken_json", "/calculate", "{not json", ["valid JSON"]),
    ("missing_body", "/calculate", None, ["request body is missing"]),
]


def send(client: TestClient, path: str, payload: Any):
    if payload is None:
        return client.post(path)
    if isinstance(payload, str):
        return client.post(path, content=payload, headers={"Content-Type": "application/json"})
    return client.post(path, json=payload)


@pytest.mark.parametrize("path,payload,words", [c[1:] for c in BAD_INPUT], ids=[c[0] for c in BAD_INPUT])
def test_bad_input_returns_plain_english_422(client, path, payload, words):
    detail = assert_plain_422(send(client, path, payload))
    for word in words:
        assert word in detail, f"{word!r} not in {detail!r}"
    for jargon in TECHNICAL_WORDING:
        assert jargon not in detail, f"technical wording {jargon!r} in {detail!r}"


def test_bad_input_never_returns_500():
    safe_client = TestClient(app, raise_server_exceptions=False)
    for case_id, path, payload, _ in BAD_INPUT:
        assert send(safe_client, path, payload).status_code == 422, case_id


def test_unknown_field_name_is_not_echoed(client):
    body = maya_body()
    body["procedures"][0]["SNEAKY_FIELD_NAME"] = 1
    response = client.post("/calculate", json=body)
    assert_plain_422(response)
    assert "SNEAKY_FIELD_NAME" not in response.text


def test_more_problems_are_counted(client):
    body = mutate(set_fee(0, -1))
    body["procedures"][1]["billed_fee"] = -1
    detail = assert_plain_422(client.post("/calculate", json=body))
    assert detail.endswith("There are 2 more problems.")  # billed + allowed on #1, billed on #2


# ---------- Request size limit ----------


def test_oversized_request_is_rejected_with_plain_422(client):
    body = maya_body()
    body["procedures"][0]["name"] = "x" * 70_000
    detail = assert_plain_422(client.post("/calculate", json=body))
    assert "too large" in detail


def test_oversized_chunked_request_without_length_is_rejected(client):
    def chunks():
        yield b'{"text": "'
        for _ in range(100):
            yield b"x" * 1_000
        yield b'"}'

    response = client.post("/parse", content=chunks(), headers={"Content-Type": "application/json"})
    detail = assert_plain_422(response)
    assert "too large" in detail


def test_normal_sized_requests_pass_the_size_limit(client):
    body = maya_body()
    filling = body["procedures"][0]
    body["procedures"] = [filling | {"id": f"f{i}", "name": "x" * 200} for i in range(MAX_PROCEDURES)]
    body["schedule"] = {f"f{i}": "this_year" for i in range(MAX_PROCEDURES)}
    assert client.post("/calculate", json=body).status_code == 200


# ---------- Review fix (a): symptom words ----------


@pytest.mark.parametrize(
    "term",
    ["my toothache", "sore gums", "broken tooth", "tooth is sensitive", "throbbing", "swelling", "Toothaches"],
)
def test_symptom_words_get_the_safety_reply(client, term):
    response = client.post("/explain", json={"term": term})
    assert response.status_code == 200
    assert response.json()["text"] == SAFETY_REPLY


@pytest.mark.parametrize(
    "term", ["deductible", "annual maximum", "plan year", "coinsurance", "what the plan teaches", "sorry"]
)
def test_glossary_terms_are_not_mistaken_for_symptoms(term):
    assert explain(term) != SAFETY_REPLY


# ---------- Review fix (b): plan year wording ----------


def test_plan_year_uses_the_approved_reset_wording(client):
    text = client.post("/explain", json={"term": "plan year"}).json()["text"]
    assert (
        "When your plan year resets, eligible benefits may become available again, based on your plan's rules"
        in text
    )
    assert "start over" not in text


# ---------- Review fix (c): unexpected errors log one line, no body, no traceback ----------


def test_unexpected_error_returns_generic_500_and_logs_one_line(monkeypatch, caplog):
    def explode(*_args, **_kwargs):
        raise RuntimeError("SECRET-IN-EXCEPTION-MESSAGE")

    monkeypatch.setattr(main_module, "calculate", explode)
    caplog.set_level(logging.DEBUG)
    body = maya_body()
    body["procedures"][0]["name"] = "PRIVATE-MARKER"

    # Default client: if the error escapes to the server (which prints a full
    # traceback under uvicorn), TestClient re-raises it and this test fails.
    response = TestClient(app).post("/calculate", json=body)

    assert response.status_code == 500
    assert response.json() == {"detail": "Something went wrong on our side. Please try again."}
    errors = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert len(errors) == 1
    record = errors[0]
    assert record.exc_info is None
    assert "\n" not in record.getMessage()
    assert "RuntimeError" in record.getMessage()
    assert "/calculate" in record.getMessage()
    assert "Traceback" not in caplog.text
    assert "PRIVATE-MARKER" not in caplog.text
    assert "SECRET-IN-EXCEPTION-MESSAGE" not in caplog.text
