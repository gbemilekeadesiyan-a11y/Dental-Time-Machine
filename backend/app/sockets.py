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
from app.models import ChatRequest, ChatResponse, DocumentReadResult, Language, Procedure, SummaryRequest

SAFETY_REPLY = (
    "I can't help with symptoms or what's happening in your mouth. "
    "If you have pain, swelling, or fever, contact a dentist today. "
    "For anything else about your care, your dentist is the best person to ask."
)

DOCUMENT_FALLBACK_WARNING = (
    "We couldn't read this document automatically. "
    "Please check your plan documents and enter your details below."
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


def read_document(data: bytes, kind: str) -> DocumentReadResult:
    """Read plan details and procedures from an uploaded document.

    FAKE: reads nothing and proposes nothing, so the confirm form opens empty
    with a warning. The real version (feature/documents) must treat document
    text as data, keep CDT codes to the catalog, and never apply results directly.
    """
    del data, kind  # Unused by the fake. Never logged.
    return DocumentReadResult(plan=None, procedures=[], fields_found=[], warnings=[DOCUMENT_FALLBACK_WARNING])


# ======================================================================
# Chat and summary fallbacks (feature/chat). Used whenever Bedrock fails,
# times out, or its text fails the dollar guard. Fixed text in en/es/fr/pt.
# ======================================================================

SAFETY_REPLIES: dict[Language, str] = {
    "en": "I can't assess symptoms. Please contact a dentist today.",
    "es": "No puedo evaluar síntomas. Por favor, contacta a un dentista hoy.",
    "fr": "Je ne peux pas évaluer les symptômes. Veuillez contacter un dentiste aujourd'hui.",
    "pt": "Não posso avaliar sintomas. Por favor, entre em contato com um dentista hoje.",
}

DISCLAIMERS: dict[Language, str] = {
    "en": "Estimate, not medical or coverage advice. Confirm with your dentist and plan.",
    "es": "Estimación, no es consejo médico ni de cobertura. Confírmalo con tu dentista y tu plan.",
    "fr": "Estimation, pas un avis médical ni de couverture. Vérifiez auprès de votre dentiste et de votre régime.",
    "pt": "Estimativa, não é orientação médica nem de cobertura. Confirme com seu dentista e seu plano.",
}

RESET_TEXT: dict[Language, str] = {
    "en": "When your plan year resets, eligible benefits may become available again, based on your plan's rules.",
    "es": (
        "Cuando tu año del plan se reinicie, los beneficios elegibles pueden volver a estar disponibles, "
        "según las reglas de tu plan."
    ),
    "fr": (
        "Lorsque l'année de votre régime recommence, les prestations admissibles peuvent redevenir "
        "disponibles, selon les règles de votre régime."
    ),
    "pt": (
        "Quando o ano do seu plano reiniciar, os benefícios elegíveis podem ficar disponíveis novamente, "
        "conforme as regras do seu plano."
    ),
}

CHAT_TEXT: dict[str, dict[Language, str]] = {
    "greet": {
        "en": "Tell me what your dentist recommended, in your own words. You can also use the form.",
        "es": "Cuéntame qué te recomendó tu dentista, con tus propias palabras. También puedes usar el formulario.",
        "fr": (
            "Dites-moi ce que votre dentiste vous a recommandé, avec vos propres mots. "
            "Vous pouvez aussi utiliser le formulaire."
        ),
        "pt": (
            "Conte-me o que seu dentista recomendou, com suas próprias palavras. "
            "Você também pode usar o formulário."
        ),
    },
    "unavailable": {
        "en": "I can't read your message right now. Please add your procedures and plan details on the form.",
        "es": (
            "No puedo leer tu mensaje en este momento. "
            "Agrega tus procedimientos y los datos de tu plan en el formulario."
        ),
        "fr": (
            "Je ne peux pas lire votre message pour le moment. "
            "Ajoutez vos soins et les détails de votre régime dans le formulaire."
        ),
        "pt": "Não consigo ler sua mensagem agora. Adicione seus procedimentos e os dados do seu plano no formulário.",
    },
    "ready": {
        "en": "Thanks. Please check your procedures and plan details on the form, then continue.",
        "es": "Gracias. Revisa tus procedimientos y los datos de tu plan en el formulario y luego continúa.",
        "fr": "Merci. Vérifiez vos soins et les détails de votre régime dans le formulaire, puis continuez.",
        "pt": "Obrigado. Confira seus procedimentos e os dados do seu plano no formulário e depois continue.",
    },
}

SUMMARY_TEXT: dict[str, dict[Language, str]] = {
    "all_now": {
        "en": "If you get all of this care in this plan year, you'll likely pay {all_now}.",
        "es": "Si recibes toda esta atención en este año del plan, probablemente pagarás {all_now}.",
        "fr": "Si vous recevez tous ces soins pendant cette année du régime, vous paierez probablement {all_now}.",
        "pt": "Se você fizer todo este tratamento neste ano do plano, provavelmente pagará {all_now}.",
    },
    "savings": {
        "en": (
            "If your dentist confirms that some care can wait until your plan year resets ({names}), "
            "you'd likely pay {best}, about {savings} less."
        ),
        "es": (
            "Si tu dentista confirma que parte de la atención puede esperar hasta que se reinicie tu año "
            "del plan ({names}), probablemente pagarías {best}, unos {savings} menos."
        ),
        "fr": (
            "Si votre dentiste confirme qu'une partie des soins peut attendre la nouvelle année du régime "
            "({names}), vous paieriez probablement {best}, soit environ {savings} de moins."
        ),
        "pt": (
            "Se seu dentista confirmar que parte do tratamento pode esperar até o ano do plano reiniciar "
            "({names}), você provavelmente pagaria {best}, cerca de {savings} a menos."
        ),
    },
    "no_savings": {
        "en": "Changing when you get this care wouldn't lower your estimate.",
        "es": "Cambiar cuándo recibes esta atención no reduciría tu estimación.",
        "fr": "Changer le moment de ces soins ne réduirait pas votre estimation.",
        "pt": "Mudar quando você faz este tratamento não reduziria sua estimativa.",
    },
    "details": {
        "en": "Your plan would likely pay {plan}, and {left} of this year's annual maximum would be left.",
        "es": "Tu plan probablemente pagaría {plan}, y quedarían {left} de tu máximo anual de este año.",
        "fr": "Votre régime paierait probablement {plan}, et il resterait {left} sur votre maximum annuel de cette année.",
        "pt": "Seu plano provavelmente pagaria {plan}, e restariam {left} do seu máximo anual deste ano.",
    },
}

# Symptom words in Spanish, French and Portuguese, alongside the English _SYMPTOMS.
_SYMPTOMS_INTL = re.compile(
    r"\b("
    r"dolor\w*|duel[eo]n?|hinchad\w*|hinchazón|inflamad\w*|inflamación|fiebre|sangr\w*|rot[oa]s?"
    r"|absceso|infecci[oó]n|sensibilidad"
    r"|douleur\w*|douloureu\w*|mal\s+(?:aux?|à\s+la)|gonfl\w*|enflé\w*|fièvre|saign\w*|cassée?s?|abcès"
    r"|sensibilité"
    r"|dor(?:es)?|dói|doendo|inchad\w*|inchaço|inflamação|febre|quebrad\w*|abscesso|infecção"
    r"|sensível|sensibilidade"
    r")\b",
    re.IGNORECASE,
)


def has_symptoms(text: str) -> bool:
    """True if the text mentions a symptom in English, Spanish, French or Portuguese."""
    return bool(_SYMPTOMS.search(text) or _SYMPTOMS_INTL.search(text))


def chat(request: ChatRequest) -> ChatResponse:
    """FAKE chat: fixed replies, never proposes procedures or decides care can wait."""
    language = request.preferences.language
    user_turns = [t.text for t in request.turns if t.role == "user"]
    if user_turns and has_symptoms(user_turns[-1]):
        say, done = SAFETY_REPLIES[language], False
    elif not user_turns:
        say, done = CHAT_TEXT["greet"][language], False
    elif request.procedures and request.plan is not None:
        say, done = CHAT_TEXT["ready"][language], True
    else:
        say, done = CHAT_TEXT["unavailable"][language], False
    return ChatResponse(say=say, proposed_procedures=[], proposed_can_wait=[], done_intake=done)


def format_money(value: float) -> str:
    return f"${value:,.0f}" if float(value).is_integer() else f"${value:,.2f}"


def display_names(procedures: list[Procedure]) -> dict[str, str]:
    """Procedure id to a readable name; repeated names get a number ("Crown 2")."""
    totals: dict[str, int] = {}
    for p in procedures:
        totals[p.name] = totals.get(p.name, 0) + 1
    seen: dict[str, int] = {}
    names: dict[str, str] = {}
    for p in procedures:
        seen[p.name] = seen.get(p.name, 0) + 1
        names[p.id] = f"{p.name} {seen[p.name]}" if totals[p.name] > 1 else p.name
    return names


def summary(request: SummaryRequest) -> str:
    """FAKE summary: a fixed recap built only from the engine's OptimizeResult."""
    language = request.preferences.language
    result = request.optimize
    parts = [SUMMARY_TEXT["all_now"][language].format(all_now=format_money(result.all_now.totals.you_pay))]
    if result.moved and result.savings > 0:
        names = display_names(request.procedures)
        parts.append(
            SUMMARY_TEXT["savings"][language].format(
                names=", ".join(names.get(i, i) for i in result.moved),
                best=format_money(result.best.totals.you_pay),
                savings=format_money(result.savings),
            )
        )
    else:
        parts.append(SUMMARY_TEXT["no_savings"][language])
    if request.preferences.style in ("detailed", "numbers"):
        parts.append(
            SUMMARY_TEXT["details"][language].format(
                plan=format_money(result.best.totals.plan_pays), left=format_money(result.best.max_left.this_year)
            )
        )
    parts.append(RESET_TEXT[language])
    parts.append(DISCLAIMERS[language])
    return " ".join(parts)
