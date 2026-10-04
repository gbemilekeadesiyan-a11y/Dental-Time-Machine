"""Compare plan options (Find care): GET /plans and POST /filters/apply.

Routes stay thin (same rules as main.py): validate, call plan_compare, return the
shape. Every dollar figure comes from the engine and the premium helper.

| GET  | /plans         |                                                     | [PlanOption] (demo options) |
| POST | /filters/apply | {procedures, plan_options?, my_plan?, filters?}    | [PlanComparison], sorted    |
"""

from __future__ import annotations

from fastapi import APIRouter

from app.demo_data import PLAN_OPTIONS
from app.models import PlanCompareRequest, PlanComparison, PlanOption
from app.plan_compare import compare_plans

router = APIRouter()


@router.get("/plans", response_model=list[PlanOption])
def get_plans() -> list[PlanOption]:
    """The employer's demo plan options."""
    return PLAN_OPTIONS


@router.post("/filters/apply", response_model=list[PlanComparison])
def post_filters_apply(body: PlanCompareRequest) -> list[PlanComparison]:
    """The user's care priced under each plan option, sorted by the likely total."""
    options = PLAN_OPTIONS if body.plan_options is None else body.plan_options
    return compare_plans(body.procedures, options, body.my_plan)
