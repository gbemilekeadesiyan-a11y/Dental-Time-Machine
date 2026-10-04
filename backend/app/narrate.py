"""The step-by-step guide's script (feature/guide). No LLM: fixed templates in the user's
language and style, filled with the engine's figures (CLAUDE.md section 2).

Each segment is one short sentence tied to a data-narrate id on the page. Every segment
passes the dollar guard against the engine results, and anything it can't vouch for is
dropped. Each step ends with the section 12 disclaimer.
"""

from __future__ import annotations

import re

from app import sockets
from app.ai.dollar_guard import allowed_amounts, unknown_amounts
from app.engine import calculate
from app.models import Language, NarrateRequest, NarrateResponse, NarrateSegment, NarrateStep, Result
from app.optimizer import optimize

money = sockets.format_money

_NEXT: dict[NarrateStep, NarrateStep | None] = {
    "what_it_means": "two_futures",
    "two_futures": "summary",
    "summary": "find_care",
    "find_care": "your_year",
    "your_year": None,
}

# Wording the guide must never produce (CLAUDE.md section 12): telling users to wait,
# ranking plans, recommending, saying they owe, or promising a second annual maximum.
_UNSAFE = re.compile(
    r"should wait|you should|best plan|recommend|recomend|recommand|you owe"
    r"|\b(second|another|two|extra) (annual )?max",
    re.IGNORECASE,
)

# A key maps to one text, or to (simple, detailed). The "numbers" style uses "detailed".
_Text = str | tuple[str, str]

_TEMPLATES: dict[Language, dict[str, _Text]] = {
    "en": {
        "total": (
            "Altogether, you'll likely pay {amount}.",
            "Altogether, after your plan pays its share, you'll likely pay {amount}.",
        ),
        "proc": ("{name}: about {amount}.", "{name}: you'd likely pay about {amount}."),
        "terms": ("Tap any insurance word to see what it means.", "Open any insurance word below for a plain explanation."),
        "all_now": (
            "If you get everything this plan year, you'd likely pay {amount}.",
            "If you get all your care this plan year, you'd likely pay {amount} in total.",
        ),
        "best_moved": "If your dentist confirms {names} {wait}, you'd likely pay {amount}, about {savings} less.",
        "best_none": "With your dentist's current advice, getting everything now is your lowest likely cost.",
        "timeline_move": "You can move visits on the timeline to fit your budget.",
        "timeline_only": "Only move care your dentist says can wait.",
        "plan_pays": ("Your plan likely pays {amount}.", "With the timing you chose, your plan likely pays {amount}."),
        "you_pay": ("You'd likely pay {amount}.", "With that timing, you'd likely pay {amount}."),
        "max_left": (
            "You'd have about {amount} of your yearly maximum left this plan year.",
            "That leaves about {amount} of your yearly maximum for the rest of this plan year.",
        ),
        "reset_on": "Your plan year resets on {date}.",
        "reminder": "Add a reminder to your calendar so you don't miss your visits or your reset date.",
        "find_here": "Here you can find dentists near you and check costs.",
        "filters": "Use the filters for distance, network, language and your budget.",
        "demo_data": "Network and language details are demo data for now, so check with the office.",
        "compare": "You can compare plan options side by side, and the choice is yours.",
        "year_this": "This plan year you'd likely pay {amount}.",
        "year_next": "Next plan year, you'd likely pay about {amount}.",
        "plan_ahead": "Plan ahead: book early in your new plan year and keep your reminder.",
    },
    "es": {
        "total": (
            "En total, probablemente pagarías {amount}.",
            "En total, después de lo que paga tu plan, probablemente pagarías {amount}.",
        ),
        "proc": ("{name}: unos {amount}.", "{name}: probablemente pagarías unos {amount}."),
        "terms": (
            "Toca cualquier palabra de seguros para ver qué significa.",
            "Abre cualquier palabra de seguros abajo para una explicación sencilla.",
        ),
        "all_now": (
            "Si te haces todo este año del plan, probablemente pagarías {amount}.",
            "Si te haces todo el tratamiento este año del plan, pagarías unos {amount} en total.",
        ),
        "best_moved": "Si tu dentista confirma que {names} {wait}, pagarías unos {amount}, unos {savings} menos.",
        "best_none": "Con lo que tu dentista indica ahora, hacerte todo ahora es tu costo probable más bajo.",
        "timeline_move": "Puedes mover visitas en la línea de tiempo para ajustarte a tu presupuesto.",
        "timeline_only": "Mueve solo la atención que tu dentista dice que puede esperar.",
        "plan_pays": (
            "Tu plan probablemente paga {amount}.",
            "Con el momento que elegiste, tu plan probablemente paga {amount}.",
        ),
        "you_pay": ("Probablemente pagarías {amount}.", "Con ese momento, probablemente pagarías {amount}."),
        "max_left": (
            "Te quedarían unos {amount} de tu máximo anual este año del plan.",
            "Eso deja unos {amount} de tu máximo anual para el resto de este año del plan.",
        ),
        "reset_on": "Tu año del plan se reinicia el {date}.",
        "reminder": "Agrega un recordatorio a tu calendario para no olvidar tus citas ni la fecha de reinicio.",
        "find_here": "Aquí puedes buscar dentistas cerca de ti y revisar costos.",
        "filters": "Usa los filtros de distancia, red, idioma y presupuesto.",
        "demo_data": "Los datos de red e idioma son de demostración por ahora; confírmalos con el consultorio.",
        "compare": "Puedes comparar opciones de plan lado a lado, y la decisión es tuya.",
        "year_this": "Este año del plan probablemente pagarías {amount}.",
        "year_next": "El próximo año del plan, pagarías unos {amount}.",
        "plan_ahead": "Planea con tiempo: reserva temprano en tu nuevo año del plan y guarda tu recordatorio.",
    },
    "fr": {
        "total": (
            "Au total, vous paieriez probablement {amount}.",
            "Au total, après la part de votre régime, vous paieriez probablement {amount}.",
        ),
        "proc": ("{name} : environ {amount}.", "{name} : vous paieriez environ {amount}."),
        "terms": (
            "Touchez un mot d'assurance pour voir ce qu'il veut dire.",
            "Ouvrez un mot d'assurance ci-dessous pour une explication simple.",
        ),
        "all_now": (
            "Si vous faites tout cette année du régime, vous paieriez probablement {amount}.",
            "Si vous faites tous vos soins cette année du régime, vous paieriez environ {amount} au total.",
        ),
        "best_moved": "Si votre dentiste confirme que {names} {wait}, vous paieriez environ {amount}, soit environ {savings} de moins.",
        "best_none": "Selon l'avis actuel de votre dentiste, tout faire maintenant est votre coût probable le plus bas.",
        "timeline_move": "Vous pouvez déplacer des visites sur la frise pour respecter votre budget.",
        "timeline_only": "Ne déplacez que les soins dont votre dentiste dit qu'ils peuvent attendre.",
        "plan_pays": (
            "Votre régime paierait probablement {amount}.",
            "Avec le calendrier choisi, votre régime paierait probablement {amount}.",
        ),
        "you_pay": ("Vous paieriez probablement {amount}.", "Avec ce calendrier, vous paieriez probablement {amount}."),
        "max_left": (
            "Il vous resterait environ {amount} de votre maximum annuel cette année du régime.",
            "Cela laisse environ {amount} de votre maximum annuel pour le reste de l'année du régime.",
        ),
        "reset_on": "L'année de votre régime recommence le {date}.",
        "reminder": "Ajoutez un rappel à votre calendrier pour ne pas oublier vos rendez-vous ni la date de reprise.",
        "find_here": "Ici, vous pouvez trouver des dentistes près de chez vous et vérifier les coûts.",
        "filters": "Utilisez les filtres de distance, de réseau, de langue et de budget.",
        "demo_data": "Les infos de réseau et de langue sont des données de démonstration pour l'instant.",
        "compare": "Vous pouvez comparer les options de régime côte à côte, et le choix vous appartient.",
        "year_this": "Cette année du régime, vous paieriez probablement {amount}.",
        "year_next": "L'année prochaine du régime, environ {amount}.",
        "plan_ahead": "Prenez de l'avance : réservez tôt dans la nouvelle année du régime et gardez votre rappel.",
    },
    "pt": {
        "total": (
            "No total, você provavelmente pagaria {amount}.",
            "No total, depois da parte do seu plano, você provavelmente pagaria {amount}.",
        ),
        "proc": ("{name}: cerca de {amount}.", "{name}: você pagaria cerca de {amount}."),
        "terms": (
            "Toque em qualquer termo de seguro para ver o que significa.",
            "Abra qualquer termo de seguro abaixo para uma explicação simples.",
        ),
        "all_now": (
            "Se fizer tudo neste ano do plano, você provavelmente pagaria {amount}.",
            "Se fizer todo o tratamento neste ano do plano, você pagaria cerca de {amount} no total.",
        ),
        "best_moved": "Se seu dentista confirmar que {names} {wait}, você pagaria cerca de {amount}, uns {savings} a menos.",
        "best_none": "Com a orientação atual do seu dentista, fazer tudo agora é o seu menor custo provável.",
        "timeline_move": "Você pode mover consultas na linha do tempo para caber no seu orçamento.",
        "timeline_only": "Só mova o tratamento que seu dentista diz que pode esperar.",
        "plan_pays": (
            "Seu plano provavelmente paga {amount}.",
            "Com o momento que você escolheu, seu plano provavelmente paga {amount}.",
        ),
        "you_pay": ("Você provavelmente pagaria {amount}.", "Com esse momento, você provavelmente pagaria {amount}."),
        "max_left": (
            "Sobrariam cerca de {amount} do seu máximo anual neste ano do plano.",
            "Isso deixa cerca de {amount} do seu máximo anual para o resto deste ano do plano.",
        ),
        "reset_on": "O ano do seu plano reinicia em {date}.",
        "reminder": "Adicione um lembrete ao seu calendário para não esquecer suas consultas nem a data de reinício.",
        "find_here": "Aqui você pode encontrar dentistas perto de você e ver os custos.",
        "filters": "Use os filtros de distância, rede, idioma e orçamento.",
        "demo_data": "Os dados de rede e idioma são de demonstração por enquanto; confirme com o consultório.",
        "compare": "Você pode comparar opções de plano lado a lado, e a escolha é sua.",
        "year_this": "Neste ano do plano, você provavelmente pagaria {amount}.",
        "year_next": "No próximo ano do plano, cerca de {amount}.",
        "plan_ahead": "Planeje com antecedência: marque cedo no novo ano do plano e guarde seu lembrete.",
    },
}

# "can wait" for one procedure, or for several.
_WAIT: dict[Language, tuple[str, str]] = {
    "en": ("can wait", "can wait"),
    "es": ("puede esperar", "pueden esperar"),
    "fr": ("peut attendre", "peuvent attendre"),
    "pt": ("pode esperar", "podem esperar"),
}
_AND: dict[Language, str] = {"en": "and", "es": "y", "fr": "et", "pt": "e"}

_NEXT_LABELS: dict[Language, dict[NarrateStep | None, str]] = {
    "en": {"two_futures": "See your two futures", "summary": "See your summary", "find_care": "Find care", "your_year": "See your year", None: "You're all set"},
    "es": {"two_futures": "Ver tus dos futuros", "summary": "Ver tu resumen", "find_care": "Buscar atención", "your_year": "Ver tu año", None: "Todo listo"},
    "fr": {"two_futures": "Voir vos deux avenirs", "summary": "Voir votre résumé", "find_care": "Trouver des soins", "your_year": "Voir votre année", None: "C'est terminé"},
    "pt": {"two_futures": "Ver seus dois futuros", "summary": "Ver seu resumo", "find_care": "Encontrar atendimento", "your_year": "Ver seu ano", None: "Tudo pronto"},
}

_MONTHS: dict[Language, tuple[str, ...]] = {
    "en": ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"),
    "es": ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"),
    "fr": ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"),
    "pt": ("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"),
}


def date_in_words(reset_date: str, language: Language) -> str:
    """ "01-01" as "January 1", "1 de enero", "1er janvier" or "1º de janeiro"."""
    month_text, day_text = reset_date.split("-")
    month, day = _MONTHS[language][int(month_text) - 1], int(day_text)
    if language == "en":
        return f"{month} {day}"
    if language == "fr":
        return f"{'1er' if day == 1 else day} {month}"
    if language == "pt":
        return f"{'1º' if day == 1 else day} de {month}"
    return f"{day} de {month}"


def _names_list(names: list[str], language: Language) -> str:
    if len(names) <= 1:
        return "".join(names)
    return f"{', '.join(names[:-1])} {_AND[language]} {names[-1]}"


def guarded(segments: list[NarrateSegment], allowed: set[float]) -> list[NarrateSegment]:
    """Only segments whose every dollar figure is an engine figure, with safe wording."""
    return [s for s in segments if not unknown_amounts(s.text, allowed) and not _UNSAFE.search(s.text)]


class _Script:
    """Builds one step's segments in one language and style."""

    def __init__(self, language: Language, detailed: bool) -> None:
        self.language = language
        self.detailed = detailed
        self.segments: list[NarrateSegment] = []

    def say(self, key: str, target: str | None, pause_ms: int, **values: str) -> None:
        text = _TEMPLATES[self.language][key]
        if isinstance(text, tuple):
            text = text[1] if self.detailed else text[0]
        self.segments.append(NarrateSegment(text=text.format(**values), target=target, pause_ms=pause_ms))

    def raw(self, text: str, target: str | None, pause_ms: int) -> None:
        self.segments.append(NarrateSegment(text=text, target=target, pause_ms=pause_ms))


def _year_totals(result: Result) -> tuple[float, float]:
    """What the user likely pays in each plan year: the engine's per-procedure figures, added up."""
    this_year = sum(line.you_pay for line in result.per_procedure if line.year == "this_year")
    next_year = sum(line.you_pay for line in result.per_procedure if line.year == "next_year")
    return round(this_year, 2), round(next_year, 2)


def narrate(request: NarrateRequest) -> NarrateResponse:
    """The guide's segments for one step, ready to show and speak."""
    language = request.preferences.language
    script = _Script(language, detailed=request.preferences.style != "simple")
    names = sockets.display_names(request.procedures)
    current = calculate(request.procedures, request.plan, request.schedule)
    this_year, next_year = _year_totals(current)
    allowed = allowed_amounts(current, request.plan, request.procedures) | {this_year, next_year}

    step = request.step
    if step == "what_it_means":
        script.say("total", "total", 600, amount=money(current.totals.you_pay))
        # The three procedures the user likely pays the most for (ties keep the engine's order).
        top = sorted(current.per_procedure, key=lambda line: -line.you_pay)[:3]
        for line in top:
            script.say("proc", f"proc-{line.id}", 300, name=names.get(line.id, line.id), amount=money(line.you_pay))
        script.say("terms", "terms", 500)
    elif step == "two_futures":
        result = optimize(request.procedures, request.plan)
        allowed |= allowed_amounts(result)
        script.say("all_now", "all-now", 500, amount=money(result.all_now.totals.you_pay))
        if result.moved:
            moved = [names.get(i, i) for i in result.moved]
            script.say(
                "best_moved",
                "best",
                600,
                names=_names_list(moved, language),
                wait=_WAIT[language][len(moved) > 1],
                amount=money(result.best.totals.you_pay),
                savings=money(result.savings),
            )
        else:
            script.say("best_none", "best", 600)
        script.say("timeline_move", "timeline", 300)
        script.say("timeline_only", "timeline", 500)
    elif step == "summary":
        script.say("plan_pays", "summary-plan", 400, amount=money(current.totals.plan_pays))
        script.say("you_pay", "summary-you", 400, amount=money(current.totals.you_pay))
        script.say("max_left", "summary-max", 600, amount=money(current.max_left.this_year))
        script.say("reset_on", "reset", 300, date=date_in_words(request.plan.reset_date, language))
        script.raw(sockets.RESET_TEXT[language], "reset", 500)  # Word for word (CLAUDE.md section 12).
        script.say("reminder", "reminder", 400)
    elif step == "find_care":
        script.say("find_here", "filters", 400)
        script.say("filters", "filters", 400)
        script.say("demo_data", "filters", 400)
        script.say("compare", "plan-compare", 400)
    else:  # your_year
        script.say("year_this", "year-this", 400, amount=money(this_year))
        if next_year > 0:
            script.say("year_next", "year-next", 400, amount=money(next_year))
        script.say("plan_ahead", "plan-ahead", 500)

    script.raw(sockets.DISCLAIMERS[language], None, 0)
    next_step = _NEXT[step]
    return NarrateResponse(
        segments=guarded(script.segments, allowed),
        next_step=next_step,
        next_label=_NEXT_LABELS[language][next_step],
    )
