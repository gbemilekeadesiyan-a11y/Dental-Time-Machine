"""Cost engine: the only place dollar amounts are computed (CLAUDE.md section 2).

Rules are in CLAUDE.md section 8. Money math runs in whole cents so float
rounding never drifts. Results are converted back to dollars at the edge.
"""

from __future__ import annotations

import heapq
from decimal import ROUND_HALF_UP, Decimal

from app.models import (
    CashComparison,
    LineResult,
    MaxLeft,
    Plan,
    Procedure,
    Reason,
    Result,
    Schedule,
    Totals,
    Year,
)

CATEGORY_RANK = {"preventive": 0, "basic": 1, "major": 2}
YEARS: tuple[Year, Year] = ("this_year", "next_year")

STANDING_WARNING = (
    "Not checked yet: waiting periods, frequency limits, alternate benefit rules, "
    "and missing tooth clauses. Confirm these with your plan."
)

# Cash vs insurance (CLAUDE.md section 8). Totals this close are "about_equal".
ABOUT_EQUAL_SHARE = Decimal("0.05")
PREMIUMS_NOT_INCLUDED = (
    "Premiums not included, because the plan's premium wasn't entered. "
    "What you pay for the plan itself is not counted on the insurance side."
)
CASH_USES_BILLED_FEE = "Where no self-pay price was entered, the cash price is the dentist's full billed fee."
CASH_USES_SELF_PAY = "Uses the self-pay prices you entered."
ABOUT_EQUAL_NOTE = "Totals within 5% of each other are shown as about equal."
CASH_ESTIMATE_NOTE = "Both are estimates. Ask your dentist for their self-pay price and confirm with your plan."


class EngineError(ValueError):
    """Bad input the user can fix. Routes turn this into a 422 with this message."""


# ---------- money helpers ----------


def _to_cents(dollars: float) -> int:
    return int((Decimal(str(dollars)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _to_dollars(cents: int) -> float:
    return cents / 100


def _share_of(cents: int, share: float) -> int:
    return int((Decimal(cents) * Decimal(str(share))).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


# ---------- ordering and validation ----------


def processing_order(procedures: list[Procedure]) -> list[Procedure]:
    """Order procedures by category, then after the one they depend on, then by id.

    Uses a topological sort keyed on (category rank, id), so a crown always
    comes after its root canal even though "crown" sorts before "root_canal".

    Raises:
        EngineError: if ids repeat, a dependency is missing, or dependencies loop.
    """
    by_id: dict[str, Procedure] = {}
    for p in procedures:
        if p.id in by_id:
            raise EngineError(f"Two procedures share the id '{p.id}'. Each one needs its own id.")
        by_id[p.id] = p

    waiting_on: dict[str, int] = {p.id: 0 for p in procedures}
    dependents: dict[str, list[str]] = {p.id: [] for p in procedures}
    for p in procedures:
        if p.depends_on is None:
            continue
        if p.depends_on == p.id:
            raise EngineError(f"'{p.name}' can't depend on itself.")
        if p.depends_on not in by_id:
            raise EngineError(f"'{p.name}' depends on '{p.depends_on}', which isn't in the list.")
        waiting_on[p.id] += 1
        dependents[p.depends_on].append(p.id)

    def key(pid: str) -> tuple[int, str]:
        return (CATEGORY_RANK[by_id[pid].category], pid)

    ready = [key(pid) for pid, n in waiting_on.items() if n == 0]
    heapq.heapify(ready)
    ordered: list[Procedure] = []
    while ready:
        _, pid = heapq.heappop(ready)
        ordered.append(by_id[pid])
        for child in dependents[pid]:
            waiting_on[child] -= 1
            if waiting_on[child] == 0:
                heapq.heappush(ready, key(child))

    if len(ordered) != len(procedures):
        raise EngineError("Some procedures depend on each other in a loop.")
    return ordered


def resolve_schedule(procedures: list[Procedure], schedule: Schedule) -> dict[str, Year]:
    """Fill in missing ids as "this_year" and check the schedule is allowed.

    Raises:
        EngineError: for unknown ids, a locked procedure moved to next year,
            or a procedure placed in an earlier year than the one it depends on.
    """
    by_id = {p.id: p for p in procedures}
    unknown = sorted(set(schedule) - set(by_id))
    if unknown:
        raise EngineError(f"The schedule mentions procedures that aren't in the list: {', '.join(unknown)}.")

    years: dict[str, Year] = {p.id: schedule.get(p.id, "this_year") for p in procedures}

    for p in procedures:
        if years[p.id] == "next_year" and not p.can_wait:
            raise EngineError(
                f"'{p.name}' is locked. Confirm with your dentist that it can wait before moving it."
            )
        if p.depends_on is not None and p.depends_on in years:
            if YEARS.index(years[p.id]) < YEARS.index(years[p.depends_on]):
                needed = by_id[p.depends_on].name
                raise EngineError(f"'{p.name}' can't be scheduled before '{needed}', which it depends on.")
    return years


# ---------- the engine ----------


def calculate(procedures: list[Procedure], plan: Plan, schedule: Schedule) -> Result:
    """Estimate what the plan pays and what the user pays for a schedule.

    Args:
        procedures: The recommended procedures.
        plan: The user's plan details.
        schedule: Procedure id to plan year. Missing ids mean "this_year".

    Returns:
        A Result with one LineResult per procedure, in the same order as the input.

    Raises:
        EngineError: if the procedures or schedule are invalid.
    """
    ordered = processing_order(procedures)
    years = resolve_schedule(procedures, schedule)

    max_left = {
        "this_year": _to_cents(plan.annual_max) - _to_cents(plan.used_this_year),
        "next_year": _to_cents(plan.annual_max),
    }
    deductible_left = {
        "this_year": _to_cents(plan.deductible) - _to_cents(plan.deductible_paid_this_year),
        "next_year": _to_cents(plan.deductible),
    }

    lines: dict[str, LineResult] = {}
    for year in YEARS:
        for p in (p for p in ordered if years[p.id] == year):
            billed = _to_cents(p.billed_fee)
            allowed = _to_cents(p.allowed_fee)
            share = getattr(plan.coverage, p.category)
            reasons: list[Reason] = []

            deductible_applied = 0
            if p.category not in plan.deductible_waived_for and share > 0:
                deductible_applied = min(deductible_left[year], allowed)
                deductible_left[year] -= deductible_applied
            if deductible_applied > 0:
                reasons.append("deductible")

            if share == 0:
                reasons.append("not_covered")
            elif share < 1:
                reasons.append("coinsurance")

            plan_share = _share_of(allowed - deductible_applied, share)
            plan_pays = min(plan_share, max_left[year])
            max_left[year] -= plan_pays
            if plan_pays < plan_share:
                reasons.append("over_annual_max")

            if billed > allowed:
                reasons.append("balance_bill")

            lines[p.id] = LineResult(
                id=p.id,
                year=year,
                billed_fee=_to_dollars(billed),
                allowed_fee=_to_dollars(allowed),
                deductible_applied=_to_dollars(deductible_applied),
                plan_pays=_to_dollars(plan_pays),
                you_pay=_to_dollars(billed - plan_pays),
                reasons=reasons,
            )

    per_procedure = [lines[p.id] for p in procedures]
    plan_total = sum(_to_cents(r.plan_pays) for r in per_procedure)
    you_total = sum(_to_cents(r.you_pay) for r in per_procedure)

    return Result(
        per_procedure=per_procedure,
        totals=Totals(plan_pays=_to_dollars(plan_total), you_pay=_to_dollars(you_total)),
        max_left=MaxLeft(
            this_year=_to_dollars(max_left["this_year"]),
            next_year=_to_dollars(max_left["next_year"]),
        ),
        warnings=[STANDING_WARNING],
        cash_comparison=cash_comparison(procedures, plan, years, you_total),
    )


def cash_comparison(
    procedures: list[Procedure], plan: Plan, years: dict[str, Year], insurance_cents: int
) -> CashComparison:
    """Compare paying cash for the same care against using the plan (CLAUDE.md section 8).

    Cash is each procedure's cash_price, or its billed_fee when none was given.
    The insurance side is what the user pays under this schedule, plus the plan's
    annual premium for each plan year the schedule uses, when the premium is known.
    Without a premium, the comparison is out-of-pocket only and says so.
    """
    cash_cents = sum(_to_cents(p.billed_fee if p.cash_price is None else p.cash_price) for p in procedures)

    assumptions: list[str] = []
    if any(p.cash_price is None for p in procedures):
        assumptions.append(CASH_USES_BILLED_FEE)
    else:
        assumptions.append(CASH_USES_SELF_PAY)

    premium_cents: int | None = None
    if plan.annual_premium is None:
        assumptions.append(PREMIUMS_NOT_INCLUDED)
    else:
        plan_years = len(set(years.values())) or 1
        premium_cents = _to_cents(plan.annual_premium) * plan_years
        assumptions.append(
            "Includes the plan premium for two plan years, because some care is in next plan year."
            if plan_years == 2
            else "Includes the plan premium for one plan year."
        )

    insurance_total = insurance_cents + (premium_cents or 0)
    gap = abs(cash_cents - insurance_total)
    if gap <= ABOUT_EQUAL_SHARE * max(cash_cents, insurance_total):
        cheaper = "about_equal"
    elif cash_cents < insurance_total:
        cheaper = "cash"
    else:
        cheaper = "insurance"

    assumptions += [ABOUT_EQUAL_NOTE, CASH_ESTIMATE_NOTE]
    return CashComparison(
        cash_total=_to_dollars(cash_cents),
        insurance_you_pay=_to_dollars(insurance_cents),
        premiums_in_period=None if premium_cents is None else _to_dollars(premium_cents),
        cheaper=cheaper,
        assumptions=assumptions,
    )
