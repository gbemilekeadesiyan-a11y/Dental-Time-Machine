import { motion, useReducedMotion } from 'framer-motion'
import AnimatedMoney from '../../components/AnimatedMoney'
import { NO_BETTER_TIMING, NOTHING_CAN_WAIT } from '../../copy'
import { formatMoney, listOfNames, procedureLabels } from '../../format'
import type { OptimizeResult, Procedure, Result } from '../../types'

interface Props {
  /** POST /calculate for the timing the user chose. */
  result: Result
  /** POST /optimize: everything now, the best timing and its savings. */
  optimized: OptimizeResult
  procedures: Procedure[]
}

/** Totals for the chosen timing, plan vs you, and the conditional savings line. */
export default function TotalsCard({ result, optimized, procedures }: Props) {
  const { plan_pays, you_pay } = result.totals

  return (
    <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
      <article className="glass space-y-6 rounded-3xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <p>
            <span className="block text-sm text-muted-text">With the timing you chose, you&apos;ll likely pay</span>
            <AnimatedMoney value={you_pay} className="text-5xl font-light tracking-tight text-ink" />
          </p>
          <p className="sm:text-right">
            <span className="block text-sm text-muted-text">Your plan likely pays</span>
            <AnimatedMoney value={plan_pays} className="text-2xl font-medium tracking-tight text-savings-deep" />
          </p>
        </div>
        <PlanVsYouBar planPays={plan_pays} youPay={you_pay} />
      </article>
      <SavingsCard optimized={optimized} procedures={procedures} />
    </div>
  )
}

/**
 * One bar split into the plan's share and yours. Widths are proportions of the
 * engine's two totals; the only amounts shown are those totals.
 */
function PlanVsYouBar({ planPays, youPay }: { planPays: number; youPay: number }) {
  const reduceMotion = useReducedMotion()
  const whole = planPays + youPay
  const planShare = whole > 0 ? planPays / whole : 0
  const label = `Your plan likely pays ${formatMoney(planPays)} and you'll likely pay ${formatMoney(youPay)}`

  return (
    <figure className="space-y-2">
      <div role="img" aria-label={label} className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-track">
        {planPays > 0 && (
          <motion.div
            className="h-full rounded-l-full bg-savings"
            initial={false}
            animate={{ width: `${planShare * 100}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
          />
        )}
        {youPay > 0 && <div className="h-full flex-1 rounded-r-full bg-primary" />}
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-text">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-full bg-savings" /> Plan likely pays
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-full bg-primary" /> You&apos;ll likely pay
        </span>
      </figcaption>
    </figure>
  )
}

/** Savings from /optimize. Conditional wording: never "you should wait" (CLAUDE.md section 12). */
function SavingsCard({ optimized, procedures }: { optimized: OptimizeResult; procedures: Procedure[] }) {
  const { all_now, best, savings, moved } = optimized
  const labels = procedureLabels(procedures)
  const anyCanWait = procedures.some((p) => p.can_wait)
  const hasSavings = moved.length > 0 && savings > 0

  if (!hasSavings) {
    return (
      <article className="glass flex flex-col justify-center gap-2 rounded-3xl p-6">
        <h3 className="font-semibold text-ink">Timing</h3>
        <p className="text-sm text-ink/80">{anyCanWait ? NO_BETTER_TIMING : NOTHING_CAN_WAIT}</p>
      </article>
    )
  }

  const names = listOfNames(moved.map((id) => labels.get(id) ?? 'this procedure'))
  return (
    <article className="gradient-card flex flex-col justify-between gap-4 rounded-3xl p-6">
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-white">Best timing</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-savings-deep px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/40">
          Saves <AnimatedMoney value={savings} />
        </span>
      </div>
      <p className="relative text-white">
        If your dentist confirms {names} can wait, you&apos;d likely pay {formatMoney(best.totals.you_pay)} instead of{' '}
        {formatMoney(all_now.totals.you_pay)}.
      </p>
    </article>
  )
}
