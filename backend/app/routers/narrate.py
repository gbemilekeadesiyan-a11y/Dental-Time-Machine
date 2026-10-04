"""POST /narrate: the guide's script for one step (feature/guide). No LLM in v1.

Bad input (an unknown step, care moved that can't wait) is a plain 422 from the app's
validation and engine-error handlers.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.models import NarrateRequest, NarrateResponse
from app.narrate import narrate

router = APIRouter()


@router.post("/narrate", response_model=NarrateResponse)
def post_narrate(request: NarrateRequest) -> NarrateResponse:
    return narrate(request)
