import { useId, useState } from 'react'
import { ArrowRight } from '../../components/Icons'
import Notice from '../../components/Notice'
import { CATEGORY_LABELS } from '../../copy'
import { procedureLabels } from '../../format'
import type { Coverage, DocumentReadResult, Plan, Procedure } from '../../types'

/** Mirrors the backend fee cap (CLAUDE.md section 12: fees 0-50,000). */
const MAX_FEE = 50_000

/** Plan fields the reader can find, in the order we list them. */
const PLAN_FIELDS: { key: string; label: string }[] = [
  { key: 'annual_max', label: 'Annual maximum' },
  { key: 'deductible', label: 'Deductible' },
  { key: 'coverage.preventive', label: 'Preventive coverage' },
  { key: 'coverage.basic', label: 'Basic coverage' },
  { key: 'coverage.major', label: 'Major coverage' },
  { key: 'reset_date', label: 'Plan year reset date' },
  { key: 'used_this_year', label: 'Benefits used this year' },
  { key: 'in_network', label: 'In-network' },
]

interface Row {
  procedure: Procedure
  include: boolean
}

interface Props {
  result: DocumentReadResult
  onConfirm: (plan: Plan | null, procedures: Procedure[]) => void
  onCancel: () => void
}

/**
 * Shows what the document reader found, every value editable, before anything
 * is used (CLAUDE.md section 10: never auto-applies). Fees from the document
 * only count once the user confirms them here. Every procedure arrives locked.
 */
export default function DocumentConfirm({ result, onConfirm, onCancel }: Props) {
  const [plan, setPlan] = useState<Plan | null>(() => blankMissing(result.plan, result.fields_found))
  const [rows, setRows] = useState<Row[]>(() =>
    result.procedures.map((p) => ({ procedure: { ...p, can_wait: false }, include: true })),
  )

  const found = PLAN_FIELDS.filter((f) => result.fields_found.includes(f.key))
  const missing = PLAN_FIELDS.filter((f) => !result.fields_found.includes(f.key))
  const nothingFound = plan === null && rows.length === 0
  const problem = validate(plan, rows)
  const labels = procedureLabels(rows.map((r) => r.procedure))

  function setFee(id: string, fee: number) {
    setRows((current) =>
      current.map((r) =>
        r.procedure.id === id ? { ...r, procedure: { ...r.procedure, billed_fee: fee, allowed_fee: fee } } : r,
      ),
    )
  }

  function setInclude(id: string, include: boolean) {
    setRows((current) => current.map((r) => (r.procedure.id === id ? { ...r, include } : r)))
  }

  function confirm() {
    if (problem) return
    onConfirm(plan, rows.filter((r) => r.include).map((r) => r.procedure))
  }

  return (
    <section aria-labelledby="document-confirm-title" className="glass space-y-6 rounded-3xl p-5 sm:p-6">
      <div className="space-y-1">
        <h3 id="document-confirm-title" className="text-xl font-semibold tracking-tight text-ink">
          Check what we found
        </h3>
        <p className="text-sm text-muted-text">
          Nothing is used until you confirm. Compare each value with your document and fix anything that looks wrong.
        </p>
      </div>

      {result.warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}

      {!nothingFound && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldList title="What we found" items={found.map((f) => f.label)} empty="No plan details" found />
          <FieldList title="What we couldn't find" items={missing.map((f) => f.label)} empty="Nothing missing" />
        </div>
      )}

      {plan && <PlanFields plan={plan} onChange={setPlan} />}

      {rows.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 font-semibold text-ink">Procedures</legend>
          <ul className="space-y-3">
            {rows.map((r) => (
              <ProcedureRow
                key={r.procedure.id}
                row={r}
                label={labels.get(r.procedure.id) ?? r.procedure.name}
                onFee={(fee) => setFee(r.procedure.id, fee)}
                onInclude={(include) => setInclude(r.procedure.id, include)}
              />
            ))}
          </ul>
        </fieldset>
      )}

      {problem && !nothingFound && <Notice tone="problem">{problem}</Notice>}

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">
          {nothingFound ? 'Try another file' : 'Discard'}
        </button>
        {!nothingFound && (
          <button type="button" onClick={confirm} disabled={problem !== null} className="btn-primary">
            Use these details
            <ArrowRight />
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * The backend fills plan fields it didn't find with placeholders (Plan needs
 * every field). Blank them so the user types the real value; we never show a
 * number the document didn't contain.
 */
function blankMissing(plan: Plan | null, found: string[]): Plan | null {
  if (!plan) return null
  const has = (key: string) => found.includes(key)
  return {
    ...plan,
    annual_max: has('annual_max') ? plan.annual_max : Number.NaN,
    deductible: has('deductible') ? plan.deductible : Number.NaN,
    coverage: {
      preventive: has('coverage.preventive') ? plan.coverage.preventive : Number.NaN,
      basic: has('coverage.basic') ? plan.coverage.basic : Number.NaN,
      major: has('coverage.major') ? plan.coverage.major : Number.NaN,
    },
    reset_date: has('reset_date') ? plan.reset_date : '',
  }
}

/** The first thing stopping the user from confirming, or null when everything is valid. */
function validate(plan: Plan | null, rows: Row[]): string | null {
  const included = rows.filter((r) => r.include)
  if (plan === null && included.length === 0) return 'Include at least one procedure, or discard.'
  for (const { procedure } of included) {
    if (!isMoney(procedure.billed_fee)) return `Check the fee for ${procedure.name.toLowerCase()}. It must be between $0 and $50,000.`
  }
  if (plan) {
    if (!isMoney(plan.annual_max)) return 'Check the annual maximum. It must be between $0 and $50,000.'
    if (!isMoney(plan.deductible)) return 'Check the deductible. It must be between $0 and $50,000.'
    if (!isMoney(plan.used_this_year)) return 'Check benefits used this year. It must be between $0 and $50,000.'
    for (const key of ['preventive', 'basic', 'major'] as const) {
      const v = plan.coverage[key]
      if (!Number.isFinite(v) || v < 0 || v > 1) return `Check ${key} coverage. It must be between 0% and 100%.`
    }
    if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(plan.reset_date)) {
      return 'Check the reset date. It must look like MM-DD, for example 01-01.'
    }
  }
  return null
}

function isMoney(v: number): boolean {
  return Number.isFinite(v) && v >= 0 && v <= MAX_FEE
}

// ---------- pieces ----------

function FieldList(props: { title: string; items: string[]; empty: string; found?: boolean }) {
  const { title, items, empty, found = false } = props
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ink/5">
      <h4 className="mb-2 text-sm font-semibold text-ink">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted-text">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((label) => (
            <li
              key={label}
              className={
                'rounded-full px-3 py-1 text-xs font-medium ' +
                (found ? 'bg-primary/10 text-primary' : 'bg-card text-muted-text ring-1 ring-muted/60')
              }
            >
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProcedureRow({
  row,
  label,
  onFee,
  onInclude,
}: {
  row: Row
  label: string
  onFee: (fee: number) => void
  onInclude: (include: boolean) => void
}) {
  const id = useId()
  const p = row.procedure
  return (
    <li className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ink/5">
      <div className="flex min-h-11 items-center gap-3">
        <input
          id={`${id}-include`}
          type="checkbox"
          checked={row.include}
          onChange={(e) => onInclude(e.target.checked)}
          className="size-5 accent-primary"
        />
        <label htmlFor={`${id}-include`} className="font-semibold text-ink">
          Include {label}
        </label>
      </div>
      <p className="text-sm text-muted-text">
        {CATEGORY_LABELS[p.category]} care · Code {p.cdt_code}
        {p.tooth !== null && <> · Tooth {p.tooth}</>}
      </p>
      <MoneyInput
        label="Dentist's fee (check it matches your document)"
        value={p.billed_fee}
        onChange={onFee}
        disabled={!row.include}
      />
    </li>
  )
}

function PlanFields({ plan, onChange }: { plan: Plan; onChange: (plan: Plan) => void }) {
  const set = <K extends keyof Plan>(key: K, value: Plan[K]) => onChange({ ...plan, [key]: value })
  const setCoverage = (key: keyof Coverage, value: number) =>
    onChange({ ...plan, coverage: { ...plan.coverage, [key]: value } })

  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 font-semibold text-ink">Plan details</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput label="Annual maximum" value={plan.annual_max} onChange={(v) => set('annual_max', v)} />
        <MoneyInput label="Deductible" value={plan.deductible} onChange={(v) => set('deductible', v)} />
        <PercentInput label="Preventive coverage" value={plan.coverage.preventive} onChange={(v) => setCoverage('preventive', v)} />
        <PercentInput label="Basic coverage" value={plan.coverage.basic} onChange={(v) => setCoverage('basic', v)} />
        <PercentInput label="Major coverage" value={plan.coverage.major} onChange={(v) => setCoverage('major', v)} />
        <TextInput label="Plan year reset date (MM-DD)" value={plan.reset_date} onChange={(v) => set('reset_date', v)} />
        <MoneyInput label="Benefits used this year" value={plan.used_this_year} onChange={(v) => set('used_this_year', v)} />
      </div>
      <div className="flex min-h-11 items-center gap-3">
        <input
          id="document-in-network"
          type="checkbox"
          checked={plan.in_network}
          onChange={(e) => set('in_network', e.target.checked)}
          className="size-5 accent-primary"
        />
        <label htmlFor="document-in-network" className="text-sm text-ink">
          My dentist is in my plan&apos;s network
        </label>
      </div>
    </fieldset>
  )
}

function MoneyInput(props: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {props.label}
      </label>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-muted-text">
          $
        </span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_FEE}
          step="any"
          value={Number.isNaN(props.value) ? '' : props.value}
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.target.value === '' ? Number.NaN : e.target.valueAsNumber)}
          className="field tabular-nums disabled:opacity-45"
        />
      </div>
    </div>
  )
}

function PercentInput(props: { label: string; value: number; onChange: (v: number) => void }) {
  const id = useId()
  // Shown as a percent, stored as 0-1 like the Plan shape. Rounding is display only.
  const percent = Number.isNaN(props.value) ? '' : Math.round(props.value * 1000) / 10
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {props.label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="any"
          value={percent}
          onChange={(e) => props.onChange(e.target.value === '' ? Number.NaN : e.target.valueAsNumber / 100)}
          className="field tabular-nums"
        />
        <span aria-hidden="true" className="text-muted-text">
          %
        </span>
      </div>
    </div>
  )
}

function TextInput(props: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {props.label}
      </label>
      <input
        id={id}
        type="text"
        value={props.value}
        placeholder="01-01"
        onChange={(e) => props.onChange(e.target.value)}
        className="field"
      />
    </div>
  )
}
