"""FastAPI app: routes, CORS, and error handling (CLAUDE.md section 7).

Routes stay thin: validate (Pydantic), call the engine, optimizer, or a socket,
and return a section 6 shape. No business logic and no dollar math here.

Errors: bad input always gets a 422 with one plain-English sentence, never a 500.
Validation messages never echo the values the user sent. Engine messages may
name a procedure the user typed, which is safe because the frontend renders text.

Privacy: nothing here logs request bodies. Unexpected errors are logged as one
line (error type, method, path) with no traceback and no message text.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app import sockets
from app.demo_data import CATALOG, maya_plan, maya_procedures
from app.engine import EngineError, calculate
from app.models import (
    MAX_FEE,
    CalculateRequest,
    CatalogItem,
    DemoResponse,
    ExplainRequest,
    ExplainResponse,
    OptimizeRequest,
    OptimizeResult,
    ParseRequest,
    Procedure,
    Result,
)
from app.optimizer import optimize
from app.routers import chat as chat_router
from app.routers import filters

logger = logging.getLogger("dental_time_machine")

FRONTEND_ORIGINS = ["http://localhost:5173"]

# The largest legitimate request is about 30 KB (20 procedures at their field limits).
MAX_BODY_BYTES = 64 * 1024
TOO_LARGE_MESSAGE = "The request is too large. Try fewer procedures or shorter text."
UNEXPECTED_MESSAGE = "Something went wrong on our side. Please try again."


# ---------- middleware ----------


class ContainUnexpectedErrors:
    """Turn any unhandled error into a generic 500 and log it as one line.

    Sits inside CORS and outside the app, so the error never reaches Starlette's
    ServerErrorMiddleware or the server, which would print a full traceback.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started = False

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, tracking_send)
        except Exception as exc:  # noqa: BLE001 - this is the last line of defence
            # One line. No traceback, no exception message (it may hold user data), no body.
            logger.error("Unexpected %s on %s %s", type(exc).__name__, scope.get("method"), scope.get("path"))
            if not started:
                await JSONResponse(status_code=500, content={"detail": UNEXPECTED_MESSAGE})(scope, receive, send)


class LimitBodySize:
    """Reject request bodies over MAX_BODY_BYTES with a plain 422.

    Checks the declared Content-Length first, then counts bytes as they arrive,
    so a request that doesn't declare its size can't slip past.
    """

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = dict(scope.get("headers", [])).get(b"content-length")
        if declared is not None and (not declared.isdigit() or int(declared) > self.max_bytes):
            await JSONResponse(status_code=422, content={"detail": TOO_LARGE_MESSAGE})(scope, receive, send)
            return

        received = 0

        async def counting_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    # FastAPI re-raises HTTPExceptions from the body read unchanged.
                    raise HTTPException(status_code=422, detail=TOO_LARGE_MESSAGE)
            return message

        await self.app(scope, counting_receive, send)


app = FastAPI(
    title="Dental Time Machine API",
    description="Estimates only. Not medical or coverage advice. Confirm with your dentist and plan.",
)

# Last added runs first: CORS -> ContainUnexpectedErrors -> LimitBodySize -> routes.
app.add_middleware(LimitBodySize)
app.add_middleware(ContainUnexpectedErrors)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.include_router(filters.router)

app.include_router(chat_router.router)


# ---------- plain-English validation messages ----------

_TOP_LABELS = {
    "procedures": "Procedures",
    "plan": "Plan",
    "schedule": "Schedule",
    "text": "Text",
    "term": "Term",
    "language": "Language",
    "style": "Style",
    "budget_this_year": "Budget this year",
}
_PROCEDURE_LABELS = {
    "id": "id",
    "name": "name",
    "cdt_code": "procedure code",
    "category": "category",
    "tooth": "tooth number",
    "billed_fee": "billed fee",
    "allowed_fee": "allowed fee",
    "depends_on": "'depends on' id",
    "can_wait": "'can wait' setting",
    "cash_price": "cash price",
}
_PLAN_LABELS = {
    "annual_max": "Annual maximum",
    "deductible": "Deductible",
    "deductible_waived_for": "The list of categories that skip the deductible",
    "coverage": "Coverage",
    "reset_date": "Reset date",
    "used_this_year": "Benefits used this year",
    "deductible_paid_this_year": "Deductible paid this year",
    "in_network": "The in-network setting",
    "annual_premium": "Annual premium",
}
_COVERAGE_LABELS = {"preventive": "Preventive coverage", "basic": "Basic coverage", "major": "Major coverage"}

_MONEY_FIELDS = {
    "billed_fee", "allowed_fee", "annual_max", "deductible", "used_this_year", "deductible_paid_this_year",
    "cash_price", "annual_premium", "budget_this_year",
}
_RANGES = {
    **{field: f"between 0 and {MAX_FEE:,}" for field in _MONEY_FIELDS},
    **{field: "between 0 and 1" for field in _COVERAGE_LABELS},
    "tooth": "between 1 and 32",
}
_ID_FIELDS = {"id", "depends_on"}


def _label(parts: list[Any]) -> str:
    """A readable name for the field at this location. Never echoes unknown keys."""
    if not parts:
        return "The request"
    head = parts[0]
    if head == "procedures" and len(parts) >= 2 and isinstance(parts[1], int):
        procedure = f"Procedure {parts[1] + 1}"
        if len(parts) == 2:
            return procedure
        field = _PROCEDURE_LABELS.get(str(parts[2]))
        return f"{procedure} {field}" if field else procedure
    if head == "plan" and len(parts) >= 2:
        if parts[1] == "coverage" and len(parts) >= 3:
            return _COVERAGE_LABELS.get(str(parts[2]), "Coverage")
        if parts[1] == "deductible_waived_for" and len(parts) >= 3:
            return "A category in the list of categories that skip the deductible"
        return _PLAN_LABELS.get(str(parts[1]), "Plan")
    if head == "schedule" and len(parts) >= 2:
        return "A schedule entry"  # Don't repeat the key the user sent.
    return _TOP_LABELS.get(str(head), "A field")


def _sentence(error: dict[str, Any]) -> str:
    """One plain-English sentence for one Pydantic error."""
    kind = error.get("type", "")
    loc = list(error.get("loc", ()))
    parts = loc[1:] if loc and loc[0] == "body" else loc
    ctx = error.get("ctx") or {}
    label = _label(parts)
    field = str(parts[-1]) if parts else ""

    if kind == "json_invalid":
        return "The request isn't valid JSON."
    if kind == "missing":
        return "The request body is missing." if not parts else f"{label} is missing."
    if kind == "extra_forbidden":
        return f"{_label(parts[:-1])} has a field we don't recognize."
    if kind in {"dict_type", "model_type", "model_attributes_type"}:
        return "The request body must be a JSON object." if not parts else f"{label} must be an object."
    if kind in {"greater_than_equal", "less_than_equal", "greater_than", "less_than"}:
        if field in _RANGES:
            return f"{label} must be {_RANGES[field]}."
        return f"{label} is out of range."
    if kind == "finite_number":
        return f"{label} must be a real number."
    if kind in {"float_type", "float_parsing", "int_type", "int_parsing"}:
        return f"{label} must be a number."
    if kind == "int_from_float":
        return f"{label} must be a whole number."
    if kind in {"bool_type", "bool_parsing"}:
        return f"{label} must be true or false."
    if kind == "string_type":
        return f"{label} must be text."
    if kind == "string_too_short":
        return f"{label} can't be empty."
    if kind == "string_too_long":
        return f"{label} can be at most {int(ctx.get('max_length', 0)):,} characters."
    if kind == "string_pattern_mismatch":
        if field == "reset_date":
            return "Reset date must look like MM-DD, for example 01-01."
        if field in _ID_FIELDS or (parts and parts[0] == "schedule"):
            return f"{label} can only use letters, numbers, dashes and underscores."
        return f"{label} isn't in the right format."
    if kind == "too_short":
        return "Add at least one procedure." if parts == ["procedures"] else f"{label} can't be empty."
    if kind == "too_long":
        limit = ctx.get("max_length")
        if parts == ["procedures"]:
            return f"You can add at most {limit} procedures."
        if parts == ["plan", "deductible_waived_for"]:
            return f"{label} can have at most {limit} categories."
        if parts == ["schedule"]:
            return f"The schedule can have at most {limit} entries."
        return f"{label} has too many items."
    if kind == "literal_error":
        return f"{label} must be one of: {ctx.get('expected', 'the listed options')}."
    if kind == "list_type":
        return f"{label} must be a list."
    if kind == "value_error":
        # Our own messages from model validators, already written in plain English.
        return str(error.get("msg", "")).removeprefix("Value error, ")
    return f"{label} isn't valid."


def plain_validation_message(errors: list[dict[str, Any]]) -> str:
    """Turn Pydantic's error list into plain English, without echoing input values."""
    if not errors:
        return "The request isn't valid."
    text = _sentence(errors[0])
    extra = len(errors) - 1
    if extra == 1:
        text += " There is 1 more problem."
    elif extra > 1:
        text += f" There are {extra} more problems."
    return text


@app.exception_handler(RequestValidationError)
async def _on_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": plain_validation_message(list(exc.errors()))})


@app.exception_handler(EngineError)
async def _on_engine_error(_: Request, exc: EngineError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


# ---------- routes ----------


@app.get("/demo", response_model=DemoResponse)
def get_demo() -> DemoResponse:
    """Maya's procedures and plan, for the "Load Maya" button."""
    return DemoResponse(procedures=maya_procedures(), plan=maya_plan())


@app.get("/catalog", response_model=list[CatalogItem])
def get_catalog() -> list[CatalogItem]:
    return CATALOG


@app.post("/calculate", response_model=Result)
def post_calculate(body: CalculateRequest) -> Result:
    return calculate(body.procedures, body.plan, body.schedule)


@app.post("/optimize", response_model=OptimizeResult)
def post_optimize(body: OptimizeRequest) -> OptimizeResult:
    return optimize(body.procedures, body.plan)


@app.post("/parse", response_model=list[Procedure])
def post_parse(body: ParseRequest) -> list[Procedure]:
    """FAKE in the MVP: returns Maya's procedures."""
    return sockets.parse(body.text)


@app.post("/explain", response_model=ExplainResponse)
def post_explain(body: ExplainRequest) -> ExplainResponse:
    """FAKE in the MVP: returns fixed glossary text."""
    return ExplainResponse(text=sockets.explain(body.term, body.language, body.style))
