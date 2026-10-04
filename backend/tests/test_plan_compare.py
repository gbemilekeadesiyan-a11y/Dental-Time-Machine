"""Compare plan options (GET /plans, POST /filters/apply).

The user's care priced under each employer demo plan option, side by side.
It compares and never recommends: options are only sorted by the likely total.

Every figure comes from optimize() plus the premium helper. Maya's section 9
numbers must hold for the current plan option. Premiums are counted for the same
number of plan years for every option, so the sorted totals cover the same period.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.demo_data import PLAN_OPTIONS, maya_plan, maya_procedures
from app.engine import STANDING_WARNING
from app.main import app
from app.models import Plan, PlanOption, Procedure
from app.optimizer import optimize
from app.plan_compare import (
    MY_PLAN_ID,
    PREMIUM_NOT_ENTERED,
    annual_premium,
    compare_plans,
    premiums_for,
)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def crowns_can_wait() -> list[Procedure]:
    return [p.model_copy(update={"can_wait": p.id in ("crown1", "crown2")}) for p in maya_procedures()]


def body(procedures: list[Procedure], **extra: Any) -> dict[str, Any]:
    return {"procedures": [p.model_dump(mode="json") for p in procedures], **extra}


def by_id(rows: list[Any], option_id: str) -> Any:
    return next(r for r in rows if r.id == option_id)


# ---------- demo options ----------


class TestDemoOptions:
    def test_current_plan_is_maya_exactly(self):
        current = PLAN_OPTIONS[0]
        assert current.id == "current_plan"
        assert current.plan == maya_plan()
        assert current.source == "demo"

    def test_maya_plan_is_unchanged(self):
        # The premium lives on the option only, never on maya_plan() (section 9).
        assert maya_plan().annual_premium is None
        assert maya_plan().annual_max == 1500
        assert maya_plan().deductible == 50

    def test_names_are_generic_demo_names(self):
        assert len(PLAN_OPTIONS) == 3
        for option in PLAN_OPTIONS:
            assert option.name.endswith("(demo)")
            assert option.source == "demo"

    def test_ids_are_unique(self):
        ids = [o.id for o in PLAN_OPTIONS]
        assert len(ids) == len(set(ids))

    def test_get_plans(self, client):
        response = client.get("/plans")
        assert response.status_code == 200
        data = response.json()
        assert [o["id"] for o in data] == [o.id for o in PLAN_OPTIONS]
        assert data[0]["plan"] == maya_plan().model_dump(mode="json")


# ---------- the premium helper ----------


class TestPremiumHelper:
    def test_annual_premium_is_twelve_months(self):
        assert annual_premium(PLAN_OPTIONS[0].monthly_premium) == PLAN_OPTIONS[0].monthly_premium * 12

    def test_annual_premium_rounds_to_cents(self):
        assert annual_premium(33.33) == 399.96

    def test_premiums_for_plan_years(self):
        assert premiums_for(480, 1) == 480
        assert premiums_for(480, 2) == 960
        assert premiums_for(None, 2) is None


# ---------- Maya, section 9 ----------


class TestMayaNumbers:
    def test_current_plan_matches_section_9_when_crowns_can_wait(self):
        rows = compare_plans(crowns_can_wait(), PLAN_OPTIONS)
        current = by_id(rows, "current_plan")
        assert current.all_now_you_pay == 2500
        assert current.best_you_pay == 1975
        assert current.moved == ["crown2"]
        assert current.max_left.this_year == 100

    def test_current_plan_all_now_when_locked(self):
        current = by_id(compare_plans(maya_procedures(), PLAN_OPTIONS), "current_plan")
        assert current.all_now_you_pay == 2500
        assert current.best_you_pay == 2500
        assert current.moved == []

    @pytest.mark.parametrize("procedures", [maya_procedures(), crowns_can_wait()])
    def test_each_option_equals_a_direct_optimize_call(self, procedures):
        rows = compare_plans(procedures, PLAN_OPTIONS)
        for option in PLAN_OPTIONS:
            row = by_id(rows, option.id)
            direct = optimize(procedures, option.plan)
            assert row.all_now_you_pay == direct.all_now.totals.you_pay
            assert row.best_you_pay == direct.best.totals.you_pay
            assert row.moved == direct.moved
            assert row.max_left == direct.best.max_left
            assert row.plan == option.plan
            assert row.monthly_premium == option.monthly_premium


# ---------- the same period for every option ----------


class TestPeriodAndSorting:
    def test_one_plan_year_when_nothing_moves(self):
        rows = compare_plans(maya_procedures(), PLAN_OPTIONS)
        assert {r.plan_years for r in rows} == {1}

    def test_two_plan_years_for_every_option_when_any_moves(self):
        rows = compare_plans(crowns_can_wait(), PLAN_OPTIONS)
        assert any(r.moved for r in rows)
        assert any(not r.moved for r in rows)
        assert {r.plan_years for r in rows} == {2}

    @pytest.mark.parametrize("procedures", [maya_procedures(), crowns_can_wait()])
    def test_totals_are_care_plus_premiums_for_the_period(self, procedures):
        for row in compare_plans(procedures, PLAN_OPTIONS):
            assert row.annual_premium == annual_premium(row.monthly_premium)
            assert row.premiums_in_period == premiums_for(row.annual_premium, row.plan_years)
            assert row.year_total == round(row.best_you_pay + row.premiums_in_period, 2)

    @pytest.mark.parametrize("procedures", [maya_procedures(), crowns_can_wait()])
    def test_sorted_by_year_total(self, procedures):
        rows = compare_plans(procedures, PLAN_OPTIONS)
        totals = [r.year_total for r in rows]
        assert totals == sorted(totals)
        assert [r.sort_order for r in rows] == list(range(1, len(rows) + 1))

    def test_warnings_include_the_out_of_scope_note_once(self):
        for row in compare_plans(crowns_can_wait(), PLAN_OPTIONS):
            assert row.warnings.count(STANDING_WARNING) == 1


# ---------- the user's own plan ----------


class TestMyPlan:
    def test_my_plan_without_premium_is_listed_last_without_a_total(self):
        rows = compare_plans(maya_procedures(), PLAN_OPTIONS, my_plan=maya_plan())
        mine = rows[-1]
        assert mine.id == MY_PLAN_ID
        assert mine.source == "user"
        assert mine.monthly_premium is None
        assert mine.annual_premium is None
        assert mine.premiums_in_period is None
        assert mine.year_total is None
        assert PREMIUM_NOT_ENTERED in mine.warnings
        assert mine.best_you_pay == 2500

    def test_my_plan_with_premium_uses_it(self):
        premium = PLAN_OPTIONS[1].monthly_premium * 12  # A demo figure, reused.
        mine_plan = maya_plan().model_copy(update={"annual_premium": premium})
        rows = compare_plans(crowns_can_wait(), PLAN_OPTIONS, my_plan=mine_plan)
        mine = by_id(rows, MY_PLAN_ID)
        assert mine.annual_premium == premium
        assert mine.premiums_in_period == premium * mine.plan_years
        assert mine.year_total == mine.best_you_pay + mine.premiums_in_period


# ---------- POST /filters/apply ----------


class TestApplyRoute:
    def test_defaults_to_demo_options(self, client):
        response = client.post("/filters/apply", json=body(crowns_can_wait()))
        assert response.status_code == 200
        data = response.json()
        assert {r["id"] for r in data} == {o.id for o in PLAN_OPTIONS}
        current = next(r for r in data if r["id"] == "current_plan")
        assert current["best_you_pay"] == 1975
        assert current["all_now_you_pay"] == 2500

    def test_uses_the_options_sent(self, client):
        sent = [PLAN_OPTIONS[0].model_dump(mode="json")]
        data = client.post("/filters/apply", json=body(maya_procedures(), plan_options=sent)).json()
        assert [r["id"] for r in data] == ["current_plan"]

    def test_adds_my_plan(self, client):
        data = client.post(
            "/filters/apply", json=body(maya_procedures(), my_plan=maya_plan().model_dump(mode="json"))
        ).json()
        assert data[-1]["id"] == MY_PLAN_ID
        assert data[-1]["source"] == "user"
        assert data[-1]["year_total"] is None

    def test_empty_procedures_is_a_plain_422(self, client):
        response = client.post("/filters/apply", json=body([]))
        assert response.status_code == 422
        assert response.json() == {"detail": "Add at least one procedure."}

    def test_repeated_option_ids_are_a_plain_422(self, client):
        sent = [PLAN_OPTIONS[0].model_dump(mode="json")] * 2
        response = client.post("/filters/apply", json=body(maya_procedures(), plan_options=sent))
        assert response.status_code == 422
        assert "own id" in response.json()["detail"]

    def test_option_id_my_plan_is_reserved(self, client):
        sent = [PLAN_OPTIONS[0].model_copy(update={"id": MY_PLAN_ID}).model_dump(mode="json")]
        response = client.post("/filters/apply", json=body(maya_procedures(), plan_options=sent))
        assert response.status_code == 422

    def test_too_many_options_is_a_plain_422(self, client):
        sent = [PLAN_OPTIONS[0].model_copy(update={"id": f"o{i}"}).model_dump(mode="json") for i in range(6)]
        response = client.post("/filters/apply", json=body(maya_procedures(), plan_options=sent))
        assert response.status_code == 422
        assert "at most" in response.json()["detail"]

    def test_response_never_says_best_or_rank(self, client):
        data = client.post("/filters/apply", json=body(crowns_can_wait())).json()
        for row in data:
            assert "rank" not in row
            assert "recommended" not in row
            assert "sort_order" in row


def _plan_is_section_9(plan: Plan) -> bool:
    return plan.annual_max == 1500 and plan.deductible == 50


def test_demo_options_never_change_maya():
    assert _plan_is_section_9(PLAN_OPTIONS[0].plan)
    assert isinstance(PLAN_OPTIONS[0], PlanOption)
