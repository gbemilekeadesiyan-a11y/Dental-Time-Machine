"""FastAPI app: routes, CORS, and error handling (CLAUDE.md section 7).

Routes stay thin: validate (Pydantic), call the engine, optimizer, or a socket,
and return a section 6 shape. No business logic and no dollar math here.

Privacy: nothing in this file logs request bodies, and error responses never
echo user input back.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import sockets
from app.demo_data import CATALOG, maya_plan, maya_procedures
from app.engine import EngineError, calculate
from app.models import (
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

logger = logging.getLogger("dental_time_machine")

FRONTEND_ORIGINS = ["http://localhost:5173"]

app = FastAPI(
    title="Dental Time Machine API",
    description="Estimates only. Not medical or coverage advice. Confirm with your dentist and plan.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ---------- errors: always a 422 with one plain string for bad input ----------


def _plain_validation_message(exc: RequestValidationError) -> str:
    """Turn Pydantic's error list into one sentence, without echoing input values."""
    errors = exc.errors()
    if not errors:
        return "The request isn't valid."
    first = errors[0]
    if first.get("type") == "json_invalid":
        return "The request isn't valid JSON."
    where = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
    message = str(first.get("msg", "is not valid")).removeprefix("Value error, ")
    text = f"{where}: {message}" if where else message
    if len(errors) > 1:
        text += f" (and {len(errors) - 1} more problem{'s' if len(errors) > 2 else ''})"
    return text


@app.exception_handler(RequestValidationError)
async def _on_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": _plain_validation_message(exc)})


@app.exception_handler(EngineError)
async def _on_engine_error(_: Request, exc: EngineError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def _on_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # Log only the error type and path. Never the body or the message (it may hold user data).
    logger.error("Unexpected %s on %s %s", type(exc).__name__, request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side. Please try again."})


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
