"""Engine and optimizer tests.

The section 9 numbers in CLAUDE.md are the contract. If a code change breaks
one of the "Known-good numbers" tests, the code is wrong, not the test.
Never edit those expected values to make tests pass.

Every fee and coverage share used here comes from section 9 (via demo_data).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.demo_data import CROWN_FEE, FILLING_FEE, maya_plan, maya_procedures
from app.engine import EngineError, calculate
from app.models import (
    MAX_FEE,
    MAX_PROCEDURES,
    CalculateRequest,
    Coverage,
    LineResult,
    Plan,
    Procedure,
    Result,
)
from app.optimizer import optimize

ALL_NOW: dict[str, str] = {}  # Missing ids default to "this_year".
CROWN2_NEXT = {"crown2": "next_year"}


# ---------- helpers ----------


def with_can_wait(procedures: list[Procedure], *ids: str) -> list[Procedure]:
    """Return a copy where the given procedures are confirmed as able to wait."""
    return [p.model_copy(update={"can_wait": True}) if p.id in ids else p for p in procedures]


def line(result: Result, procedure_id: str) -> LineResult:
    return next(r for r in result.per_procedure if r.id == procedure_id)


@pytest.fixture
def procedures() -> list[Procedure]:
    return maya_procedures()


@pytest.fixture
def crowns_can_wait(procedures: list[Procedure]) -> list[Procedure]:
    return with_can_wait(procedures, "crown1", "crown2")


@pytest.fixture
def plan() -> Plan:
    return maya_plan()


# ---------- Section 9: known-good numbers ----------


class TestKnownGoodNumbers:
    def test_all_this_year_plan_pays_1500_you_pay_2500(self, procedures, plan):
        result = calculate(procedures, plan, ALL_NOW)
        assert result.totals.plan_pays == 1500
        assert result.totals.you_pay == 2500

    def test_crown2_next_year_plan_pays_1400_plus_625(self, crowns_can_wait, plan):
        result = calculate(crowns_can_wait, plan, CROWN2_NEXT)
        this_year = sum(r.plan_pays for r in result.per_procedure if r.year == "this_year")
        next_year = sum(r.plan_pays for r in result.per_procedure if r.year == "next_year")
        assert this_year == 1400
        assert next_year == 625
        assert result.totals.plan_pays == 2025
        assert result.totals.you_pay == 1975
        assert result.max_left.this_year == 100

    def test_optimize_with_crowns_able_to_wait_moves_crown2(self, crowns_can_wait, plan):
        result = optimize(crowns_can_wait, plan)
        assert result.best.totals.you_pay == 1975
        assert result.moved == ["crown2"]
        assert result.savings == 525
        assert result.best_schedule["crown2"] == "next_year"
        assert result.best_schedule["crown1"] == "this_year"

    def test_optimize_with_crowns_locked_keeps_everything_now(self, procedures, plan):
        result = optimize(procedures, plan)
        assert result.moved == []
        assert result.savings == 0
        assert result.best == result.all_now
        assert set(result.best_schedule.values()) == {"this_year"}

    def test_crown_scheduled_before_its_root_canal_is_rejected(self, plan):
        everything_can_wait = with_can_wait(
            maya_procedures(), "filling1", "filling2", "root_canal", "crown1", "crown2"
        )
        with pytest.raises(EngineError):
            calculate(everything_can_wait, plan, {"root_canal": "next_year"})

    def test_optimizer_never_puts_a_crown_before_its_root_canal(self, plan):
        everything_can_wait = with_can_wait(
            maya_procedures(), "filling1", "filling2", "root_canal", "crown1", "crown2"
        )
        result = optimize(everything_can_wait, plan)
        if result.best_schedule["root_canal"] == "next_year":
            assert result.best_schedule["crown1"] == "next_year"
            assert result.best_schedule["crown2"] == "next_year"


# ---------- Line-by-line breakdown and reasons ----------


class TestLineResults:
    def test_all_now_lines(self, procedures, plan):
        result = calculate(procedures, plan, ALL_NOW)
        # Processing order: basic before major, root canal before its crowns.
        assert (line(result, "filling1").deductible_applied, line(result, "filling1").plan_pays) == (50, 80)
        assert (line(result, "filling2").deductible_applied, line(result, "filling2").plan_pays) == (0, 120)
        assert line(result, "root_canal").plan_pays == 550
        assert line(result, "crown1").plan_pays == 650
        assert line(result, "crown2").plan_pays == 100  # Capped by the annual max.
        assert line(result, "crown2").you_pay == 1200
        assert result.max_left.this_year == 0
        assert result.max_left.next_year == 1500

    def test_all_now_reasons(self, procedures, plan):
        result = calculate(procedures, plan, ALL_NOW)
        assert line(result, "filling1").reasons == ["deductible", "coinsurance"]
        assert line(result, "filling2").reasons == ["coinsurance"]
        assert line(result, "root_canal").reasons == ["coinsurance"]
        assert line(result, "crown1").reasons == ["coinsurance"]
        assert line(result, "crown2").reasons == ["coinsurance", "over_annual_max"]

    def test_next_year_gets_a_fresh_deductible_and_max(self, crowns_can_wait, plan):
        result = calculate(crowns_can_wait, plan, CROWN2_NEXT)
        crown2 = line(result, "crown2")
        assert crown2.year == "next_year"
        assert crown2.deductible_applied == 50
        assert crown2.plan_pays == 625
        assert crown2.you_pay == 675
        assert crown2.reasons == ["deductible", "coinsurance"]
        assert result.max_left.next_year == 875

    def test_every_line_balances(self, crowns_can_wait, plan):
        result = calculate(crowns_can_wait, plan, CROWN2_NEXT)
        for r in result.per_procedure:
            assert r.plan_pays + r.you_pay == r.billed_fee
        assert result.totals.plan_pays == sum(r.plan_pays for r in result.per_procedure)
        assert result.totals.you_pay == sum(r.you_pay for r in result.per_procedure)

    def test_results_come_back_in_input_order(self, procedures, plan):
        result = calculate(procedures, plan, ALL_NOW)
        assert [r.id for r in result.per_procedure] == [p.id for p in procedures]

    def test_standing_warning_lists_unchecked_rules(self, procedures, plan):
        result = calculate(procedures, plan, ALL_NOW)
        text = " ".join(result.warnings).lower()
        for rule in ("waiting period", "frequency limit", "alternate benefit", "missing tooth"):
            assert rule in text


# ---------- Deductible rules ----------


class TestDeductible:
    def test_deductible_already_paid_is_not_charged_again(self, procedures, plan):
        paid = plan.model_copy(update={"deductible_paid_this_year": plan.deductible})
        result = calculate(procedures, paid, ALL_NOW)
        assert line(result, "filling1").deductible_applied == 0
        assert line(result, "filling1").plan_pays == FILLING_FEE * 0.8

    def test_preventive_skips_the_deductible(self, procedures, plan):
        # Reuse sourced figures: a filling-priced preventive item at the basic rate.
        cov = Coverage(preventive=0.8, basic=0.8, major=0.5)
        p_plan = plan.model_copy(update={"coverage": cov})
        procs = [p.model_copy(update={"category": "preventive"}) if p.id == "filling1" else p
                 for p in procedures]
        result = calculate(procs, p_plan, ALL_NOW)
        assert line(result, "filling1").deductible_applied == 0
        assert line(result, "filling1").reasons == ["coinsurance"]
        assert line(result, "filling2").deductible_applied == 50

    def test_deductible_larger_than_a_fee_carries_over(self, procedures, plan):
        big = plan.model_copy(update={"deductible": CROWN_FEE})
        result = calculate(procedures, big, ALL_NOW)
        assert line(result, "filling1").deductible_applied == FILLING_FEE
        assert line(result, "filling1").plan_pays == 0
        assert line(result, "filling2").deductible_applied == FILLING_FEE
        # 1300 - 150 - 150 = 1000 left for the root canal: (1100 - 1000) x 0.5.
        assert line(result, "root_canal").deductible_applied == 1000
        assert line(result, "root_canal").plan_pays == 50

    def test_used_this_year_shrinks_the_max(self, procedures, plan):
        used = plan.model_copy(update={"used_this_year": 1400})
        result = calculate(procedures, used, ALL_NOW)
        assert line(result, "filling1").plan_pays == 80
        assert line(result, "filling2").plan_pays == 20
        assert line(result, "filling2").reasons == ["coinsurance", "over_annual_max"]
        assert result.totals.plan_pays == 100
        assert result.max_left.this_year == 0


# ---------- Schedule validation ----------


class TestScheduleRules:
    def test_moving_a_locked_procedure_is_rejected(self, procedures, plan):
        with pytest.raises(EngineError, match="locked|can wait"):
            calculate(procedures, plan, CROWN2_NEXT)

    def test_unknown_procedure_in_schedule_is_rejected(self, procedures, plan):
        with pytest.raises(EngineError):
            calculate(procedures, plan, {"implant": "next_year"})

    def test_depends_on_a_missing_procedure_is_rejected(self, procedures, plan):
        procs = [p for p in procedures if p.id != "root_canal"]
        with pytest.raises(EngineError):
            calculate(procs, plan, ALL_NOW)

    def test_duplicate_ids_are_rejected(self, procedures, plan):
        with pytest.raises(EngineError):
            calculate(procedures + [procedures[0]], plan, ALL_NOW)

    def test_optimizer_refuses_more_than_eight_movable_procedures(self, plan):
        many = [
            Procedure(id=f"filling{i}", name="Filling", cdt_code="D2391", category="basic",
                      billed_fee=FILLING_FEE, allowed_fee=FILLING_FEE, can_wait=True)
            for i in range(9)
        ]
        with pytest.raises(EngineError):
            optimize(many, plan)

    def test_optimize_all_now_matches_calculate(self, crowns_can_wait, plan):
        result = optimize(crowns_can_wait, plan)
        assert result.all_now == calculate(crowns_can_wait, plan, ALL_NOW)


# ---------- Input validation (section 10 caps) ----------


class TestInputValidation:
    def test_allowed_fee_defaults_to_billed_fee(self):
        p = Procedure(id="f", name="Filling", cdt_code="D2391", category="basic", billed_fee=FILLING_FEE)
        assert p.allowed_fee == FILLING_FEE

    def test_fee_over_cap_is_rejected(self):
        with pytest.raises(ValidationError):
            Procedure(id="f", name="Filling", cdt_code="D2391", category="basic", billed_fee=MAX_FEE + 1)

    def test_negative_fee_is_rejected(self):
        with pytest.raises(ValidationError):
            Procedure(id="f", name="Filling", cdt_code="D2391", category="basic", billed_fee=-1)

    @pytest.mark.parametrize("tooth", [0, 33])
    def test_tooth_out_of_range_is_rejected(self, tooth):
        with pytest.raises(ValidationError):
            Procedure(id="f", name="Filling", cdt_code="D2391", category="basic",
                      billed_fee=FILLING_FEE, tooth=tooth)

    def test_coverage_over_100_percent_is_rejected(self):
        with pytest.raises(ValidationError):
            Coverage(preventive=1, basic=1.5, major=0.5)

    @pytest.mark.parametrize("bad_date", ["13-01", "1-1", "01/01", "00-10"])
    def test_bad_reset_date_is_rejected(self, plan, bad_date):
        data = plan.model_dump() | {"reset_date": bad_date}
        with pytest.raises(ValidationError):
            Plan(**data)

    def test_used_more_than_max_is_rejected(self, plan):
        data = plan.model_dump() | {"used_this_year": plan.annual_max + 1}
        with pytest.raises(ValidationError):
            Plan(**data)

    def test_more_than_twenty_procedures_is_rejected(self, plan):
        too_many = [
            Procedure(id=f"f{i}", name="Filling", cdt_code="D2391", category="basic", billed_fee=FILLING_FEE)
            for i in range(MAX_PROCEDURES + 1)
        ]
        with pytest.raises(ValidationError):
            CalculateRequest(procedures=too_many, plan=plan)

    def test_unknown_fields_are_rejected(self):
        with pytest.raises(ValidationError):
            Procedure(id="f", name="Filling", cdt_code="D2391", category="basic",
                      billed_fee=FILLING_FEE, price=FILLING_FEE)
