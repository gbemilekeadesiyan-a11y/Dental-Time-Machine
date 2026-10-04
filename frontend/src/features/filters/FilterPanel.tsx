import { useId, type ReactNode } from 'react'
import type { AgeRange } from '../../types'
import Flash from './Flash'
import {
  AGE_LABELS,
  AVAILABILITY_LABELS,
  LANGUAGES,
  MAX_MILES,
  MIN_MILES,
  PAYMENT_LABELS,
  PLAN_LABELS,
  SERVICE_LABELS,
  SORT_LABELS,
  SPECIALTY_LABELS,
} from './filterOptions'
import { setFilter, useFilterStore } from './filterStore'
import type { Availability, Filters, Payment, PlanChoice, Service, SortOrder, Specialty } from './types'

/** Every filter, all writing to the same shared state the assistant uses. */
export default function FilterPanel() {
  const { filters: f, lastAiChange } = useFilterStore()
  const flash = (key: keyof Filters) => ({
    version: lastAiChange?.version ?? 0,
    active: lastAiChange?.keys.includes(key) ?? false,
  })
  const selfPay = f.payment === 'self_pay'

  return (
    <div data-narrate="filters" className="glass space-y-6 rounded-3xl p-5 sm:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-ink">Filters</h3>

      <Group title="Where">
        <Flash {...flash('zip')}>
          <TextInput
            label="ZIP code"
            value={f.zip}
            placeholder="27401"
            inputMode="numeric"
            maxLength={5}
            onChange={(v) => setFilter('zip', v.replace(/\D/g, '').slice(0, 5))}
          />
        </Flash>
        <Flash {...flash('max_distance_miles')}>
          <DistanceSlider value={f.max_distance_miles} onChange={(v) => setFilter('max_distance_miles', v)} />
        </Flash>
      </Group>

      <Group title="Cost">
        <Flash {...flash('payment')}>
          <Segmented<Payment>
            label="Paying with"
            value={f.payment}
            options={PAYMENT_LABELS}
            onChange={(v) => {
              setFilter('payment', v)
              // Networks only matter with insurance, same rule the assistant follows.
              if (v === 'self_pay') setFilter('in_network_only', false)
            }}
          />
        </Flash>
        <Flash {...flash('budget_this_year')}>
          <BudgetInput value={f.budget_this_year} onChange={(v) => setFilter('budget_this_year', v)} />
        </Flash>
        <Flash {...flash('preferred_plan_id')}>
          <Select<PlanChoice>
            label="Insurance plan"
            value={f.preferred_plan_id}
            options={PLAN_LABELS}
            disabled={selfPay}
            hint={selfPay ? 'Not used when paying yourself.' : undefined}
            onChange={(v) => setFilter('preferred_plan_id', v)}
          />
        </Flash>
        <Flash {...flash('in_network_only')}>
          <Toggle
            label="In-network only"
            hint={selfPay ? 'Networks only matter when you pay with insurance.' : 'Network status is demo data.'}
            checked={f.in_network_only && !selfPay}
            disabled={selfPay}
            onChange={(v) => setFilter('in_network_only', v)}
          />
        </Flash>
      </Group>

      <Group title="Care">
        <Flash {...flash('service')}>
          <Select<Service | ''>
            label="Procedure or service"
            value={f.service ?? ''}
            options={{ '': 'Any service', ...SERVICE_LABELS }}
            onChange={(v) => setFilter('service', v === '' ? null : v)}
          />
        </Flash>
        <Flash {...flash('specialty')}>
          <Select<Specialty>
            label="Specialty"
            value={f.specialty}
            options={SPECIALTY_LABELS}
            onChange={(v) => setFilter('specialty', v)}
          />
        </Flash>
        <Flash {...flash('dentist_name')}>
          <TextInput
            label="Dentist or practice name"
            value={f.dentist_name}
            placeholder="Any"
            maxLength={60}
            onChange={(v) => setFilter('dentist_name', v)}
          />
        </Flash>
        <Flash {...flash('age_range')}>
          <Select<AgeRange | ''>
            label="Patient age"
            value={f.age_range ?? ''}
            options={{ '': 'Not set', ...AGE_LABELS }}
            onChange={(v) => setFilter('age_range', v === '' ? null : v)}
          />
        </Flash>
      </Group>

      <Group title="When">
        <Flash {...flash('availability')}>
          <Segmented<Availability>
            label="Availability"
            value={f.availability}
            options={AVAILABILITY_LABELS}
            onChange={(v) => setFilter('availability', v)}
          />
        </Flash>
        <Flash {...flash('sort')}>
          <Segmented<SortOrder> label="Sort" value={f.sort} options={SORT_LABELS} onChange={(v) => setFilter('sort', v)} />
        </Flash>
      </Group>

      <Group title="More">
        <Flash {...flash('accepting_new_only')}>
          <Toggle
            label="Accepting new patients"
            checked={f.accepting_new_only}
            onChange={(v) => setFilter('accepting_new_only', v)}
          />
        </Flash>
        <Flash {...flash('no_referral_only')}>
          <Toggle label="No referral needed" checked={f.no_referral_only} onChange={(v) => setFilter('no_referral_only', v)} />
        </Flash>
        <div className="sm:col-span-2">
          <Flash {...flash('languages')}>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-ink">Languages spoken</legend>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => {
                  const on = f.languages.includes(lang)
                  return (
                    <button
                      key={lang}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setFilter('languages', on ? f.languages.filter((l) => l !== lang) : [...f.languages, lang])
                      }
                      className={pillClass(on)}
                    >
                      {lang}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </Flash>
        </div>
      </Group>
    </div>
  )
}

// ---------- building blocks ----------

function pillClass(on: boolean): string {
  return (
    'min-h-9 rounded-full px-3 py-1.5 text-sm transition-colors ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
    (on ? 'bg-primary font-medium text-white' : 'bg-card text-ink shadow-sm ring-1 ring-ink/5 hover:text-primary')
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-text uppercase">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function TextInput(props: {
  label: string
  value: string
  placeholder: string
  maxLength: number
  inputMode?: 'numeric'
  onChange: (v: string) => void
}) {
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
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        onChange={(e) => props.onChange(e.target.value)}
        className="field"
      />
    </div>
  )
}

function DistanceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          Maximum distance
        </label>
        <span className="text-sm text-ink tabular-nums">{value} {value === 1 ? 'mile' : 'miles'}</span>
      </div>
      <input
        id={id}
        type="range"
        min={MIN_MILES}
        max={MAX_MILES}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="h-11 w-full accent-primary"
      />
    </div>
  )
}

/** The user's own budget. Empty means no budget. */
function BudgetInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Budget
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
          max={50000}
          step="any"
          placeholder="No budget"
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.valueAsNumber
            onChange(e.target.value === '' || Number.isNaN(v) ? null : Math.min(Math.max(v, 0), 50000))
          }}
          className="field tabular-nums"
        />
      </div>
    </div>
  )
}

function Select<T extends string>(props: {
  label: string
  value: T
  options: Record<T, string>
  disabled?: boolean
  hint?: string
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {props.label}
      </label>
      <select
        id={id}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value as T)}
        className="field disabled:opacity-45"
      >
        {(Object.keys(props.options) as T[]).map((key) => (
          <option key={key} value={key}>
            {props.options[key]}
          </option>
        ))}
      </select>
      {props.hint && <p className="text-xs text-muted-text">{props.hint}</p>}
    </div>
  )
}

function Segmented<T extends string>(props: {
  label: string
  value: T
  options: Record<T, string>
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-sm font-medium text-ink">{props.label}</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(props.options) as T[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={props.value === key}
            onClick={() => props.onChange(key)}
            className={pillClass(props.value === key)}
          >
            {props.options[key]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Toggle(props: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className="space-y-1">
      <div className="flex min-h-11 items-center gap-3">
        <input
          id={id}
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          aria-describedby={props.hint ? hintId : undefined}
          onChange={(e) => props.onChange(e.target.checked)}
          className="size-5 accent-primary disabled:opacity-45"
        />
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {props.label}
        </label>
      </div>
      {props.hint && (
        <p id={hintId} className="text-xs text-muted-text">
          {props.hint}
        </p>
      )}
    </div>
  )
}
