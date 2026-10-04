"""Pydantic models for Dental Time Machine.

Single source of truth for every data shape (CLAUDE.md section 6).
Field names are snake_case and must match frontend/src/types.ts exactly.
After the 7pm Saturday freeze, only ADD optional fields. Never rename or remove.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, Strict, model_validator

# Input caps from CLAUDE.md section 10.
MAX_FEE = 50_000
MAX_PROCEDURES = 20

Category = Literal["preventive", "basic", "major"]
Year = Literal["this_year", "next_year"]
Reason = Literal["deductible", "coinsurance", "over_annual_max", "not_covered", "balance_bill"]

MAX_ID = 64
MAX_WAIVED = 3  # One entry per category at most.

# Numbers are strict: JSON numbers only. true, "150", NaN and Infinity are rejected.
# Any dollar amount a user can type in.
Money = Annotated[float, Strict(), Field(ge=0, le=MAX_FEE, allow_inf_nan=False)]
# A coverage share between 0 and 1, where 1 means fully covered.
Share = Annotated[float, Strict(), Field(ge=0, le=1, allow_inf_nan=False)]
# Procedure ids: letters, numbers, dashes and underscores (crypto.randomUUID() fits).
Id = Annotated[str, Field(min_length=1, max_length=MAX_ID, pattern=r"^[A-Za-z0-9_-]+$")]

# Optional feature fields on frozen shapes (CLAUDE.md section 6). Left out of the JSON
# while unset, so existing responses stay byte-for-byte the same.
def _unset(value: Any) -> bool:
    return value is None


# Maps procedure id to the plan year it is scheduled in.
Schedule = Annotated[dict[Id, Year], Field(max_length=MAX_PROCEDURES)]


class _Model(BaseModel):
    """Base model: reject unknown fields so typos fail loudly with a 422."""

    model_config = ConfigDict(extra="forbid")


class Procedure(_Model):
    """One procedure the dentist recommended."""

    id: Id
    name: Annotated[str, Field(min_length=1, max_length=200)]
    cdt_code: Annotated[str, Field(max_length=10)]
    category: Category
    tooth: Annotated[int, Strict(), Field(ge=1, le=32)] | None = None
    billed_fee: Money
    allowed_fee: Money
    depends_on: Id | None = None
    can_wait: bool = False
    # Feature addition: self-pay price if the dentist offers one; otherwise cash = billed_fee.
    cash_price: Money | None = Field(default=None, exclude_if=_unset)

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
    deductible_waived_for: Annotated[list[Category], Field(max_length=MAX_WAIVED)] = Field(
        default_factory=lambda: ["preventive"]
    )
    coverage: Coverage
    reset_date: Annotated[str, Field(pattern=r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")]
    used_this_year: Money = 0
    deductible_paid_this_year: Money = 0
    in_network: bool
    # Feature addition: needed for a fair cash vs insurance comparison.
    annual_premium: Money | None = Field(default=None, exclude_if=_unset)

    @model_validator(mode="after")
    def _check_usage(self) -> Plan:
        if self.used_this_year > self.annual_max:
            raise ValueError("Benefits used this year can't be more than the annual maximum.")
        if self.deductible_paid_this_year > self.deductible:
            raise ValueError("Deductible paid this year can't be more than the deductible.")
        if len(set(self.deductible_waived_for)) != len(self.deductible_waived_for):
            raise ValueError("Each category can only be listed once in the categories that skip the deductible.")
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


class CashComparison(_Model):
    """Feature addition: cash vs insurance for the same care. Computed by engine.cash_comparison."""

    cash_total: float
    insurance_you_pay: float
    premiums_in_period: float | None
    cheaper: Literal["cash", "insurance", "about_equal"]
    assumptions: list[str]


class Result(_Model):
    per_procedure: list[LineResult]
    totals: Totals
    max_left: MaxLeft
    warnings: list[str]
    # Feature addition: computed by the engine on every calculate (CLAUDE.md section 8).
    cash_comparison: CashComparison | None = Field(default=None, exclude_if=_unset)


MAX_ALTERNATIVES = 5


class Alternative(_Model):
    """One valid schedule from the optimizer, for Samuel's timeline permutations."""

    schedule: Schedule
    you_pay: float
    moved: list[str]


class OptimizeResult(_Model):
    all_now: Result
    best: Result
    best_schedule: Schedule
    savings: float
    moved: list[str]
    # Feature addition: top 5 valid schedules. Not built yet, so always unset.
    alternatives: Annotated[list[Alternative], Field(max_length=MAX_ALTERNATIVES)] | None = Field(
        default=None, exclude_if=_unset
    )


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
    # Feature addition: cap on this year's you_pay (Kuwa's budget filter). Accepted, not applied yet.
    budget_this_year: Money | None = None


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


# ======================================================================
# Feature additions (CLAUDE.md section 6). Shapes only: no engine logic yet.
# ======================================================================

MAX_CHAT_TURNS = 20
MAX_DISTANCE_MILES = 500
MAX_LANGUAGES = 10
MAX_SHORT_TEXT = 200
MAX_TERMS_FOUND = 8

Language = Literal["en", "es", "fr", "pt"]
Style = Literal["simple", "detailed", "numbers"]
AgeRange = Literal["under_18", "18_64", "65_plus"]
ShortText = Annotated[str, Field(min_length=1, max_length=MAX_SHORT_TEXT)]
LanguageName = Annotated[str, Field(min_length=1, max_length=40)]


class Preferences(_Model):
    """Session-only display preferences. Never stored."""

    language: Language
    style: Style
    voice_on: bool


class ChatTurn(_Model):
    role: Literal["user", "assistant"]
    text: Annotated[str, Field(min_length=1, max_length=MAX_TEXT)]


class ChatRequest(_Model):
    turns: Annotated[list[ChatTurn], Field(max_length=MAX_CHAT_TURNS)]
    preferences: Preferences
    procedures: Annotated[list[Procedure], Field(max_length=MAX_PROCEDURES)]
    plan: Plan | None
    # Feature addition (feature/documents): what the reader found in an uploaded document,
    # so the chat can talk about it. Not yet confirmed by the user.
    document: DocumentReadResult | None = Field(default=None, exclude_if=_unset)


class PartialCoverage(_Model):
    """Coverage shares the user stated in chat; unknown categories stay None."""

    preventive: Share | None = None
    basic: Share | None = None
    major: Share | None = None


class PlanDetails(_Model):
    """Feature addition (feature/chat): plan fields the user stated in chat. Only the
    fields they said are set; the user applies them to the plan form after checking."""

    annual_max: Money | None = None
    deductible: Money | None = None
    coverage: PartialCoverage | None = None
    reset_date: Annotated[str, Field(pattern=r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")] | None = None
    used_this_year: Money | None = None
    deductible_paid_this_year: Money | None = None
    in_network: bool | None = None


class ChatResponse(_Model):
    """say is checked by the dollar guard. Proposals need the user's explicit confirmation."""

    say: str
    proposed_procedures: Annotated[list[Procedure], Field(max_length=MAX_PROCEDURES)]
    proposed_can_wait: Annotated[list[Id], Field(max_length=MAX_PROCEDURES)]
    done_intake: bool
    # Feature addition (feature/chat): plan details the user stated. Needs confirmation too.
    proposed_plan: PlanDetails | None = Field(default=None, exclude_if=_unset)
    # Feature addition (feature/chat): set only when the reply is in a different language
    # than the user's setting, because they wrote in it. Speech uses it for the voice.
    language: Language | None = Field(default=None, exclude_if=_unset)


class SummaryRequest(_Model):
    procedures: ProcedureList
    plan: Plan
    schedule: Schedule
    optimize: OptimizeResult
    preferences: Preferences


class SummaryResponse(_Model):
    """text is checked by the dollar guard."""

    text: str


class DocumentReadResult(_Model):
    """Always shown on a confirm form, never applied directly."""

    plan: Plan | None
    procedures: Annotated[list[Procedure], Field(max_length=MAX_PROCEDURES)]
    fields_found: list[str]
    warnings: list[str]
    # Feature addition (feature/documents): confusing insurance terms printed in the
    # document, as short plain labels for the reveal cards. Letters only, so no money.
    terms_found: Annotated[list[str], Field(max_length=MAX_TERMS_FOUND)] = []


class FilterState(_Model):
    zip: Annotated[str, Field(pattern=r"^[0-9]{5}$")]
    age_range: AgeRange
    max_distance_miles: Annotated[float, Strict(), Field(gt=0, le=MAX_DISTANCE_MILES, allow_inf_nan=False)]
    in_network_only: bool
    preferred_plan_id: Id
    languages: Annotated[list[LanguageName], Field(max_length=MAX_LANGUAGES)]
    budget_this_year: Money


class PlanOption(_Model):
    id: Id
    name: ShortText
    monthly_premium: Money
    plan: Plan
    source: Literal["demo", "user"]


class DentistListing(_Model):
    """in_network, languages and accepting_new are demo data."""

    npi: Annotated[str, Field(pattern=r"^[0-9]{10}$")]
    name: ShortText
    address: ShortText
    distance_miles: Annotated[float, Strict(), Field(ge=0, allow_inf_nan=False)]
    in_network: bool
    languages: Annotated[list[LanguageName], Field(max_length=MAX_LANGUAGES)]
    accepting_new: bool


# ChatRequest.document refers to DocumentReadResult, which is defined after it.
ChatRequest.model_rebuild()
