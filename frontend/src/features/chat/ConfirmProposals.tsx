import { useId, useState } from 'react'
import { ArrowRight } from '../../components/Icons'
import Notice from '../../components/Notice'
import { procedureLabels } from '../../format'
import type { Procedure } from '../../types'
import type { ChatCopy } from './chatCopy'

interface Props {
  proposals: Procedure[]
  /** Care already confirmed, so "comes after" links to it can be named. */
  existing: Procedure[]
  copy: ChatCopy
  onConfirm: (procedures: Procedure[]) => void
  onDismiss: () => void
}

const MAX_FEE = 50_000

/**
 * Editable confirm form for procedures the assistant heard. Nothing reaches the app's
 * care list until the user presses "Add to my care". Every procedure stays locked.
 */
export default function ConfirmProposals({ proposals, existing, copy, onConfirm, onDismiss }: Props) {
  const [items, setItems] = useState(proposals)
  const [problem, setProblem] = useState(false)
  const titleId = useId()
  const names = procedureLabels([...existing, ...items])

  const update = (id: string, change: Partial<Procedure>) =>
    setItems((list) => list.map((p) => (p.id === id ? { ...p, ...change } : p)))

  function confirm() {
    const valid = items.every(
      (p) =>
        Number.isFinite(p.billed_fee) &&
        p.billed_fee >= 0 &&
        p.billed_fee <= MAX_FEE &&
        (p.tooth === null || (Number.isInteger(p.tooth) && p.tooth >= 1 && p.tooth <= 32)),
    )
    if (!valid) {
      setProblem(true)
      return
    }
    // A link to a proposal the user removed has nothing to point at any more.
    const ids = new Set([...existing, ...items].map((p) => p.id))
    onConfirm(
      items.map((p) => ({
        ...p,
        allowed_fee: p.billed_fee,
        can_wait: false,
        depends_on: p.depends_on !== null && ids.has(p.depends_on) ? p.depends_on : null,
      })),
    )
  }

  return (
    <section aria-labelledby={titleId} className="space-y-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ink/5">
      <div className="space-y-1">
        <h4 id={titleId} className="font-semibold text-ink">
          {copy.proposalsTitle}
        </h4>
        <p className="text-sm text-muted-text">{copy.proposalsHelp}</p>
      </div>

      <ul className="space-y-3">
        {items.map((p) => (
          <ProposalRow
            key={p.id}
            procedure={p}
            after={p.depends_on === null ? undefined : names.get(p.depends_on)}
            linkedTo={proposals.find((x) => x.id === p.id)?.depends_on ?? null}
            copy={copy}
            onChange={(c) => update(p.id, c)}
            onRemove={() => setItems((l) => l.filter((x) => x.id !== p.id))}
          />
        ))}
      </ul>

      {problem && <Notice tone="problem">{copy.feeProblem}</Notice>}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={confirm} disabled={items.length === 0} className="btn-primary">
          {copy.addToCare}
          <ArrowRight />
        </button>
        <button type="button" onClick={onDismiss} className="btn-secondary">
          {copy.notNow}
        </button>
      </div>
    </section>
  )
}

function ProposalRow(props: {
  procedure: Procedure
  /** Name of the procedure this one comes after, while linked. */
  after: string | undefined
  /** The link the backend proposed, so the user can switch it back on. */
  linkedTo: string | null
  copy: ChatCopy
  onChange: (change: Partial<Procedure>) => void
  onRemove: () => void
}) {
  const { procedure: p, copy } = props
  const feeId = useId()
  const toothId = useId()
  const linkId = useId()
  return (
    <li className="grid gap-3 rounded-xl p-3 ring-1 ring-ink/5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
      <div className="space-y-1">
        <p className="font-medium text-ink">{p.name}</p>
        <p className="text-xs text-muted-text">Code {p.cdt_code}</p>
        {props.linkedTo !== null && (
          <div className="flex min-h-11 items-center gap-2">
            <input
              id={linkId}
              type="checkbox"
              checked={p.depends_on !== null}
              onChange={(e) => props.onChange({ depends_on: e.target.checked ? props.linkedTo : null })}
              className="size-5 accent-primary"
            />
            <label htmlFor={linkId} className="text-xs text-ink">
              {copy.comesAfter(props.after ?? props.linkedTo)}
            </label>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor={feeId} className="text-xs font-medium text-ink">
          {copy.feeLabel}
        </label>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-muted-text">
            $
          </span>
          <input
            id={feeId}
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_FEE}
            step="any"
            value={Number.isNaN(p.billed_fee) ? '' : p.billed_fee}
            onChange={(e) => props.onChange({ billed_fee: e.target.value === '' ? Number.NaN : e.target.valueAsNumber })}
            className="field w-28 tabular-nums"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor={toothId} className="text-xs font-medium text-ink">
          {copy.toothLabel}
        </label>
        <input
          id={toothId}
          type="number"
          inputMode="numeric"
          min={1}
          max={32}
          step={1}
          value={p.tooth ?? ''}
          onChange={(e) => props.onChange({ tooth: e.target.value === '' ? null : e.target.valueAsNumber })}
          className="field w-20 tabular-nums"
        />
      </div>
      <button type="button" onClick={props.onRemove} className="btn-secondary">
        {copy.remove}
      </button>
    </li>
  )
}
