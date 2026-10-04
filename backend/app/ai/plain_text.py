"""Strip Markdown from model text before it is shown or spoken.

Prompts ask for plain text, but models still add "# Title" or "**bold**" at times.
Polly then reads the symbols aloud ("hash", "asterisk"). This removes the markup
and keeps every word and amount as written, so the dollar guard still sees the
same figures afterwards.
"""

from __future__ import annotations

import re

_HEADING = re.compile(r"^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$")
_LINE_PREFIX = re.compile(r"^\s*(?:>\s?|[-*+]\s+|\d{1,2}[.)]\s+)")
_INLINE = [
    (re.compile(r"\*\*(.+?)\*\*"), r"\1"),
    (re.compile(r"__(.+?)__"), r"\1"),
    # Single * or _ only when wrapping words, so "2*3" and snake_case_words stay.
    (re.compile(r"(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)"), r"\1"),
    (re.compile(r"(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)"), r"\1"),
    (re.compile(r"`([^`]*)`"), r"\1"),
]


def plain_text(text: str) -> str:
    """The text without Markdown headings, list markers, quotes, bold, italics or code marks.

    A heading line is dropped when other text follows (the screen already has a title);
    when the heading is all there is, its words are kept.
    """
    lines = [line for line in text.splitlines() if line.strip()]
    headings = [_HEADING.match(line) for line in lines]
    has_body = any(match is None for match in headings)

    kept: list[str] = []
    for line, heading in zip(lines, headings):
        if heading:
            if has_body:
                continue
            line = heading.group(1)
        line = _LINE_PREFIX.sub("", line)
        for pattern, replacement in _INLINE:
            line = pattern.sub(replacement, line)
        kept.append(line)
    return "\n".join(kept)
