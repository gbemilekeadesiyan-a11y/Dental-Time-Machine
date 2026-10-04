import { useId } from 'react'
import { ArrowRight } from '../../components/Icons'
import { formatMoney } from '../../format'
import type { Plan, PlanDetails } from '../../types'
import type { ChatCopy } from './chatCopy'

interface Props {
  details: PlanDetails
  plan: Plan
  copy: ChatCopy
  onApply: (plan: Plan) => void
  onDismiss: () => void
}

/**
 * Plan details the user said in chat. Shows only what they said; applying fills those
 * fields in the plan form, where the user can still edit everything.
 */
export default function ConfirmPlan({ details, plan, copy, onApply, onDismiss }: Props) {
  const titleId = useId()
  const f = copy.planFields
  const percent = (share: number) => `${Math.round(share * 10000) / 100}%`
  const rows: [string, string][] = []
  if (details.annual_max !== null) rows.push([f.annual_max, formatMoney(details.annual_max)])
  if (details.deductible !== null) rows.push([f.deductible, formatMoney(details.deductible)])
  for (const c of ['preventive', 'basic', 'major'] as const) {
    const share = details.coverage?.[c]
    if (share !== null && share !== undefined) rows.push([f[c], percent(share)])
  }
  if (details.reset_date !== null) rows.push([f.reset_date, details.reset_date])
  if (details.used_this_year !== null) rows.push([f.used_this_year, formatMoney(details.used_this_year)])
  if (details.deductible_paid_this_year !== null)
    rows.push([f.deductible_paid_this_year, formatMoney(details.deductible_paid_this_year)])
  if (details.in_network !== null) rows.push([f.in_network, details.in_network ? copy.inNetwork : copy.outOfNetwork])

  function apply() {
    const coverage = { ...plan.coverage }
    for (const c of ['preventive', 'basic', 'major'] as const) {
      const share = details.coverage?.[c]
      if (share !== null && share !== undefined) coverage[c] = share
    }
    onApply({
      ...plan,
      annual_max: details.annual_max ?? plan.annual_max,
      deductible: details.deductible ?? plan.deductible,
      coverage,
      reset_date: details.reset_date ?? plan.reset_date,
      used_this_year: details.used_this_year ?? plan.used_this_year,
      deductible_paid_this_year: details.deductible_paid_this_year ?? plan.deductible_paid_this_year,
      in_network: details.in_network ?? plan.in_network,
    })
  }

  return (
    <section aria-labelledby={titleId} className="space-y-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ink/5">
      <div className="space-y-1">
        <h4 id={titleId} className="font-semibold text-ink">
          {copy.planTitle}
        </h4>
        <p className="text-sm text-muted-text">{copy.planHelp}</p>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-ink/5 py-1">
            <dt className="text-muted-text">{label}</dt>
            <dd className="font-medium text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={apply} className="btn-primary">
          {copy.applyPlan}
          <ArrowRight />
        </button>
        <button type="button" onClick={onDismiss} className="btn-secondary">
          {copy.notNow}
        </button>
      </div>
    </section>
  )
}
