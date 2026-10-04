"""Language detection for chat replies (app/ai/language.py)."""

from __future__ import annotations

import pytest

from app.ai.language import _WORDS, detect


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("My dentist said I need a root canal and two crowns", "en"),
        ("What's a deductible and how much will I pay?", "en"),
        ("Mi dentista dijo que necesito una corona y dos empastes", "es"),
        ("¿Qué es un deducible?", "es"),
        ("Me duele la muela", "es"),
        ("listo, ya puse mi plan", "es"),
        ("Mon dentiste dit que j'ai besoin d'une couronne", "fr"),
        ("Qu'est-ce qu'une franchise ?", "fr"),
        ("Meu dentista disse que preciso de uma coroa", "pt"),
        ("O que é uma franquia?", "pt"),
    ],
)
def test_detects_each_language(text: str, expected: str) -> None:
    assert detect(text) == expected


@pytest.mark.parametrize("text", ["ok", "1500", "D2740", "", "Sí", "Crown 2?", "plan dentista"])
def test_short_or_unclear_text_is_none(text: str) -> None:
    assert detect(text) is None


def test_word_lists_do_not_overlap() -> None:
    # A shared word would count for two languages at once.
    languages = list(_WORDS)
    for i, a in enumerate(languages):
        for b in languages[i + 1 :]:
            assert not _WORDS[a] & _WORDS[b], (a, b, _WORDS[a] & _WORDS[b])
