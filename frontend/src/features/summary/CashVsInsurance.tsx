import { motion, useReducedMotion } from 'framer-motion'
import Notice from '../../components/Notice'
import { formatMoney } from '../../format'
import type { CashComparison } from '../../types'
import { CASH_UNAVAILABLE, CASH_VERDICT } from './summaryCopy'

/**
 * Cash vs insurance, exactly as the engine computed it (Result.cash_comparison).
 * Shows each engine field on its own row and never adds them up here
 * (CLAUDE.md section 10: no money math in the frontend).
 */
export default function CashVsInsurance({ comparison }: { comparison: CashComparison | null }) {
  if (!comparison) return <Notice>{CASH_UNAVAILABLE}</Notice>

  const { cash_total, insurance_you_pay, premiums_in_period, cheaper, assumptions } = comparison
  const scale = Math.max(cash_total, insurance_you_pay, premiums_in_period ?? 0)

  return (
    <article className="glass space-y-5 rounded-3xl p-6">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold tracking-tight text-ink">Cash or insurance?</h3>
        <p className="text-ink">{CASH_VERDICT[cheaper]}</p>
      </div>

      <dl className="space-y-4">
        <CostRow label="Paying cash for this care" amount={cash_total} scale={scale} barClass="bg-gradient-from" />
        <CostRow label="Using your plan: you'd likely pay" amount={insurance_you_pay} scale={scale} barClass="bg-primary" />
        {premiums_in_period !== null && (
          <CostRow label="Plus plan premiums for this period" amount={premiums_in_period} scale={scale} barClass="bg-primary/50" />
        )}
      </dl>

      <div className="space-y-1">
        <h4 className="text-sm font-medium text-ink">What this assumes</h4>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-text">
          {assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function CostRow({ label, amount, scale, barClass }: { label: string; amount: number; scale: number; barClass: string }) {
  const reduceMotion = useReducedMotion()
  const share = scale > 0 ? amount / scale : 0
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="text-sm text-muted-text">{label}</dt>
        <dd className="text-lg font-medium tabular-nums text-ink">{formatMoney(amount)}</dd>
      </div>
      <div aria-hidden="true" className="h-2.5 w-full overflow-hidden rounded-full bg-track/60">
        <motion.div
          className={'h-full rounded-full ' + barClass}
          initial={false}
          animate={{ width: `${share * 100}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
