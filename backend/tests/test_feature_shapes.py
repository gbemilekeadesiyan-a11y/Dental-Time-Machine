"""Feature shapes from CLAUDE.md section 6 ("Feature additions").

Shapes only: the engine doesn't compute cash_comparison, alternatives or the
budget filter yet. These tests check that:
1. Maya's existing JSON is unchanged (new optional fields stay out of responses until set).
2. Each new shape accepts valid data and rejects bad data with a 422 or ValidationError.

Fees reuse the section 9 figures from demo_data; caps come from models.py.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import app.models as m
from app.demo_data import CROWN_FEE, FILLING_FEE, maya_plan, maya_procedures
from app.engine import calculate
from app.main import app
from app.optimizer import optimize


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def maya_json(*can_wait: str) -> dict[str, Any]:
    procedures = [p.model_dump(mode="json") for p in maya_procedures()]
    for p in procedures:
        if p["id"] in can_wait:
            p["can_wait"] = True
    return {"procedures": procedures, "plan": maya_plan().model_dump(mode="json")}


def preferences(**overrides: Any) -> dict[str, Any]:
    return {"language": "en", "style": "simple", "voice_on": False} | overrides


def turns(n: int) -> list[dict[str, str]]:
    return [{"role": "user" if i % 2 == 0 else "assistant", "text": f"turn {i}"} for i in range(n)]


# ======================================================================
# 1. Maya's existing JSON is unchanged
# ======================================================================

PROCEDURE_KEYS = {"id", "name", "cdt_code", "category", "tooth", "billed_fee", "allowed_fee", "depends_on", "can_wait"}
PLAN_KEYS = {
    "annual_max", "deductible", "deductible_waived_for", "coverage", "reset_date",
    "used_this_year", "deductible_paid_this_year", "in_network",
}


class TestMayaUnchanged:
    def test_demo_procedure_and_plan_keys_are_unchanged(self, client):
        data = client.get("/demo").json()
        assert all(set(p) == PROCEDURE_KEYS for p in data["procedures"])
        assert set(data["plan"]) == PLAN_KEYS

    def test_calculate_has_no_cash_comparison_yet(self, client):
        data = client.post("/calculate", json=maya_json()).json()
        assert set(data) == {"per_procedure", "totals", "max_left", "warnings"}
        assert data["totals"] == {"plan_pays": 1500, "you_pay": 2500}

    def test_optimize_has_no_alternatives_yet(self, client):
        data = client.post("/optimize", json=maya_json("crown1", "crown2")).json()
        assert set(data) == {"all_now", "best", "best_schedule", "savings", "moved"}
        assert data["best"]["totals"]["you_pay"] == 1975
        assert data["moved"] == ["crown2"]
        assert data["savings"] == 525

    def test_engine_results_leave_new_fields_unset(self):
        result = calculate(maya_procedures(), maya_plan(), {})
        assert result.cash_comparison is None
        opt = optimize(maya_procedures(), maya_plan())
        assert opt.alternatives is None

    def test_budget_is_accepted_but_not_applied_yet(self, client):
        body = maya_json("crown1", "crown2") | {"budget_this_year": FILLING_FEE}
        data = client.post("/optimize", json=body).json()
        assert data["best"]["totals"]["you_pay"] == 1975  # Same as without a budget: logic not built yet.


# ======================================================================
# 2. New optional fields on existing shapes
# ======================================================================


class TestOptionalAdditions:
    def test_procedure_cash_price_is_optional_and_hidden_when_unset(self):
        p = maya_procedures()[0]
        assert p.cash_price is None
        assert "cash_price" not in p.model_dump(mode="json")

    def test_procedure_cash_price_round_trips_when_set(self):
        data = maya_procedures()[0].model_dump(mode="json") | {"cash_price": FILLING_FEE}
        p = m.Procedure(**data)
        assert p.model_dump(mode="json")["cash_price"] == FILLING_FEE

    @pytest.mark.parametrize("bad", [-1, m.MAX_FEE + 1, True, "150"], ids=["negative", "over_cap", "bool", "string"])
    def test_procedure_cash_price_rejects_bad_values(self, bad):
        data = maya_procedures()[0].model_dump(mode="json") | {"cash_price": bad}
        with pytest.raises(ValidationError):
            m.Procedure(**data)

    def test_plan_annual_premium_is_optional_and_hidden_when_unset(self):
        plan = maya_plan()
        assert plan.annual_premium is None
        assert "annual_premium" not in plan.model_dump(mode="json")

    def test_plan_annual_premium_accepted_and_rejected(self):
        data = maya_plan().model_dump(mode="json")
        assert m.Plan(**data | {"annual_premium": CROWN_FEE}).annual_premium == CROWN_FEE
        with pytest.raises(ValidationError):
            m.Plan(**data | {"annual_premium": -1})

    def test_optimize_request_budget(self):
        body = maya_json()
        assert m.OptimizeRequest(**body).budget_this_year is None
        assert m.OptimizeRequest(**body | {"budget_this_year": CROWN_FEE}).budget_this_year == CROWN_FEE
        with pytest.raises(ValidationError):
            m.OptimizeRequest(**body | {"budget_this_year": m.MAX_FEE + 1})

    def test_budget_over_cap_is_a_plain_422(self, client):
        response = client.post("/optimize", json=maya_json() | {"budget_this_year": -5})
        assert response.status_code == 422
        assert response.json()["detail"] == "Budget this year must be between 0 and 50,000."

    def test_new_money_fields_get_plain_labels(self, client):
        body = maya_json()
        body["procedures"][0]["cash_price"] = -1
        assert client.post("/calculate", json=body).json()["detail"] == "Procedure 1 cash price must be between 0 and 50,000."
        body = maya_json()
        body["plan"]["annual_premium"] = -1
        assert client.post("/calculate", json=body).json()["detail"] == "Annual premium must be between 0 and 50,000."

    def test_optimize_result_alternatives(self):
        opt = optimize(maya_procedures(), maya_plan())
        alt = {"schedule": {}, "you_pay": opt.best.totals.you_pay, "moved": []}
        five = opt.model_copy(update={"alternatives": [m.Alternative(**alt)] * 5})
        assert len(five.model_dump(mode="json")["alternatives"]) == 5
        with pytest.raises(ValidationError):
            m.OptimizeResult(**opt.model_dump(mode="json") | {"alternatives": [alt] * 6})

    def test_result_cash_comparison_round_trips(self):
        result = calculate(maya_procedures(), maya_plan(), {})
        cash = {
            "cash_total": result.totals.you_pay,
            "insurance_you_pay": result.totals.you_pay,
            "premiums_in_period": None,
            "cheaper": "about_equal",
            "assumptions": ["Cash price equals the billed fee."],
        }
        data = result.model_dump(mode="json") | {"cash_comparison": cash}
        assert m.Result(**data).model_dump(mode="json")["cash_comparison"]["cheaper"] == "about_equal"


# ======================================================================
# 3. New shapes: valid data accepted, bad data rejected
# ======================================================================


class TestPreferences:
    @pytest.mark.parametrize("language", ["en", "es", "fr", "pt"])
    def test_valid_languages(self, language):
        assert m.Preferences(**preferences(language=language)).language == language

    @pytest.mark.parametrize("style", ["simple", "detailed", "numbers"])
    def test_valid_styles(self, style):
        assert m.Preferences(**preferences(style=style)).style == style

    @pytest.mark.parametrize("bad", [{"language": "de"}, {"style": "plain"}, {"voice_on": None}, {"extra": 1}])
    def test_rejects_bad_values(self, bad):
        with pytest.raises(ValidationError):
            m.Preferences(**preferences(**bad))


class TestChat:
    def test_chat_turn(self):
        assert m.ChatTurn(role="assistant", text="Hi").role == "assistant"
        for bad in [{"role": "system", "text": "x"}, {"role": "user", "text": ""}, {"role": "user", "text": "x" * (m.MAX_TEXT + 1)}]:
            with pytest.raises(ValidationError):
                m.ChatTurn(**bad)

    def test_chat_request_accepts_20_turns_and_no_plan(self):
        req = m.ChatRequest(turns=turns(m.MAX_CHAT_TURNS), preferences=preferences(), procedures=[], plan=None)
        assert len(req.turns) == 20
        assert req.plan is None

    def test_chat_request_rejects_21_turns(self):
        with pytest.raises(ValidationError):
            m.ChatRequest(turns=turns(m.MAX_CHAT_TURNS + 1), preferences=preferences(), procedures=[], plan=None)

    def test_chat_request_rejects_21_procedures(self):
        procs = [maya_procedures()[0].model_copy(update={"id": f"f{i}"}) for i in range(m.MAX_PROCEDURES + 1)]
        with pytest.raises(ValidationError):
            m.ChatRequest(turns=turns(1), preferences=preferences(), procedures=procs, plan=None)

    def test_chat_request_requires_preferences_and_plan_key(self):
        with pytest.raises(ValidationError):
            m.ChatRequest(turns=turns(1), procedures=[], plan=None)
        with pytest.raises(ValidationError):
            m.ChatRequest(turns=turns(1), preferences=preferences(), procedures=[])

    def test_chat_response(self):
        res = m.ChatResponse(say="Thanks.", proposed_procedures=maya_procedures(), proposed_can_wait=["crown2"], done_intake=False)
        assert res.proposed_can_wait == ["crown2"]
        with pytest.raises(ValidationError):
            m.ChatResponse(say="x", proposed_procedures=[], proposed_can_wait=["crown 2!"], done_intake=False)
        with pytest.raises(ValidationError):
            m.ChatResponse(say="x", proposed_procedures=[], proposed_can_wait=[])  # done_intake missing


class TestSummary:
    def test_summary_request_accepts_engine_output(self):
        opt = optimize(maya_procedures(), maya_plan())
        req = m.SummaryRequest(
            procedures=maya_procedures(), plan=maya_plan(), schedule={}, optimize=opt, preferences=preferences()
        )
        assert req.optimize.best.totals.you_pay == 2500

    def test_summary_request_rejects_missing_optimize_and_empty_procedures(self):
        opt = optimize(maya_procedures(), maya_plan())
        with pytest.raises(ValidationError):
            m.SummaryRequest(procedures=maya_procedures(), plan=maya_plan(), schedule={}, preferences=preferences())
        with pytest.raises(ValidationError):
            m.SummaryRequest(procedures=[], plan=maya_plan(), schedule={}, optimize=opt, preferences=preferences())

    def test_summary_response(self):
        assert m.SummaryResponse(text="Plain summary.").text == "Plain summary."
        with pytest.raises(ValidationError):
            m.SummaryResponse()


class TestDocumentReadResult:
    def test_valid_with_and_without_plan(self):
        found = m.DocumentReadResult(plan=maya_plan(), procedures=maya_procedures(), fields_found=["annual_max"], warnings=[])
        assert found.plan is not None
        empty = m.DocumentReadResult(plan=None, procedures=[], fields_found=[], warnings=["Couldn't read the deductible."])
        assert empty.plan is None

    def test_rejects_21_procedures(self):
        procs = [maya_procedures()[0].model_copy(update={"id": f"f{i}"}) for i in range(m.MAX_PROCEDURES + 1)]
        with pytest.raises(ValidationError):
            m.DocumentReadResult(plan=None, procedures=procs, fields_found=[], warnings=[])


def filter_state(**overrides: Any) -> dict[str, Any]:
    return {
        "zip": "27401",
        "age_range": "18_64",
        "max_distance_miles": 10,
        "in_network_only": True,
        "preferred_plan_id": "demo_plan",
        "languages": ["English", "Spanish"],
        "budget_this_year": CROWN_FEE,
    } | overrides


class TestFilterState:
    def test_valid(self):
        f = m.FilterState(**filter_state())
        assert f.zip == "27401"

    @pytest.mark.parametrize("age", ["under_18", "18_64", "65_plus"])
    def test_age_ranges(self, age):
        assert m.FilterState(**filter_state(age_range=age)).age_range == age

    @pytest.mark.parametrize(
        "bad",
        [
            {"zip": "274011"},  # 6 digits
            {"zip": "2740"},
            {"zip": "2740a"},
            {"zip": 27401},
            {"age_range": "adult"},
            {"max_distance_miles": 0},
            {"max_distance_miles": -1},
            {"max_distance_miles": m.MAX_DISTANCE_MILES + 1},
            {"budget_this_year": m.MAX_FEE + 1},
            {"budget_this_year": -1},
            {"preferred_plan_id": "plan one!"},
            {"languages": ["x" * 41]},
            {"languages": ["English"] * (m.MAX_LANGUAGES + 1)},
        ],
        ids=lambda b: next(iter(b)) + "=" + str(next(iter(b.values())))[:12],
    )
    def test_rejects_bad_values(self, bad):
        with pytest.raises(ValidationError):
            m.FilterState(**filter_state(**bad))


class TestPlanOption:
    def test_valid(self):
        option = m.PlanOption(id="demo_plan", name="Demo plan", monthly_premium=FILLING_FEE, plan=maya_plan(), source="demo")
        assert option.source == "demo"

    @pytest.mark.parametrize("bad", [{"source": "partner"}, {"monthly_premium": -1}, {"id": ""}, {"name": ""}])
    def test_rejects_bad_values(self, bad):
        data = {"id": "demo_plan", "name": "Demo plan", "monthly_premium": FILLING_FEE, "plan": maya_plan(), "source": "user"}
        with pytest.raises(ValidationError):
            m.PlanOption(**data | bad)

    def test_nested_plan_is_validated(self):
        bad_plan = maya_plan().model_dump(mode="json") | {"reset_date": "13-01"}
        with pytest.raises(ValidationError):
            m.PlanOption(id="p", name="P", monthly_premium=FILLING_FEE, plan=bad_plan, source="user")


class TestDentistListing:
    def valid(self, **overrides: Any) -> dict[str, Any]:
        return {
            "npi": "1234567890",
            "name": "Demo Dental",
            "address": "1 Demo Street",
            "distance_miles": 2.5,
            "in_network": True,
            "languages": ["English"],
            "accepting_new": True,
        } | overrides

    def test_valid(self):
        assert m.DentistListing(**self.valid()).npi == "1234567890"

    @pytest.mark.parametrize("bad", [{"npi": "123456789"}, {"npi": "12345678901"}, {"npi": "12345abcde"}, {"distance_miles": -1}])
    def test_rejects_bad_values(self, bad):
        with pytest.raises(ValidationError):
            m.DentistListing(**self.valid(**bad))


class TestCashComparison:
    def valid(self, **overrides: Any) -> dict[str, Any]:
        return {
            "cash_total": CROWN_FEE,
            "insurance_you_pay": CROWN_FEE,
            "premiums_in_period": None,
            "cheaper": "insurance",
            "assumptions": [],
        } | overrides

    @pytest.mark.parametrize("cheaper", ["cash", "insurance", "about_equal"])
    def test_valid(self, cheaper):
        assert m.CashComparison(**self.valid(cheaper=cheaper)).cheaper == cheaper

    def test_premiums_can_be_a_number(self):
        assert m.CashComparison(**self.valid(premiums_in_period=FILLING_FEE)).premiums_in_period == FILLING_FEE

    @pytest.mark.parametrize("bad", [{"cheaper": "maybe"}, {"assumptions": None}])
    def test_rejects_bad_values(self, bad):
        with pytest.raises(ValidationError):
            m.CashComparison(**self.valid(**bad))
