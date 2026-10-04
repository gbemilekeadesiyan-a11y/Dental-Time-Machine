"""POST /read-document: read a benefits summary or treatment estimate (feature/documents).

Accepts one pdf, jpg or png up to 5 MB as multipart field "file". The file is
read into memory, checked by its bytes (not its name or declared type), and
handed to the AI reader (document_reader.py). If the reader fails for any
reason (AWS error, timeout, odd answer), the fake in sockets.py answers instead
so the demo never breaks. The result always goes to the confirm form.

Privacy (CLAUDE.md section 12): the file, its name, and its contents are never
saved, logged, or echoed back in an error.
"""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app import sockets
from app.models import DocumentReadResult
from app.routers.document_reader import read_with_ai

router = APIRouter()

MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

WRONG_TYPE_MESSAGE = "Please upload a PDF, JPG, or PNG file."
TOO_LARGE_MESSAGE = "The file is too large. Please upload a file under 5 MB."
EMPTY_MESSAGE = "The file is empty. Please upload a PDF, JPG, or PNG file."

# File signatures, and the declared content types each one may arrive with.
_SIGNATURES: dict[str, bytes] = {
    "pdf": b"%PDF-",
    "png": b"\x89PNG\r\n\x1a\n",
    "jpg": b"\xff\xd8\xff",
}
_CONTENT_TYPES: dict[str, set[str]] = {
    "pdf": {"application/pdf"},
    "png": {"image/png"},
    "jpg": {"image/jpeg", "image/jpg", "image/pjpeg"},
}


def detect_kind(data: bytes) -> str | None:
    """'pdf', 'png' or 'jpg' from the file's first bytes, or None."""
    for kind, signature in _SIGNATURES.items():
        if data.startswith(signature):
            return kind
    return None


@router.post("/read-document", response_model=DocumentReadResult)
async def post_read_document(file: UploadFile = File(...)) -> DocumentReadResult:
    try:
        # Read one byte past the limit so an oversized file is caught without reading it all.
        data = await file.read(MAX_DOCUMENT_BYTES + 1)
    finally:
        await file.close()

    if not data:
        raise HTTPException(status_code=422, detail=EMPTY_MESSAGE)
    if len(data) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=422, detail=TOO_LARGE_MESSAGE)

    kind = detect_kind(data)
    declared = (file.content_type or "").split(";")[0].strip().lower()
    if kind is None or declared not in _CONTENT_TYPES[kind]:
        raise HTTPException(status_code=422, detail=WRONG_TYPE_MESSAGE)

    try:
        # boto3 blocks, so run it off the event loop.
        return await run_in_threadpool(read_with_ai, data, kind)
    except Exception:  # noqa: BLE001 - any failure falls back; nothing about the file is logged
        return sockets.read_document(data, kind)
