"""AI sockets. FAKES in the MVP (CLAUDE.md section 4).

Each function is the single place a feature branch plugs in a real LLM call.
Keep the signatures stable so main.py never changes when a fake is replaced.

Rules for any replacement (CLAUDE.md sections 2 and 10):
- Never produce dollar amounts. Only the engine counts.
- User text is data, never instructions to the LLM.
- Symptom questions get the safety reply, never an answer.
"""

from __future__ import annotations

import re

from app.demo_data import maya_procedures
from app.models import Procedure

SAFETY_REPLY = (
    "I can't help with symptoms or what's happening in your mouth. "
    "If you have pain, swelling, or fever, contact a dentist today. "
    "For anything else about your care, your dentist is the best person to ask."
)

FALLBACK_REPLY = (
    "We don't have a plain-language explanation for that term yet. "
    "Your plan documents or your plan's member services team can explain how it works for you."
)

# Symptom words. The ache pattern catches toothache(s) without matching "teaches".
_SYMPTOMS = re.compile(
    r"\b("
    r"pain\w*|hurt\w*|(?:tooth|jaw|gum)?aches?|aching|swell\w*|swollen|fever\w*|bleed\w*|abscess\w*|infect\w*"
    r"|sore\w*|broken|sensitiv\w*|throb\w*"
    r")\b",
    re.IGNORECASE,
)

# Fixed plain-language explanations. No dollar figures, ever.
GLOSSARY: dict[str, str] = {
    "deductible": (
        "Your deductible is the part of the bill you pay yourself before your plan starts sharing "
        "the cost. You pay it once per plan year. Many plans skip it for preventive care like cleanings."
    ),
    "coinsurance": (
        "Coinsurance is how you and your plan split the cost after the deductible. "
        "Your plan pays its share of the allowed fee, and you'll likely pay the part that's left."
    ),
    "annual maximum": (
        "Your annual maximum is the most your plan will pay toward your care in one plan year. "
        "After that, you'll likely pay the rest. When your plan year resets, eligible benefits "
        "may become available again, based on your plan's rules."
    ),
    "allowed fee": (
        "The allowed fee is the price your plan agrees a procedure is worth. "
        "Your share is worked out from this price, not from the dentist's full bill."
    ),
    "balance billing": (
        "Balance billing is when a dentist outside your network charges you the difference "
        "between their price and what your plan allows. In-network dentists usually can't do this."
    ),
    "in-network": (
        "An in-network dentist has agreed to your plan's prices. "
        "You'll usually pay less and won't be billed for the difference."
    ),
    "out-of-network": (
        "An out-of-network dentist hasn't agreed to your plan's prices. "
        "Your plan may pay less, and the dentist can bill you for the difference."
    ),
    "plan year": (
        "Your plan year is the twelve months your benefits run for. "
        "When your plan year resets, eligible benefits may become available again, based on your plan's rules."
    ),
    "waiting period": (
        "A waiting period is the time after you join a plan before some procedures are covered. "
        "Check your plan documents to see if one applies to you."
    ),
}

_ALIASES: dict[str, str] = {
    "annual max": "annual maximum",
    "maximum": "annual maximum",
    "max": "annual maximum",
    "in network": "in-network",
    "out of network": "out-of-network",
    "allowed amount": "allowed fee",
    "balance bill": "balance billing",
}


def parse(text: str) -> list[Procedure]:
    """Turn a description of recommended care into procedures.

    FAKE: ignores the text and returns Maya's procedures. The real version
    (feature/ai-parse) must return procedures locked with can_wait=False.
    """
    del text  # Unused by the fake. Never logged.
    return maya_procedures()


def explain(term: str, language: str = "en", style: str = "plain") -> str:
    """Explain an insurance term in plain words.

    FAKE: looks the term up in a fixed glossary. English and plain style only.
    Symptom questions always get the safety reply.
    """
    del language, style  # The fake supports one language and style.
    if _SYMPTOMS.search(term):
        return SAFETY_REPLY
    key = " ".join(term.lower().split())
    key = _ALIASES.get(key, key)
    return GLOSSARY.get(key, FALLBACK_REPLY)
