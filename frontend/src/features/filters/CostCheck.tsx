import { useEffect, useState } from 'react'
import { ApiError, calculate, getCatalog, getDemo, isAbortError } from '../../api'
import AnimatedMoney from '../../components/AnimatedMoney'
import { formatMoney } from '../../format'
import type { CatalogItem, Plan, Procedure } from '../../types'
import { SERVICE_LABELS } from './filterOptions'
import type { Filters } from './types'

interface Props {
  filters: Filters
  /** The plan from Tell us. */
  myPlan: Plan
  onEditCare: () => void
}

type Estimate =
  | { key: string; ok: true; amount: number; source: 'engine' | 'fee' }
  | { key: string; ok: false; message: string }

/**
 * What the chosen service likely costs, next to the user's budget.
 * With insurance the amount comes from POST /calculate; for self-pay it is the
 * catalog's dentist's fee as given. Nothing is computed here (CLAUDE.md section 2).
 */
export default function CostCheck({ filters, myPlan, onEditCare }: Props) {
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null)
  const [demoPlan, setDemoPlan] = useState<Plan | null>(null)
  const [estimate, setEstimate] = useState<Estimate | null>(null)

  const { service, payment, preferred_plan_id: planId, budget_this_year: budget } = filters
  const item = catalog?.find((c) => c.cdt_code === service)
  const plan = planId === 'demo_plan' ? demoPlan : myPlan
  const key = `${service}|${payment}|${planId}`

  useEffect(() => {
    const controller = new AbortController()
    getCatalog({ signal: controller.signal })
      .then(setCatalog)
      .catch(() => {}) // The card below explains when there's no estimate.
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (planId !== 'demo_plan' || demoPlan) return
    const controller = new AbortController()
    getDemo({ signal: controller.signal })
      .then((demo) => setDemoPlan(demo.plan))
      .catch(() => {})
    return () => controller.abort()
  }, [planId, demoPlan])

  useEffect(() => {
    if (!item || payment !== 'insurance' || !plan) return
    const procedure: Procedure = {
      id: 'estimate',
      name: item.name,
      cdt_code: item.cdt_code,
      category: item.category,
      tooth: null,
      billed_fee: item.default_fee,
      allowed_fee: item.default_fee,
      depends_on: null,
      can_wait: false,
    }
    const controller = new AbortController()
    calculate({ procedures: [procedure], plan, schedule: {} }, { signal: controller.signal })
      .then((result) => setEstimate({ key, ok: true, amount: result.totals.you_pay, source: 'engine' }))
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        setEstimate({ key, ok: false, message: e instanceof ApiError ? e.message : 'Something went wrong.' })
      })
    return () => controller.abort()
  }, [item, payment, plan, key])

  let body
  if (!service) {
    body = <p className="text-sm text-ink/80">Pick a procedure or service to see what it likely costs and compare it with your budget.</p>
  } else if (service === 'checkup') {
    body = (
      <p className="text-sm text-ink/80">
        We don&apos;t have a sourced fee for cleanings and checkups yet, so we can&apos;t estimate this one. Many plans cover
        preventive care in full; check yours.
      </p>
    )
  } else if (!item) {
    body = <div className="h-16 animate-pulse rounded-2xl bg-card/60 motion-reduce:animate-none" role="status" aria-label="Loading" />
  } else if (payment === 'self_pay') {
    body = (
      <Amount
        label={`Typical dentist's fee for a ${item.name.toLowerCase()} if you pay yourself`}
        amount={item.default_fee}
        budget={budget}
        note="Self-pay prices vary. Ask the office for their cash price."
      />
    )
  } else {
    const current = estimate?.key === key ? estimate : null
    body = !current ? (
      <div className="h-16 animate-pulse rounded-2xl bg-card/60 motion-reduce:animate-none" role="status" aria-label="Working out your estimate" />
    ) : current.ok ? (
      <Amount
        label={`You'll likely pay for a ${item.name.toLowerCase()} with ${planId === 'demo_plan' ? "Maya's demo plan" : 'your plan'}`}
        amount={current.amount}
        budget={budget}
        note="From our cost engine, using a typical fee and what you've used of your plan this year."
      />
    ) : (
      <p className="text-sm text-ink/80">
        We need your plan details for an estimate. {current.message}{' '}
        <button type="button" onClick={onEditCare} className="font-medium text-primary underline underline-offset-2">
          Go to Tell us
        </button>
      </p>
    )
  }

  return (
    <div className="glass space-y-3 rounded-3xl p-5 sm:p-6" aria-live="polite">
      <h3 className="text-xl font-semibold tracking-tight text-ink">
        Cost check{service ? `: ${SERVICE_LABELS[service]}` : ''}
      </h3>
      {body}
    </div>
  )
}

function Amount({ label, amount, budget, note }: { label: string; amount: number; budget: number | null; note: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-text">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <AnimatedMoney value={amount} className="text-4xl font-light tracking-tight text-ink" />
        {budget !== null &&
          (amount <= budget ? (
            <span className="rounded-full bg-savings-deep px-3 py-1 text-xs font-semibold text-white">
              Within your {formatMoney(budget)} budget
            </span>
          ) : (
            <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              Above your {formatMoney(budget)} budget
            </span>
          ))}
      </div>
      <p className="text-xs text-muted-text">{note} Prices don&apos;t differ by dentist here: we only have one typical fee per service.</p>
    </div>
  )
}
