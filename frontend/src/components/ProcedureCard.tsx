import { REASON_NOTES, REASON_TERMS } from '../copy'
import { formatMoney } from '../format'
import type { GlossaryTerm } from '../glossary'
import type { LineResult } from '../types'
import JargonChip from './JargonChip'

interface Props {
  /** Display name from the user's procedure list. */
  name: string
  /** The engine's answer for this procedure. Every amount shown comes from here. */
  line: LineResult
}

/** One procedure's estimate: what you'll likely pay, what the dentist charges, what the plan pays. */
export default function ProcedureCard({ name, line }: Props) {
  const terms = [...new Set(line.reasons.map((r) => REASON_TERMS[r]).filter((t): t is GlossaryTerm => t !== null))]
  const notes = line.reasons.map((r) => REASON_NOTES[r]).filter((n): n is string => n !== undefined)

  return (
    <article className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink">{name}</h3>
        {line.year === 'next_year' && (
          <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-medium text-maroon">Next plan year</span>
        )}
      </header>

      <p className="text-2xl font-bold text-ink">
        You&apos;ll likely pay {formatMoney(line.you_pay)}
      </p>
      <p className="text-sm text-muted">
        Dentist {formatMoney(line.billed_fee)} · <span className="text-savings">Plan {formatMoney(line.plan_pays)}</span>
      </p>

      {terms.length > 0 && (
        <div className="flex flex-wrap items-start gap-2" aria-label="Terms that affect this amount">
          {terms.map((t) => (
            <JargonChip key={t} term={t} />
          ))}
        </div>
      )}
      {notes.map((note) => (
        <p key={note} className="text-sm text-muted">
          {note}
        </p>
      ))}
    </article>
  )
}
