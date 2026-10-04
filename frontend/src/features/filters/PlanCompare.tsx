import { useEffect, useId, useState } from 'react'
import { ApiError, comparePlans, isAbortError } from '../../api'
import AnimatedMoney from '../../components/AnimatedMoney'
import Disclaimer from '../../components/Disclaimer'
import Notice from '../../components/Notice'
import RollLabel from '../../components/RollLabel'
import { formatMoney, listOfNames, procedureLabels } from '../../format'
import type { AppState } from '../../state'
import type { Plan, PlanComparison, Procedure } from '../../types'

interface Props {
  state: AppState
  onEditCare: () => void
}

type Answer =
  | { procedures: Procedure[]; plan: Plan; ok: true; rows: PlanComparison[] }
  | { procedures: Procedure[]; plan: Plan; ok: false; message: string }

const NOTE = "Demo plans for illustration. Your employer's real options may differ."

/** True when every number on the Tell us plan form is filled in. */
function isComplete(plan: Plan): boolean {
  const numbers = [
    plan.annual_max,
    plan.deductible,
    plan.coverage.preventive,
    plan.coverage.basic,
    plan.coverage.major,
    plan.used_this_year,
    plan.deductible_paid_this_year,
  ]
  return numbers.every(Number.isFinite) && /^\d{2}-\d{2}$/.test(plan.reset_date)
}

const percent = (share: number) => `${Math.round(share * 100)}%`

/**
 * Compare plan options: the user's care priced under each employer demo option,
 * side by side, from POST /filters/apply. It compares and never recommends.
 * Every dollar figure comes from the response; nothing is computed here (CLAUDE.md section 2).
 */
export default function PlanCompare({ state, onEditCare }: Props) {
  const { procedures, plan, isDemo } = state
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const titleId = useId()
  const detailsId = useId()

  useEffect(() => {
    if (procedures.length === 0) return
    const controller = new AbortController()
    // "Your plan" only when the user entered their own; Maya's plan is already the current demo option.
    const myPlan = !isDemo && isComplete(plan) ? plan : null
    comparePlans({ procedures, my_plan: myPlan }, { signal: controller.signal })
      .then((rows) => setAnswer({ procedures, plan, ok: true, rows }))
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
        setAnswer({ procedures, plan, ok: false, message })
      })
    return () => controller.abort()
  }, [procedures, plan, isDemo])

  const current = answer?.procedures === procedures && answer.plan === plan ? answer : null

  return (
    <section aria-labelledby={titleId} className="glass space-y-5 rounded-3xl p-5 sm:p-6">
      <div className="space-y-1">
        <h3 id={titleId} className="text-2xl font-semibold tracking-tight text-ink">
          Compare plan options
        </h3>
        <p className="text-sm text-muted-text">{NOTE}</p>
      </div>

      {procedures.length === 0 ? (
        <Notice>
          Add your care on Tell us to compare plans.{' '}
          <button type="button" onClick={onEditCare} className="font-medium text-primary underline underline-offset-2">
            Go to Tell us
          </button>
        </Notice>
      ) : current === null ? (
        <div className="h-64 animate-pulse rounded-2xl bg-card/60 motion-reduce:animate-none" role="status" aria-label="Comparing plans" />
      ) : !current.ok ? (
        <Notice tone="problem">{current.message}</Notice>
      ) : (
        <Comparison
          rows={current.rows}
          procedures={procedures}
          showDetails={showDetails}
          detailsId={detailsId}
          onToggleDetails={() => setShowDetails((s) => !s)}
        />
      )}

      <Disclaimer />
    </section>
  )
}

interface ComparisonProps {
  rows: PlanComparison[]
  procedures: Procedure[]
  showDetails: boolean
  detailsId: string
  onToggleDetails: () => void
}

function Comparison({ rows, procedures, showDetails, detailsId, onToggleDetails }: ComparisonProps) {
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order)
  const planYears = sorted[0]?.plan_years ?? 1
  // A warning every option shares is shown once under the cards, not repeated on each.
  const shared = sorted[0]?.warnings.filter((w) => sorted.every((r) => r.warnings.includes(w))) ?? []
  const labels = procedureLabels(procedures)

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">
          {planYears === 1 ? 'Sorted by lowest likely yearly total' : 'Sorted by lowest likely total over 2 plan years'}
        </p>
        <button
          type="button"
          onClick={onToggleDetails}
          aria-expanded={showDetails}
          aria-controls={detailsId}
          className="btn-secondary min-h-9 px-4 py-1.5 text-sm"
        >
          <RollLabel>{showDetails ? 'Hide benefits and limits' : 'Show benefits and limits'}</RollLabel>
        </button>
      </div>

      <ol id={detailsId} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((row) => (
          <li key={row.id}>
            <OptionCard row={row} labels={labels} shared={shared} showDetails={showDetails} />
          </li>
        ))}
      </ol>

      {shared.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-text" aria-label="Applies to every plan">
          {shared.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface CardProps {
  row: PlanComparison
  labels: Map<string, string>
  shared: string[]
  showDetails: boolean
}

function OptionCard({ row, labels, shared, showDetails }: CardProps) {
  const { plan } = row
  const own = row.warnings.filter((w) => !shared.includes(w))
  const years = row.plan_years === 1 ? '1 plan year' : `${row.plan_years} plan years`
  const names = listOfNames(row.moved.map((id) => labels.get(id) ?? 'this procedure'))

  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl bg-card/85 p-5 shadow-sm ring-1 ring-ink/5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-semibold text-ink">{row.name}</h4>
        <span
          className={
            'rounded-full px-2.5 py-0.5 text-xs font-medium ' +
            (row.source === 'user' ? 'bg-primary text-white' : 'bg-primary/10 text-primary')
          }
        >
          {row.source === 'user' ? 'Your plan' : 'Demo plan'}
        </span>
      </div>

      <p>
        <span className="block text-sm text-muted-text">You&apos;d likely pay for this care</span>
        <AnimatedMoney value={row.best_you_pay} className="text-4xl font-light tracking-tight text-ink" />
      </p>

      {row.moved.length > 0 ? (
        <p className="text-sm text-ink">
          If your dentist confirms {names} can wait, you&apos;d likely pay{' '}
          <span className="font-semibold text-savings-deep">{formatMoney(row.best_you_pay)}</span>. Everything this plan
          year: {formatMoney(row.all_now_you_pay)}.
        </p>
      ) : (
        <p className="text-sm text-muted-text">Everything this plan year: {formatMoney(row.all_now_you_pay)}.</p>
      )}

      <dl className="mt-auto space-y-2 border-t border-ink/10 pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-text">Premiums for the year</dt>
          <dd className="text-right tabular-nums text-ink">
            {row.annual_premium === null ? 'Not entered' : formatMoney(row.annual_premium)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-text">Likely total, including premiums (across {years})</dt>
          <dd className="text-right text-base font-semibold tabular-nums text-ink">
            {row.year_total === null ? 'Premium not entered' : formatMoney(row.year_total)}
          </dd>
        </div>
      </dl>

      {showDetails && (
        <div className="space-y-3 text-sm">
          <div>
            <h5 className="font-medium text-ink">Benefits</h5>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-text">
              <dt>Annual maximum</dt>
              <dd className="text-right tabular-nums text-ink">{formatMoney(plan.annual_max)}</dd>
              <dt>Deductible</dt>
              <dd className="text-right tabular-nums text-ink">{formatMoney(plan.deductible)}</dd>
              <dt>Preventive covered</dt>
              <dd className="text-right tabular-nums text-ink">{percent(plan.coverage.preventive)}</dd>
              <dt>Basic covered</dt>
              <dd className="text-right tabular-nums text-ink">{percent(plan.coverage.basic)}</dd>
              <dt>Major covered</dt>
              <dd className="text-right tabular-nums text-ink">{percent(plan.coverage.major)}</dd>
            </dl>
          </div>
          <div>
            <h5 className="font-medium text-ink">Limits</h5>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-text">
              <dt>Annual max left this plan year</dt>
              <dd className="text-right tabular-nums text-ink">{formatMoney(row.max_left.this_year)}</dd>
              {row.moved.length > 0 && (
                <>
                  <dt>Annual max left next plan year</dt>
                  <dd className="text-right tabular-nums text-ink">{formatMoney(row.max_left.next_year)}</dd>
                </>
              )}
            </dl>
            {own.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-text">
                {own.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
