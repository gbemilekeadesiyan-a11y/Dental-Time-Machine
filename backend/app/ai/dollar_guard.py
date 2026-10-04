"""Dollar guard (CLAUDE.md section 12). Shared by chat, summary, explain and documents.

The AI talks, the engine counts: every money figure in LLM text must already exist in
the engine output (or the user-confirmed inputs) passed to that call. If it doesn't,
regenerate once, then use the fixed fallback text.

What counts as a money figure:
- Any number next to a currency marker: "$1,975", "1.975 $", "US$ 1.975,00",
  "1975 dólares", "2,500 dollars".
- Any bare number of 100 or more, so a figure can't slip past by dropping the "$".
Not money: percentages ("80%", "50 %"), numbers glued to letters ("D2740"),
small bare numbers (teeth, counts, dates) and bare years (1900-2100).
Thousands and decimal separators are read the same way in every language:
a separator followed by exactly three digits groups thousands; one or two digits are cents.
Known gap: numbers written as words ("mil novecientos") are not detected.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable
from typing import Any

from pydantic import BaseModel

_GROUP_SEP = r"[,.   ]"
_NUMBER = re.compile(
    r"(?<![\w.,])"
    rf"(?P<int>\d{{1,3}}(?:{_GROUP_SEP}\d{{3}})+|\d+)"
    r"(?:[.,](?P<dec>\d{1,2}))?"
    r"(?![\w])"
)
_MARK_BEFORE = re.compile(r"(?:US\$|USD|\$)\s?$", re.IGNORECASE)
_MARK_AFTER = re.compile(r"^\s?(?:\$|USD\b|dollars?\b|d[óo]lar(?:es)?\b)", re.IGNORECASE)
_PERCENT_AFTER = re.compile(
    r"^\s?(?:%|percent\b|per cent\b|por ciento\b|pour cent\b|por cento\b)", re.IGNORECASE
)

MIN_BARE_AMOUNT = 100
_YEARS = range(1900, 2101)
_CENT = 0.005


def extract_amounts(text: str) -> list[float]:
    """Every money figure in the text, in order, as plain numbers."""
    amounts: list[float] = []
    for match in _NUMBER.finditer(text):
        before = text[max(0, match.start() - 5) : match.start()]
        after = text[match.end() : match.end() + 12]
        if _PERCENT_AFTER.match(after):
            continue
        digits = re.sub(r"\D", "", match["int"])
        value = float(f"{digits}.{match['dec']}" if match["dec"] else digits)
        marked = bool(_MARK_BEFORE.search(before) or _MARK_AFTER.match(after))
        if not marked:
            is_year = match["int"] == digits and not match["dec"] and int(digits) in _YEARS
            if value < MIN_BARE_AMOUNT or is_year:
                continue
        amounts.append(value)
    return amounts


def allowed_amounts(*sources: Any) -> set[float]:
    """Every number in the given engine results, procedures, plans, dicts or lists."""
    found: set[float] = set()

    def walk(value: Any) -> None:
        if isinstance(value, BaseModel):
            walk(value.model_dump())
        elif isinstance(value, dict):
            for item in value.values():
                walk(item)
        elif isinstance(value, (list, tuple, set)):
            for item in value:
                walk(item)
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            found.add(round(float(value), 2))

    for source in sources:
        walk(source)
    return found


def _matches(value: float, allowed: Iterable[float]) -> bool:
    # Exact to the cent, or the engine figure rounded to whole dollars ("about $513" for 512.50).
    whole = value.is_integer()
    return any(abs(value - a) < _CENT or (whole and abs(value - a) <= 0.5) for a in allowed)


def unknown_amounts(text: str, allowed: Iterable[float]) -> list[float]:
    """Money figures in the text that the engine did not produce."""
    allowed = list(allowed)
    return [v for v in extract_amounts(text) if not _matches(v, allowed)]


def guard(
    generate: Callable[[], str | None],
    allowed: Iterable[float],
    fallback: str | Callable[[], str],
    attempts: int = 2,
) -> str:
    """Run the LLM, keep its text only if every figure is allowed.

    generate returns None when the LLM is unavailable (AWS error or timeout); that goes
    straight to the fallback with no retry. A reply with an unknown figure, or an empty
    reply, is regenerated once. The fallback is fixed text built from engine figures.
    """
    allowed = list(allowed)
    for _ in range(attempts):
        text = generate()
        if text is None:
            break
        if text.strip() and not unknown_amounts(text, allowed):
            return text
    return fallback() if callable(fallback) else fallback
