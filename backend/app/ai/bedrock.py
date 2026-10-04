"""One shared Bedrock client and call helper (CLAUDE.md section 3). Malama owns; chat,
summary and documents import it.

call() never raises: on any AWS error, timeout, missing credentials or empty reply it
returns None, and the caller falls back to its fake in sockets.py.

Privacy: prompts and replies are never logged. Errors are logged as one line with the
error type only.

Credentials come from the standard AWS chain (~/.aws/credentials or backend/.env).
Settings in backend/.env (all optional):
    AWS_REGION        default us-east-1
    BEDROCK_MODEL_ID  default Claude Haiku 4.5 (US inference profile)
"""

from __future__ import annotations

import logging
import os
from collections.abc import Iterable
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger("dental_time_machine.bedrock")

REGION = os.getenv("AWS_REGION", "us-east-1")
MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")
TIMEOUT_SECONDS = 8
DEFAULT_MAX_TOKENS = 800

# Bedrock requires the conversation to start with the user.
_OPENING = "(The conversation starts.)"

Role = Literal["user", "assistant"]


def client_config() -> Config:
    """8 s timeouts and a single attempt, so a slow AWS never stalls the demo."""
    return Config(
        region_name=REGION,
        connect_timeout=TIMEOUT_SECONDS,
        read_timeout=TIMEOUT_SECONDS,
        retries={"total_max_attempts": 1},
    )


@lru_cache(maxsize=1)
def _client() -> Any:
    return boto3.client("bedrock-runtime", config=client_config())


def text_messages(turns: Iterable[tuple[Role, str]]) -> list[dict[str, Any]]:
    """Plain (role, text) turns in Bedrock's Converse format.

    Skips blank turns, merges back-to-back turns from the same role, and starts with
    a user message as Bedrock requires.
    """
    messages: list[dict[str, Any]] = []
    for role, text in turns:
        text = text.strip()
        if not text:
            continue
        if messages and messages[-1]["role"] == role:
            previous = messages[-1]["content"][0]["text"]
            messages[-1] = {"role": role, "content": [{"text": f"{previous}\n\n{text}"}]}
        else:
            messages.append({"role": role, "content": [{"text": text}]})
    if messages and messages[0]["role"] != "user":
        messages.insert(0, {"role": "user", "content": [{"text": _OPENING}]})
    return messages


def call(
    system: str,
    messages: list[dict[str, Any]],
    max_tokens: int = DEFAULT_MAX_TOKENS,
    temperature: float = 0.3,
) -> str | None:
    """Ask the model. Returns its text, or None if anything goes wrong.

    messages use the Converse format, so documents can send image blocks too;
    text_messages() builds it from plain chat turns.
    """
    try:
        response = _client().converse(
            modelId=MODEL_ID,
            system=[{"text": system}],
            messages=messages,
            inferenceConfig={"maxTokens": max_tokens, "temperature": temperature},
        )
        content = response.get("output", {}).get("message", {}).get("content", [])
        text = "".join(block.get("text", "") for block in content).strip()
    except Exception as exc:  # noqa: BLE001 - every failure means "use the fallback"
        # Type only: AWS messages can echo request details.
        logger.warning("Bedrock call failed: %s", type(exc).__name__)
        return None
    return text or None


def call_tool(
    system: str,
    messages: list[dict[str, Any]],
    tool: dict[str, Any],
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> dict[str, Any] | None:
    """Ask the model to fill one tool's input (forced tool use). Returns that input, or
    None if anything goes wrong or the model doesn't call the tool.

    tool is a Converse toolSpec entry: {"toolSpec": {"name": ..., "inputSchema": {"json": ...}}}.
    Used by the document reader (feature/documents) to get structured fields back.
    """
    name = tool["toolSpec"]["name"]
    try:
        response = _client().converse(
            modelId=MODEL_ID,
            system=[{"text": system}],
            messages=messages,
            toolConfig={"tools": [tool], "toolChoice": {"tool": {"name": name}}},
            inferenceConfig={"maxTokens": max_tokens, "temperature": 0},
        )
        content = response.get("output", {}).get("message", {}).get("content", [])
    except Exception as exc:  # noqa: BLE001 - every failure means "use the fallback"
        logger.warning("Bedrock tool call failed: %s", type(exc).__name__)
        return None
    for block in content:
        tool_use = block.get("toolUse") if isinstance(block, dict) else None
        if tool_use and tool_use.get("name") == name and isinstance(tool_use.get("input"), dict):
            return tool_use["input"]
    return None
