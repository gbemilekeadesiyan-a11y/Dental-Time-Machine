"""Shapes for Kuwa's filters feature (feature/filters).

Router-local on purpose: models.py is core team only. Field names reuse the
section 6 FilterState names where they overlap (zip, age_range, max_distance_miles,
in_network_only, preferred_plan_id, languages, budget_this_year). The rest are
filter additions that must be added to section 6 before merge (request to Samuel).
Mirrored in frontend/src/features/filters/types.ts.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, Strict

from app.demo_data import CROWN_CDT, FILLING_CDT, ROOT_CANAL_CDT
from app.models import MAX_TEXT, AgeRange, DentistListing, Money

MIN_DISTANCE_MILES = 1
MAX_SEARCH_MILES = 100
MAX_NAME = 60

# Languages a dentist can be filtered by. Dentist languages are demo data.
FILTER_LANGUAGES = ("English", "Spanish", "French", "Portuguese", "Vietnamese", "Chinese")

Payment = Literal["insurance", "self_pay"]
PlanChoice = Literal["my_plan", "demo_plan"]
# Catalog procedures (sourced fees) plus checkups, which have no sourced fee yet.
Service = Literal["checkup", "D2391", "D3330", "D2740"]
SERVICE_CODES = {"filling": FILLING_CDT, "root_canal": ROOT_CANAL_CDT, "crown": CROWN_CDT}
Specialty = Literal[
    "any", "general", "pediatric", "endodontics", "periodontics", "orthodontics", "oral_surgery", "prosthodontics"
]
Availability = Literal["any", "today", "tomorrow", "this_week", "two_weeks"]
SortOrder = Literal["distance", "earliest"]
FilterLanguage = Literal["English", "Spanish", "French", "Portuguese", "Vietnamese", "Chinese"]
Miles = Annotated[float, Strict(), Field(ge=MIN_DISTANCE_MILES, le=MAX_SEARCH_MILES, allow_inf_nan=False)]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FilterChanges(_Model):
    """Only the filters the user's message changed. Unset fields mean "keep what you have".

    budget_this_year, service and age_range accept null, which means "clear it".
    """

    zip: Annotated[str, Field(pattern=r"^[0-9]{5}$")] | None = None
    max_distance_miles: Miles | None = None
    budget_this_year: Money | None = None
    payment: Payment | None = None
    preferred_plan_id: PlanChoice | None = None
    in_network_only: bool | None = None
    service: Service | None = None
    specialty: Specialty | None = None
    dentist_name: Annotated[str, Field(max_length=MAX_NAME)] | None = None
    age_range: AgeRange | None = None
    availability: Availability | None = None
    sort: SortOrder | None = None
    accepting_new_only: bool | None = None
    languages: Annotated[list[FilterLanguage], Field(max_length=len(FILTER_LANGUAGES))] | None = None
    no_referral_only: bool | None = None


class FilterParseRequest(_Model):
    text: Annotated[str, Field(min_length=1, max_length=MAX_TEXT)]


class FilterParseResponse(_Model):
    """changes holds only the keys the message set (exclude_unset on the way out)."""

    changes: FilterChanges
    reset: bool = False
    # A fixed sentence (safety reply or "didn't catch a filter"). Never a dollar amount.
    note: str | None = None


class DentistResult(DentistListing):
    """A dentist from the CMS NPI Registry.

    Real (NPI): npi, name, address, specialty. Approximate: distance_miles (ZIP centroid
    to ZIP centroid). Demo data, labeled in the UI: in_network, languages, accepting_new,
    next_available, no_referral_required.
    """

    specialty: Specialty
    specialty_label: str
    next_available: str  # ISO date, demo
    no_referral_required: bool


class DentistSearchResponse(_Model):
    dentists: list[DentistResult]
    source: Literal["npi", "unavailable"]
    # Plain sentence for the user when the directory couldn't be reached or results were cut short.
    note: str | None = None
