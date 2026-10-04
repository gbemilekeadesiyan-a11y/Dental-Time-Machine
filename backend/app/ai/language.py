"""Which of the app's languages a message is written in (feature/chat, Malama).

Lets the chat answer in the language the user actually typed or spoke, even if it differs
from their language setting. Counts common words that belong to only one of the four
languages; words shared between them ("de", "no", "está", "dentista") are left out. Short or
unclear messages ("ok", "1500") return None, so the caller keeps the user's setting.
No external service and nothing is logged.
"""

from __future__ import annotations

import re

from app.models import Language

_WORDS: dict[Language, frozenset[str]] = {
    "en": frozenset(
        "the and is my i what what's how need does you it this that with have of to much will can "
        "dentist said pay insurance crown crowns filling fillings root canal deductible tooth teeth "
        "hi hello thanks yes yeah not wait year next i'm it's don't".split()
    ),
    "es": frozenset(
        "el los las y mi mis necesito tengo cuánto cuanto cómo qué dijo del puede seguro muela diente "
        "dientes corona coronas empaste empastes deducible pagar pago año sí esto eso es una pero también "
        "hola gracias duele dolor cuesta cubre estoy ya listo lista puse hice tiene".split()
    ),
    "fr": frozenset(
        "et je mon ma mes est une des du besoin dentiste combien quoi couronne couronnes plombage "
        "carie franchise payer année oui merci bonjour avec pour pas ce c'est j'ai dit mais aussi vous "
        "suis il elle dent dents attendre qu'est-ce déjà fini voilà".split()
    ),
    "pt": frozenset(
        "o os e eu meu minha meus preciso tenho quanto disse da dos das com não sim coroa coroas "
        "obturação obturações franquia ano isso isto uma mas também olá obrigado obrigada dente dentes "
        "você é plano dói custa já pronto coloquei".split()
    ),
}
_TOKEN = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*")
MIN_HITS = 2


def detect(text: str) -> Language | None:
    """The language with the most distinctive words, if it has at least two and a clear lead."""
    tokens = [t.replace("’", "'") for t in _TOKEN.findall(text.lower())]
    scores = sorted(((sum(t in words for t in tokens), lang) for lang, words in _WORDS.items()), reverse=True)
    (best, language), (runner_up, _) = scores[0], scores[1]
    return language if best >= MIN_HITS and best > runner_up else None
