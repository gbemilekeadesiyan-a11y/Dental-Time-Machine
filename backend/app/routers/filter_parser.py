"""Turn a plain-language request into filter changes (feature/filters).

This is the rule-based socket: no AWS needed, so the demo never breaks. A Bedrock
version can replace parse_filters() later as long as it returns the same
FilterChanges (validated by Pydantic) and falls back to this on any error.

Rules (CLAUDE.md sections 2 and 12):
- Only the filters the message mentions are returned. Everything else is kept.
- The user's own numbers (miles, budget) are read, never invented or computed.
- Symptom messages get the safety reply. Filters in the same message still apply.
- User text is data. Nothing here is logged.
"""

from __future__ import annotations

import re
from typing import Any

from app.routers.filter_models import (
    FILTER_LANGUAGES,
    MAX_NAME,
    MAX_SEARCH_MILES,
    MIN_DISTANCE_MILES,
    SERVICE_CODES,
    FilterChanges,
    FilterParseResponse,
)
from app.models import MAX_FEE
from app.sockets import _SYMPTOMS

SAFETY_NOTE = "I can't assess symptoms. Please contact a dentist today."
NOTHING_FOUND_NOTE = (
    "I didn't catch a filter in that. Try something like "
    "\"in-network within 10 miles that can see me this week\"."
)
BUDGET_TOO_HIGH_NOTE = f"Budgets can be at most ${MAX_FEE:,}, so I left your budget as it was."

_NUMBER = r"(\d[\d,]*(?:\.\d+)?)"

# Money needs a $ sign, a currency word, or the word budget, so "10 miles" is never a budget.
_MONEY = re.compile(
    rf"\$\s*{_NUMBER}|{_NUMBER}\s*(?:dollars|bucks|usd)\b|budget\s*(?:of|is|:|around|about)?\s*\$?\s*{_NUMBER}"
)
_NO_BUDGET = re.compile(r"\b(?:no budget|any price|price doesn'?t matter|cost doesn'?t matter|clear (?:the |my )?budget)\b")
_MILES = re.compile(rf"{_NUMBER}\s*-?\s*(?:miles?|mi)\b")
_A_MILE = re.compile(r"\b(?:within|under|less than) (?:a|one) mile\b")
_AGE_NUMBER = re.compile(
    r"\b(\d{1,3})\s*-?\s*(?:years?|yrs?|yo)\b(?:\s*-?\s*old)?|\b(?:i am|i'm|im|age|aged)\s+(\d{1,3})\b"
)
# Five digits on their own: not part of a longer number like 1,500.00 or 123456.
_ZIP = re.compile(r"(?<![\d$])(?<!\d[.,])\b(\d{5})\b(?![.,]?\d)")

_CHILD = re.compile(r"\b(?:my (?:son|daughter|kids?|child|children|toddler|baby|teen)|for (?:a|my) (?:kid|child)|minor)\b")
_SENIOR = re.compile(r"\b(?:senior|medicare|retired|retiree|elderly)\b")

_OUT_OF_NETWORK = re.compile(
    r"\b(?:out[- ]of[- ]network(?:\s+(?:is\s+)?(?:ok|okay|fine))?|any network|"
    r"(?:don'?t|do not) care about (?:the )?network)\b"
)
_IN_NETWORK = re.compile(r"\bin[- ]network\b")

_AVAILABILITY: list[tuple[str, re.Pattern[str]]] = [
    ("today", re.compile(r"\b(?:today|same[- ]day|right now|this (?:afternoon|evening)|tonight)\b")),
    ("tomorrow", re.compile(r"\btomorrow\b")),
    ("this_week", re.compile(r"\b(?:this week|within (?:a|one|the) week|next (?:few|couple(?: of)?) days|in the next week)\b")),
    ("two_weeks", re.compile(r"\b(?:next week|(?:two|2) weeks|14 days)\b")),
    ("any", re.compile(r"\b(?:any ?time|no rush|whenever|any day)\b")),
]
_EARLIEST = re.compile(r"\b(?:earliest|soonest|asap|as soon as possible|first available|next available|quickest)\b")
_NEAREST = re.compile(r"\b(?:closest|nearest|sort by distance)\b")

_ACCEPTING_NEW = re.compile(r"\b(?:new patients?|accepting (?:new )?patients|taking (?:new )?patients|taking new)\b")
_NO_REFERRAL = re.compile(
    r"\b(?:no referrals?|without (?:a )?referrals?|(?:don'?t|do not) (?:want|have|need) (?:a )?referrals?|referral[- ]free)\b"
)

_SELF_PAY = re.compile(
    r"\b(?:self[- ]?pay(?:ing)?|pay(?:ing)? (?:in )?cash|cash price|out of pocket|no insurance|without insurance|"
    r"uninsured|(?:don'?t|do not) have (?:any )?(?:dental )?insurance)\b"
)
_INSURANCE = re.compile(
    r"\b(?:(?:use|with|using|through|have|take|takes|accepts?) (?:my )?(?:dental )?(?:insurance|plan|coverage)|insured)\b"
)
_DEMO_PLAN = re.compile(r"\b(?:demo plan|maya'?s plan)\b")
_MY_PLAN = re.compile(r"\bmy (?:own )?plan\b")

_SERVICES: list[tuple[str, re.Pattern[str]]] = [
    (SERVICE_CODES["filling"], re.compile(r"\b(?:fillings?|cavity|cavities)\b")),
    (SERVICE_CODES["root_canal"], re.compile(r"\broot canals?\b")),
    (SERVICE_CODES["crown"], re.compile(r"\bcrowns?\b")),
    ("checkup", re.compile(r"\b(?:cleanings?|check[- ]?ups?|exams?|x-?rays?)\b")),
]

_SPECIALTIES: list[tuple[str, re.Pattern[str]]] = [
    ("general", re.compile(r"\b(?:general dentist|family dentist|general practice)\b")),
    ("pediatric", re.compile(r"\b(?:pa?ediatric\w*|kids'? dentist|children'?s dentist|child dentist)\b")),
    ("endodontics", re.compile(r"\bendodont\w*")),
    ("periodontics", re.compile(r"\b(?:periodont\w*|gum (?:specialist|doctor))\b")),
    ("orthodontics", re.compile(r"\b(?:orthodont\w*|braces|invisalign|aligners)\b")),
    ("oral_surgery", re.compile(r"\b(?:oral surg\w*|wisdom teeth)\b")),
    ("prosthodontics", re.compile(r"\b(?:prosthodont\w*|dentures)\b")),
    ("any", re.compile(r"\b(?:any (?:kind of )?dentist|any specialty)\b")),
]

_DOCTOR = re.compile(r"\bdr\.?\s+([a-z][a-z'-]{1,40})\b")
_ANY_LANGUAGE = re.compile(r"\bany language\b")
_LANGUAGE_WORDS: dict[str, str] = {
    "english": "English",
    "spanish": "Spanish",
    "español": "Spanish",
    "espanol": "Spanish",
    "french": "French",
    "portuguese": "Portuguese",
    "vietnamese": "Vietnamese",
    "chinese": "Chinese",
    "mandarin": "Chinese",
    "cantonese": "Chinese",
}
_LANGUAGE = re.compile(r"\b(" + "|".join(_LANGUAGE_WORDS) + r")\b")
_RESET = re.compile(r"\b(?:(?:clear|reset) (?:all )?(?:the |my )?filters|start over)\b")


def _number(raw: str) -> float:
    return float(raw.replace(",", ""))


def _blank_out(text: str, match: re.Match[str]) -> str:
    """Remove a match so its digits can't be read again as a ZIP code or an age."""
    start, end = match.span()
    return text[:start] + " " * (end - start) + text[end:]


def _last(options: list[tuple[str, re.Pattern[str]]], text: str) -> str | None:
    """The option mentioned last. "Today... actually tomorrow" means tomorrow."""
    best: tuple[int, str] | None = None
    for value, pattern in options:
        for match in pattern.finditer(text):
            if best is None or match.start() >= best[0]:
                best = (match.start(), value)
    return best[1] if best else None


def parse_filters(text: str) -> FilterParseResponse:
    """Read one message and return only the filters it changes."""
    lowered = " ".join(text.lower().replace("’", "'").split())
    scan = lowered  # Numbers are blanked out of this copy once they are used.
    changes: dict[str, Any] = {}
    notes: list[str] = []

    reset = bool(_RESET.search(lowered))

    # Money first, then miles, then ages, so the ZIP search only sees what's left.
    if _NO_BUDGET.search(lowered):
        changes["budget_this_year"] = None
    for match in _MONEY.finditer(lowered):
        amount = _number(next(g for g in match.groups() if g))
        scan = _blank_out(scan, match)
        if "budget_this_year" in changes:
            continue  # The first amount is the budget.
        if amount > MAX_FEE:
            notes.append(BUDGET_TOO_HIGH_NOTE)
            continue
        changes["budget_this_year"] = amount

    for match in _MILES.finditer(scan):
        changes["max_distance_miles"] = min(max(_number(match.group(1)), MIN_DISTANCE_MILES), MAX_SEARCH_MILES)
        scan = _blank_out(scan, match)
    if _A_MILE.search(scan):
        changes["max_distance_miles"] = float(MIN_DISTANCE_MILES)

    for match in _AGE_NUMBER.finditer(scan):
        age = int(next(g for g in match.groups() if g))
        scan = _blank_out(scan, match)
        if age <= 120:
            changes["age_range"] = "under_18" if age < 18 else "65_plus" if age >= 65 else "18_64"
    if "age_range" not in changes:
        if _CHILD.search(lowered):
            changes["age_range"] = "under_18"
        elif _SENIOR.search(lowered):
            changes["age_range"] = "65_plus"

    zip_match = _ZIP.search(scan)
    if zip_match:
        changes["zip"] = zip_match.group(1)

    if _OUT_OF_NETWORK.search(lowered):
        changes["in_network_only"] = False
    elif _IN_NETWORK.search(lowered):
        changes["in_network_only"] = True

    availability = _last(_AVAILABILITY, lowered)
    if availability:
        changes["availability"] = availability
    if _EARLIEST.search(lowered):
        changes["sort"] = "earliest"
    elif _NEAREST.search(lowered):
        changes["sort"] = "distance"

    if _ACCEPTING_NEW.search(lowered):
        changes["accepting_new_only"] = True
    if _NO_REFERRAL.search(lowered):
        changes["no_referral_only"] = True

    if _SELF_PAY.search(lowered):
        changes["payment"] = "self_pay"
        changes["in_network_only"] = False  # Networks only matter when paying with insurance.
    elif _INSURANCE.search(lowered) or changes.get("in_network_only") is True or _MY_PLAN.search(lowered):
        changes["payment"] = "insurance"
    if _DEMO_PLAN.search(lowered):
        changes["preferred_plan_id"] = "demo_plan"
        changes["payment"] = "insurance"
    elif _MY_PLAN.search(lowered):
        changes["preferred_plan_id"] = "my_plan"

    service = _last(_SERVICES, lowered)
    if service:
        changes["service"] = service
    specialty = _last(_SPECIALTIES, lowered)
    if specialty:
        changes["specialty"] = specialty

    doctor = _DOCTOR.search(lowered)
    if doctor:
        changes["dentist_name"] = doctor.group(1).title()[:MAX_NAME]

    if _ANY_LANGUAGE.search(lowered):
        changes["languages"] = []
    else:
        found = [_LANGUAGE_WORDS[m.group(1)] for m in _LANGUAGE.finditer(lowered)]
        if found:
            changes["languages"] = [lang for lang in FILTER_LANGUAGES if lang in found]

    if _SYMPTOMS.search(lowered):
        notes.insert(0, SAFETY_NOTE)
    elif not changes and not reset and not notes:
        notes.append(NOTHING_FOUND_NOTE)

    return FilterParseResponse(
        changes=FilterChanges(**changes),
        reset=reset,
        note=" ".join(notes) or None,
    )
