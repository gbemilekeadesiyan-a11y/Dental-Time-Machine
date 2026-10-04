"""Cost engine: the only place dollar amounts are computed (CLAUDE.md section 2).

Rules are in CLAUDE.md section 8. Money math runs in whole cents so float
rounding never drifts. Results are converted back to dollars at the edge.
"""

from __future__ import annotations

import heapq
from decimal import ROUND_HALF_UP, Decimal

from app.models import (
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
    )
