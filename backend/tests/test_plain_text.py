"""plain_text: strip Markdown the model adds despite being asked for plain text.

Polly reads "#" aloud as "hash" and "*" as "asterisk", so summaries and anything
sent to /speak are cleaned first. Dollar amounts must come through untouched,
because the dollar guard checks them afterwards.
"""

from __future__ import annotations

import pytest

from app.ai.plain_text import plain_text


@pytest.mark.parametrize(
    ("raw", "clean"),
    [
        # A heading line is a title the card already shows: drop it.
        ("# Your summary\nYou'll likely pay $1,975.", "You'll likely pay $1,975."),
        ("## Recap\n\nYou'll likely pay $1,975.", "You'll likely pay $1,975."),
        ("### Resumen\nProbablemente pagarás 1.975 $.", "Probablemente pagarás 1.975 $."),
        # A heading marker glued to the sentence: keep the words, drop the marker.
        ("# You'll likely pay $1,975.", "You'll likely pay $1,975."),
        # Bold, italics and code marks.
        ("You'll likely pay **$1,975**.", "You'll likely pay $1,975."),
        ("Your plan likely pays __$2,025__.", "Your plan likely pays $2,025."),
        ("It's *likely* lower.", "It's likely lower."),
        ("It's _likely_ lower.", "It's likely lower."),
        ("Use `$1,975`.", "Use $1,975."),
        # List bullets and numbered lists.
        ("- You'll likely pay $1,975.\n- Your plan likely pays $2,025.", "You'll likely pay $1,975.\nYour plan likely pays $2,025."),
        ("* One.\n+ Two.", "One.\nTwo."),
        ("> A quote.", "A quote."),
    ],
)
def test_strips_markdown(raw: str, clean: str) -> None:
    assert plain_text(raw) == clean


@pytest.mark.parametrize(
    "text",
    [
        "You'll likely pay $1,975. Your plan likely pays $2,025.",
        "Si tu dentista confirma que la corona 2 puede esperar, probablemente pagarías 1.975 $.",
        "Crown 2 on tooth #14 costs about $1,300.",  # "#" inside a sentence isn't a heading.
        "snake_case_word and 2*3 stay as they are.",
        "",
    ],
)
def test_leaves_plain_text_alone(text: str) -> None:
    assert plain_text(text) == text


def test_only_a_heading_keeps_its_words() -> None:
    assert plain_text("# You'll likely pay $1,975") == "You'll likely pay $1,975"


def test_summary_route_strips_heading(monkeypatch: pytest.MonkeyPatch) -> None:
    """End to end: a model reply that starts with "# " reaches the user without it."""
    from fastapi.testclient import TestClient

    from app.ai import bedrock
    from app.demo_data import maya_plan, maya_procedures
    from app.main import app

    monkeypatch.setattr(bedrock, "call", lambda *a, **k: "# Your recap\nYou'll likely pay $2,500 with everything now.")
    body = {
        "procedures": [p.model_dump(mode="json") for p in maya_procedures()],
        "plan": maya_plan().model_dump(mode="json"),
        "schedule": {},
        "optimize": None,
        "preferences": {"language": "en", "style": "simple", "voice_on": False},
    }
    from app.optimizer import optimize

    body["optimize"] = optimize(maya_procedures(), maya_plan()).model_dump(mode="json")
    text = TestClient(app).post("/summary", json=body).json()["text"]
    assert "#" not in text
    assert text.startswith("You'll likely pay $2,500")
