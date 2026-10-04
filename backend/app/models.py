"""Pydantic models for Dental Time Machine.

Single source of truth for every data shape (CLAUDE.md section 6).
Field names are snake_case and must match frontend/src/types.ts exactly.
After the 7pm Saturday freeze, only ADD optional fields. Never rename or remove.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Input caps from CLAUDE.md section 10.
MAX_FEE = 50_000
MAX_PROCEDURES = 20

Category = Literal["preventive", "basic", "major"]
Year = Literal["this_year", "next_year"]
Reason = Literal["deductible", "coinsurance", "over_annual_max", "not_covered", "balance_bill"]

# Any dollar amount a user can type in.
Money = Annotated[float, Field(ge=0, le=MAX_FEE)]
# A coverage share between 0 and 1, for example 0.8 for 80%.
Share = Annotated[float, Field(ge=0, le=1)]

# Maps procedure id to the plan year it is scheduled in.
Schedule = dict[str, Year]


class _Model(BaseModel):
    """Base model: reject unknown fields so typos fail loudly with a 422."""

    model_config = ConfigDict(extra="forbid")


class Procedure(_Model):
    """One procedure the dentist recommended."""

    id: Annotated[str, Field(min_length=1, max_length=64)]
    name: Annotated[str, Field(min_length=1, max_length=200)]
    cdt_code: Annotated[str, Field(max_length=10)]
    category: Category
    tooth: Annotated[int, Field(ge=1, le=32)] | None = None
    billed_fee: Money
    allowed_fee: Money
    depends_on: str | None = None
    can_wait: bool = False

    @model_validator(mode="before")
    @classmethod
    def _default_allowed_fee(cls, data: Any) -> Any:
        """In the MVP, allowed_fee equals billed_fee when it is not sent."""
        if isinstance(data, dict) and data.get("allowed_fee") is None and "billed_fee" in data:
            return {**data, "allowed_fee": data["billed_fee"]}
        return data


class Coverage(_Model):
    """Share of the allowed fee the plan pays, per category."""

    preventive: Share
    basic: Share
    major: Share


class Plan(_Model):
    """The user's dental plan details."""

    annual_max: Money
    deductible: Money
    deductible_waived_for: list[Category] = Field(default_factory=lambda: ["preventive"])
    coverage: Coverage
    reset_date: Annotated[str, Field(pattern=r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")]
    used_this_year: Money = 0
    deductible_paid_this_year: Money = 0
    in_network: bool

    @model_validator(mode="after")
    def _check_usage(self) -> Plan:
        if self.used_this_year > self.annual_max:
            raise ValueError("Benefits used this year can't be more than the annual maximum.")
        if self.deductible_paid_this_year > self.deductible:
            raise ValueError("Deductible paid this year can't be more than the deductible.")
        return self


class LineResult(_Model):
    """The engine's answer for one procedure."""

    id: str
    year: Year
    billed_fee: float
    allowed_fee: float
    deductible_applied: float
    plan_pays: float
    you_pay: float
    reasons: list[Reason]


class Totals(_Model):
    plan_pays: float
    you_pay: float


class MaxLeft(_Model):
    """Annual maximum remaining in each plan year after this schedule."""

    this_year: float
    next_year: float


class Result(_Model):
    per_procedure: list[LineResult]
    totals: Totals
    max_left: MaxLeft
    warnings: list[str]


class OptimizeResult(_Model):
    all_now: Result
    best: Result
    best_schedule: Schedule
    savings: float
    moved: list[str]


class CatalogItem(_Model):
    cdt_code: str
    name: str
    category: Category
    default_fee: float


# Request bodies (CLAUDE.md section 7). The 20-procedure cap lives here.
ProcedureList = Annotated[list[Procedure], Field(min_length=1, max_length=MAX_PROCEDURES)]


class CalculateRequest(_Model):
    procedures: ProcedureList
    plan: Plan
    schedule: Schedule = Field(default_factory=dict)


class OptimizeRequest(_Model):
    procedures: ProcedureList
    plan: Plan


MAX_TEXT = 2_000
MAX_TERM = 200


class DemoResponse(_Model):
    procedures: list[Procedure]
    plan: Plan


class ParseRequest(_Model):
    text: Annotated[str, Field(min_length=1, max_length=MAX_TEXT)]


class ExplainRequest(_Model):
    term: Annotated[str, Field(min_length=1, max_length=MAX_TERM)]
    language: Annotated[str, Field(min_length=2, max_length=10)] = "en"
    style: Annotated[str, Field(min_length=1, max_length=20)] = "plain"


class ExplainResponse(_Model):
    text: str
