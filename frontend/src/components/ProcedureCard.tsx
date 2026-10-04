import { REASON_NOTES } from '../copy'
import { formatMoney } from '../format'
import type { LineResult } from '../types'

interface Props {
  /** Display name from the user's procedure list. */
  name: string
  /** The engine's answer for this procedure. Every amount shown comes from here. */
  line: LineResult
}

/**
 * One procedure's estimate: what you'll likely pay, what the dentist charges, what the plan pays.
 * Insurance terms are explained once, in the glossary accordion below the cards.
 */
export default function ProcedureCard({ name, line }: Props) {
  const notes = line.reasons.map((r) => REASON_NOTES[r]).filter((n): n is string => n !== undefined)

  return (
    <article className="glass space-y-2 rounded-3xl p-5">
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink">{name}</h3>
        {line.year === 'next_year' && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">Next plan year</span>
        )}
      </header>

      <p className="text-2xl font-medium tracking-tight text-ink tabular-nums">
        You&apos;ll likely pay {formatMoney(line.you_pay)}
      </p>
      <p className="text-sm text-muted-text tabular-nums">
        Dentist {formatMoney(line.billed_fee)} ·{' '}
        <span className="font-medium text-savings-deep">Plan {formatMoney(line.plan_pays)}</span>
      </p>

      {notes.map((note) => (
        <p key={note} className="text-sm text-muted-text">
          {note}
        </p>
      ))}
    </article>
  )
}
