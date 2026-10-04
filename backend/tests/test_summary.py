"""Cash vs insurance comparison (CLAUDE.md section 8, Iyin's feature).

The engine fills Result.cash_comparison on every calculate. These tests check:
1. Maya's figures: cash 4000 (sum of billed fees) against the section 9 you_pay values.
2. cash_price replaces billed_fee when given.
3. Premiums: counted per plan year used when known; left out and flagged when unknown.
4. "about_equal" when the two totals are within 5% of each other.
5. The section 9 totals are unchanged.

Fees and premiums reuse the section 9 figures from demo_data; nothing is invented.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.demo_data import CROWN_FEE, FILLING_FEE, ROOT_CANAL_FEE, maya_plan, maya_procedures
from app.engine import PREMIUMS_NOT_INCLUDED, calculate
from app.main import app
from app.models import CashComparison, Coverage, Plan, Procedure
from app.optimizer import optimize

MAYA_CASH_TOTAL = 2 * FILLING_FEE + ROOT_CANAL_FEE + 2 * CROWN_FEE  # 4000: every billed fee, no self-pay prices.
CROWN2_NEXT = {"crown2": "next_year"}


def crowns_can_wait() -> list[Procedure]:
    return [p.model_copy(update={"can_wait": True}) if p.id in ("crown1", "crown2") else p for p in maya_procedures()]


def with_premium(premium: float) -> Plan:
    return maya_plan().model_copy(update={"annual_premium": premium})


def cash_of(procedures: list[Procedure], plan: Plan, schedule: dict[str, Any] | None = None) -> CashComparison:
    result = calculate(procedures, plan, schedule or {})
    assert result.cash_comparison is not None
    return result.cash_comparison


# ---------- 1. Maya ----------


class TestMaya:
    def test_all_now(self):
        cash = cash_of(maya_procedures(), maya_plan())
        assert cash.cash_total == MAYA_CASH_TOTAL == 4000
        assert cash.insurance_you_pay == 2500
        assert cash.premiums_in_period is None
        assert cash.cheaper == "insurance"

    def test_crown2_next_year(self):
        cash = cash_of(crowns_can_wait(), maya_plan(), CROWN2_NEXT)
        assert cash.cash_total == 4000
        assert cash.insurance_you_pay == 1975

    def test_insurance_you_pay_matches_totals(self):
        result = calculate(crowns_can_wait(), maya_plan(), CROWN2_NEXT)
        assert result.cash_comparison is not None
        assert result.cash_comparison.insurance_you_pay == result.totals.you_pay

    def test_section_9_totals_unchanged(self):
        assert calculate(maya_procedures(), maya_plan(), {}).totals.you_pay == 2500
        opt = optimize(crowns_can_wait(), maya_plan())
        assert opt.best.totals.you_pay == 1975
        assert opt.savings == 525
        assert opt.moved == ["crown2"]

    def test_optimize_results_carry_the_comparison(self):
        opt = optimize(crowns_can_wait(), maya_plan())
        assert opt.all_now.cash_comparison is not None
        assert opt.all_now.cash_comparison.insurance_you_pay == 2500
        assert opt.best.cash_comparison is not None
        assert opt.best.cash_comparison.insurance_you_pay == 1975


# ---------- 2. cash_price ----------


class TestCashPrice:
    def test_cash_price_replaces_billed_fee(self):
        procedures = [
            p.model_copy(update={"cash_price": FILLING_FEE}) if p.id == "root_canal" else p for p in maya_procedures()
        ]
        cash = cash_of(procedures, maya_plan())
        assert cash.cash_total == MAYA_CASH_TOTAL - ROOT_CANAL_FEE + FILLING_FEE

    def test_cash_cheaper_when_self_pay_prices_are_low(self):
        procedures = [p.model_copy(update={"cash_price": FILLING_FEE}) for p in maya_procedures()]
        cash = cash_of(procedures, maya_plan())
        assert cash.cash_total == 5 * FILLING_FEE
        assert cash.cheaper == "cash"

    def test_assumption_names_which_price_was_used(self):
        all_billed = cash_of(maya_procedures(), maya_plan())
        assert any("billed fee" in a for a in all_billed.assumptions)
        procedures = [p.model_copy(update={"cash_price": FILLING_FEE}) for p in maya_procedures()]
        all_self_pay = cash_of(procedures, maya_plan())
        assert not any("billed fee" in a for a in all_self_pay.assumptions)


# ---------- 3. premiums ----------


class TestPremiums:
    def test_unknown_premium_is_flagged(self):
        cash = cash_of(maya_procedures(), maya_plan())
        assert cash.premiums_in_period is None
        assert PREMIUMS_NOT_INCLUDED in cash.assumptions

    def test_known_premium_one_plan_year(self):
        cash = cash_of(maya_procedures(), with_premium(FILLING_FEE))
        assert cash.premiums_in_period == FILLING_FEE
        assert PREMIUMS_NOT_INCLUDED not in cash.assumptions
        assert cash.cheaper == "insurance"  # 2500 + 150 against 4000.

    def test_known_premium_two_plan_years(self):
        cash = cash_of(crowns_can_wait(), with_premium(FILLING_FEE), CROWN2_NEXT)
        assert cash.premiums_in_period == 2 * FILLING_FEE

    def test_premiums_can_make_cash_cheaper(self):
        # 1975 + 2 x 1300 = 4575 against 4000.
        cash = cash_of(crowns_can_wait(), with_premium(CROWN_FEE), CROWN2_NEXT)
        assert cash.premiums_in_period == 2 * CROWN_FEE
        assert cash.cheaper == "cash"

    def test_zero_premium_counts_as_known(self):
        cash = cash_of(maya_procedures(), with_premium(0))
        assert cash.premiums_in_period == 0
        assert PREMIUMS_NOT_INCLUDED not in cash.assumptions


# ---------- 4. about equal ----------


class TestAboutEqual:
    def test_exactly_five_percent_apart_is_about_equal(self):
        # 2500 + 1300 = 3800 against 4000: 200 is 5% of 4000.
        cash = cash_of(maya_procedures(), with_premium(CROWN_FEE))
        assert cash.cheaper == "about_equal"

    def test_identical_totals_are_about_equal(self):
        no_coverage = maya_plan().model_copy(update={"coverage": Coverage(preventive=0, basic=0, major=0)})
        cash = cash_of(maya_procedures(), no_coverage)
        assert cash.insurance_you_pay == cash.cash_total
        assert cash.cheaper == "about_equal"

    def test_all_zero_is_about_equal(self):
        procedures = [p.model_copy(update={"billed_fee": 0, "allowed_fee": 0}) for p in maya_procedures()]
        cash = cash_of(procedures, maya_plan())
        assert cash.cash_total == 0
        assert cash.cheaper == "about_equal"


# ---------- 5. wording and API ----------


class TestWordingAndApi:
    def test_assumptions_are_plain_sentences_without_dollar_amounts(self):
        for plan in (maya_plan(), with_premium(FILLING_FEE)):
            for a in cash_of(maya_procedures(), plan).assumptions:
                assert a.endswith(".")
                assert "$" not in a
                assert not any(ch.isdigit() for ch in a.replace("5%", ""))

    @pytest.fixture
    def client(self) -> TestClient:
        return TestClient(app)

    def test_calculate_returns_cash_comparison(self, client):
        body = {
            "procedures": [p.model_dump(mode="json") for p in maya_procedures()],
            "plan": maya_plan().model_dump(mode="json"),
        }
        data = client.post("/calculate", json=body).json()
        assert data["totals"] == {"plan_pays": 1500, "you_pay": 2500}
        assert data["cash_comparison"]["cash_total"] == 4000
        assert data["cash_comparison"]["insurance_you_pay"] == 2500
        assert data["cash_comparison"]["premiums_in_period"] is None
        assert data["cash_comparison"]["cheaper"] == "insurance"
