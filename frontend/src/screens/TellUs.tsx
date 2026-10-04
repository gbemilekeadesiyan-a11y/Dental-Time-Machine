import { useId, type Dispatch } from 'react'
import { ArrowRight } from '../components/Icons'
import Notice from '../components/Notice'
import { CAN_WAIT_HELP, CAN_WAIT_LABEL, CATEGORY_LABELS, DEMO_PLAN_LABEL } from '../copy'
import { formatMoney } from '../format'
import type { Action, AppState } from '../state'
import type { Category, Coverage, Plan, Procedure } from '../types'
import { useLoadMaya } from '../useLoadMaya'
import RollLabel from '../components/RollLabel'

interface Props {
  state: AppState
  dispatch: Dispatch<Action>
}

const CATEGORIES: Category[] = ['preventive', 'basic', 'major']

export default function TellUs({ state, dispatch }: Props) {
  const { load: loadMaya, loading, error } = useLoadMaya(dispatch)

  return (
    <section aria-labelledby="tell-us-title" className="space-y-6">
      <div className="space-y-2">
        <h2 id="tell-us-title" className="text-4xl font-light tracking-tight text-ink sm:text-5xl">
          Tell us about your care
        </h2>
        <p className="text-ink/80">Add the procedures your dentist recommended and your plan details.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void loadMaya()} disabled={loading} className="btn-primary">
          <RollLabel>
            {loading ? 'Loading Maya…' : 'Load Maya'}
            <ArrowRight />
          </RollLabel>
        </button>
        {state.isDemo && (
          <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary shadow-sm">
            {DEMO_PLAN_LABEL}
          </span>
        )}
      </div>
      {error && <Notice tone="problem">{error}</Notice>}

      <ProcedureList procedures={state.procedures} dispatch={dispatch} />
      <PlanForm plan={state.plan} onChange={(plan) => dispatch({ type: 'update_plan', plan })} />
    </section>
  )
}

// ---------- procedures ----------

function ProcedureList({ procedures, dispatch }: { procedures: Procedure[]; dispatch: Dispatch<Action> }) {
  if (procedures.length === 0) {
    return <Notice>No procedures yet. Load Maya to see an example.</Notice>
  }
  const names = new Map(procedures.map((p) => [p.id, p.name]))

  return (
    <div className="glass space-y-4 rounded-3xl p-5 sm:p-6">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold tracking-tight text-ink">Your procedures</h3>
        <p className="text-sm text-muted-text">{CAN_WAIT_HELP}</p>
      </div>
      <ul className="space-y-3">
        {procedures.map((p) => {
          const checkboxId = `can-wait-${p.id}`
          const after = p.depends_on ? names.get(p.depends_on) : undefined
          return (
            <li key={p.id} className="space-y-2 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ink/5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="text-sm text-muted-text tabular-nums">Dentist&apos;s fee {formatMoney(p.billed_fee)}</span>
              </div>
              <p className="text-sm text-muted-text">
                {CATEGORY_LABELS[p.category]} care · Code {p.cdt_code}
                {p.tooth !== null && <> · Tooth {p.tooth}</>}
                {after && <> · Comes after the {after.toLowerCase()}</>}
              </p>
              <div className="flex min-h-11 items-center gap-3">
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={p.can_wait}
                  onChange={(e) => dispatch({ type: 'set_can_wait', id: p.id, canWait: e.target.checked })}
                  className="size-5 accent-primary"
                />
                <label htmlFor={checkboxId} className="text-sm font-medium text-ink">
                  {CAN_WAIT_LABEL}
                </label>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- plan form ----------

function PlanForm({ plan, onChange }: { plan: Plan; onChange: (plan: Plan) => void }) {
  const set = <K extends keyof Plan>(key: K, value: Plan[K]) => onChange({ ...plan, [key]: value })
  const setCoverage = (category: keyof Coverage, value: number) =>
    onChange({ ...plan, coverage: { ...plan.coverage, [category]: value } })
  const toggleWaived = (category: Category, waived: boolean) =>
    set(
      'deductible_waived_for',
      waived ? [...plan.deductible_waived_for, category] : plan.deductible_waived_for.filter((c) => c !== category),
    )

  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
    <fieldset className="space-y-5">
      <legend className="mb-4 text-xl font-semibold tracking-tight text-ink">Your plan</legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <DollarField label="Annual maximum" value={plan.annual_max} onChange={(v) => set('annual_max', v)} />
        <DollarField label="Deductible" value={plan.deductible} onChange={(v) => set('deductible', v)} />
        <DollarField
          label="Benefits used so far this year"
          value={plan.used_this_year}
          onChange={(v) => set('used_this_year', v)}
        />
        <DollarField
          label="Deductible paid so far this year"
          value={plan.deductible_paid_this_year}
          onChange={(v) => set('deductible_paid_this_year', v)}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-ink">How much your plan covers</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <PercentField
              key={c}
              label={`${CATEGORY_LABELS[c]} care`}
              share={plan.coverage[c]}
              onChange={(v) => setCoverage(c, v)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-ink">Care that skips the deductible</legend>
        <div className="flex flex-wrap gap-4">
          {CATEGORIES.map((c) => (
            <Checkbox
              key={c}
              label={CATEGORY_LABELS[c]}
              checked={plan.deductible_waived_for.includes(c)}
              onChange={(checked) => toggleWaived(c, checked)}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Plan year resets on"
          hint="Month and day, like 01-01"
          value={plan.reset_date}
          placeholder="MM-DD"
          onChange={(v) => set('reset_date', v)}
        />
        <div className="flex items-end">
          <Checkbox
            label="My dentist is in my plan's network"
            checked={plan.in_network}
            onChange={(checked) => set('in_network', checked)}
          />
        </div>
      </div>
    </fieldset>
    </div>
  )
}

// ---------- form fields ----------

const inputClass = 'field tabular-nums'

/** A dollar input. Empty means unknown (NaN), and the backend explains what's missing. */
function DollarField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
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
          step="any"
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? Number.NaN : e.target.valueAsNumber)}
          className={inputClass}
        />
      </div>
    </div>
  )
}

/** Coverage shown as a percent (80) and stored as a share (0.8), the shape the backend expects. */
function PercentField({ label, share, onChange }: { label: string; share: number; onChange: (v: number) => void }) {
  const id = useId()
  const percent = Number.isNaN(share) ? '' : Math.round(share * 10000) / 100
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm text-ink">
        {label}
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
          onChange={(e) => onChange(e.target.value === '' ? Number.NaN : e.target.valueAsNumber / 100)}
          className={inputClass}
        />
        <span aria-hidden="true" className="text-muted-text">
          %
        </span>
      </div>
    </div>
  )
}

function TextField(props: {
  label: string
  hint: string
  value: string
  placeholder: string
  onChange: (v: string) => void
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {props.label}
      </label>
      <input
        id={id}
        type="text"
        value={props.value}
        placeholder={props.placeholder}
        aria-describedby={hintId}
        onChange={(e) => props.onChange(e.target.value)}
        className={inputClass}
      />
      <p id={hintId} className="text-xs text-muted-text">
        {props.hint}
      </p>
    </div>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-primary"
      />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
      </label>
    </div>
  )
}
