"""Compare plan options: the user's care priced under each option (CLAUDE.md sections 7, 10).

Compares, never recommends. Each option's care cost comes from optimize(); the
only other figures are premiums, computed here in whole cents. Options are sorted
by the likely total, and that order is reported as sort_order, never as a rank.

Premiums cover the same number of plan years for every option: if any option's
best timing moves care into next plan year, every option counts two years of
premiums, so the totals compare the same period.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from app.engine import STANDING_WARNING, EngineError
from app.models import Plan, PlanComparison, PlanOption, Procedure
from app.optimizer import optimize

MY_PLAN_ID = "my_plan"
MY_PLAN_NAME = "Your plan"
PREMIUM_NOT_ENTERED = "Premium not entered, so this plan's total doesn't include premiums."


def _cents(dollars: float) -> int:
    return int((Decimal(str(dollars)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _dollars(cents: int) -> float:
    return cents / 100


def annual_premium(monthly_premium: float) -> float:
    """Twelve monthly premiums."""
    return _dollars(_cents(monthly_premium) * 12)


def premiums_for(annual: float | None, plan_years: int) -> float | None:
    """Premiums for the period compared, or None when the premium isn't known."""
    return None if annual is None else _dollars(_cents(annual) * plan_years)


def compare_plans(
    procedures: list[Procedure], options: list[PlanOption], my_plan: Plan | None = None
) -> list[PlanComparison]:
    """Price the care under each option, then sort by the likely total.

    Raises:
        EngineError: for repeated option ids, the reserved id "my_plan", or any engine error.
    """
    ids = [o.id for o in options]
    if len(ids) != len(set(ids)):
        raise EngineError("Each plan option needs its own id.")
    if MY_PLAN_ID in ids:
        raise EngineError(f"The plan option id '{MY_PLAN_ID}' is reserved for your own plan.")

    # (id, name, source, monthly premium, annual premium, plan)
    entries: list[tuple[str, str, str, float | None, float | None, Plan]] = [
        (o.id, o.name, o.source, o.monthly_premium, annual_premium(o.monthly_premium), o.plan) for o in options
    ]
    if my_plan is not None:
        entries.append((MY_PLAN_ID, MY_PLAN_NAME, "user", None, my_plan.annual_premium, my_plan))

    results = [optimize(procedures, plan) for *_, plan in entries]
    plan_years = 2 if any(r.moved for r in results) else 1

    rows: list[PlanComparison] = []
    for (option_id, name, source, monthly, annual, plan), result in zip(entries, results):
        premiums = premiums_for(annual, plan_years)
        best = result.best.totals.you_pay
        warnings = list(dict.fromkeys([*result.best.warnings, STANDING_WARNING]))
        if annual is None:
            warnings.append(PREMIUM_NOT_ENTERED)
        rows.append(
            PlanComparison(
                id=option_id,
                name=name,
                source=source,  # type: ignore[arg-type]
                monthly_premium=monthly,
                plan=plan,
                all_now_you_pay=result.all_now.totals.you_pay,
                best_you_pay=best,
                moved=result.moved,
                max_left=result.best.max_left,
                annual_premium=annual,
                plan_years=plan_years,
                premiums_in_period=premiums,
                year_total=None if premiums is None else _dollars(_cents(best) + _cents(premiums)),
                warnings=warnings,
                sort_order=0,
            )
        )

    # Lowest likely total first; options without a total last. Python's sort is stable,
    # so equal totals keep the order the options were given in.
    rows.sort(key=lambda r: (r.year_total is None, r.year_total or 0))
    return [r.model_copy(update={"sort_order": i}) for i, r in enumerate(rows, start=1)]
