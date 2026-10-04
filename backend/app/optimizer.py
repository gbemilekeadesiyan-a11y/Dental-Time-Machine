"""Schedule optimizer (CLAUDE.md section 8).

Tries every way of splitting the movable procedures across the two plan years
and keeps the cheapest one for the user. All dollar amounts come from the engine.
"""

from __future__ import annotations

from itertools import product

from app.engine import EngineError, calculate, processing_order
from app.models import OptimizeResult, Plan, Procedure, Result, Schedule

MAX_MOVABLE = 8


def _cents(dollars: float) -> int:
    return round(dollars * 100)


def optimize(procedures: list[Procedure], plan: Plan) -> OptimizeResult:
    """Find the schedule where the user likely pays the least.

    Only procedures the user confirmed can wait are ever moved. Ties are broken by
    fewest procedures moved, then by preferring to move procedures that come later
    in processing order (so Maya's second crown moves, not her first).

    Raises:
        EngineError: if the input is invalid or more than 8 procedures can wait.
    """
    ordered = processing_order(procedures)
    position = {p.id: i for i, p in enumerate(ordered)}
    movable = [p.id for p in ordered if p.can_wait]
    if len(movable) > MAX_MOVABLE:
        raise EngineError(
            f"Up to {MAX_MOVABLE} procedures can be marked as able to wait. You marked {len(movable)}."
        )

    all_now_schedule: Schedule = {p.id: "this_year" for p in procedures}
    all_now = calculate(procedures, plan, all_now_schedule)

    best: Result = all_now
    best_schedule: Schedule = all_now_schedule
    best_moved: list[str] = []
    best_key = (_cents(all_now.totals.you_pay), 0, ())

    for choice in product((False, True), repeat=len(movable)):
        moved = [pid for pid, move in zip(movable, choice) if move]
        if not moved:
            continue
        schedule: Schedule = {**all_now_schedule, **{pid: "next_year" for pid in moved}}
        try:
            result = calculate(procedures, plan, schedule)
        except EngineError:
            continue  # For example, a crown before its root canal.
        key = (
            _cents(result.totals.you_pay),
            len(moved),
            tuple(sorted((-position[pid] for pid in moved))),
        )
        if key < best_key:
            best, best_schedule, best_moved, best_key = result, schedule, moved, key

    return OptimizeResult(
        all_now=all_now,
        best=best,
        best_schedule=best_schedule,
        savings=_cents(all_now.totals.you_pay - best.totals.you_pay) / 100,
        moved=best_moved,
    )
