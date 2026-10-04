"""Kuwa's filters feature: dentist search and plain-language filter requests.

Routes stay thin (same rules as main.py): validate, call the search or parser,
return the shape. No dollar math here: cost estimates come from POST /calculate.

| GET  | /dentists      | ?zip&max_distance_miles | DentistSearchResponse |
| POST | /filters/parse | {text}                  | FilterParseResponse (changes only) + source "ai"|"rules" |
"""

from __future__ import annotations

import math
import re
from typing import Any

from fastapi import APIRouter, HTTPException

from app.routers.dentist_search import SearchError, search_dentists
from app.routers.filter_models import (
    MAX_SEARCH_MILES,
    MIN_DISTANCE_MILES,
    DentistSearchResponse,
    FilterParseRequest,
)
from app.routers.filter_ai import understand

router = APIRouter()

ZIP_MESSAGE = "ZIP code must be five digits, for example 27401."
DISTANCE_MESSAGE = f"Distance must be a number of miles between {MIN_DISTANCE_MILES} and {MAX_SEARCH_MILES}."


@router.get("/dentists", response_model=DentistSearchResponse)
def get_dentists(zip: str = "", max_distance_miles: str = "10") -> DentistSearchResponse:
    """Dentists near a ZIP code. Query values are checked here so errors stay plain English."""
    if not re.fullmatch(r"[0-9]{5}", zip):
        raise HTTPException(status_code=422, detail=ZIP_MESSAGE)
    try:
        miles = float(max_distance_miles)
    except ValueError:
        raise HTTPException(status_code=422, detail=DISTANCE_MESSAGE) from None
    if not math.isfinite(miles) or not MIN_DISTANCE_MILES <= miles <= MAX_SEARCH_MILES:
        raise HTTPException(status_code=422, detail=DISTANCE_MESSAGE)
    try:
        return search_dentists(zip, miles)
    except SearchError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


@router.post("/filters/parse")
def post_filters_parse(body: FilterParseRequest) -> dict[str, Any]:
    """Only the filters the message mentions come back, so everything else stays as the user set it.

    Bedrock reads the message when it can; the rule-based parser answers when it can't.
    """
    result, source = understand(body.text)
    return {
        "changes": result.changes.model_dump(mode="json", exclude_unset=True),
        "reset": result.reset,
        "note": result.note,
        "source": source,
    }
