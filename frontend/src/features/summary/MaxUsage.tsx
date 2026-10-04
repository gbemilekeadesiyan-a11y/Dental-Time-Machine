import { motion, useReducedMotion } from 'framer-motion'
import AnimatedMoney from '../../components/AnimatedMoney'
import JargonChip from '../../components/JargonChip'
import { formatMoney } from '../../format'
import { RESET_WORDING } from '../../glossary'
import type { Plan, Result } from '../../types'
import ResetReminder from './ResetReminder'

interface Props {
  result: Result
  plan: Plan
}

/**
 * Annual maximum used and left, per plan year.
 *
 * "Left" is the engine's max_left; the annual maximum is the user's own input.
 * "Used" is shown as a share of the maximum (a percent and a bar), never as a
 * dollar amount the engine didn't return (CLAUDE.md section 2).
 */
export default function MaxUsage({ result, plan }: Props) {
  const usesNextYear = result.per_procedure.some((l) => l.year === 'next_year')

  return (
    <article className="glass space-y-5 rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-xl font-semibold tracking-tight text-ink">Annual maximum</h3>
        <div className="flex flex-wrap items-start gap-2">
          <JargonChip term="annual maximum" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <YearMeter title="This plan year" left={result.max_left.this_year} annualMax={plan.annual_max} />
        {usesNextYear && (
          <YearMeter title="Next plan year" left={result.max_left.next_year} annualMax={plan.annual_max} />
        )}
      </div>
      {usesNextYear && <p className="text-sm text-muted-text">{RESET_WORDING}</p>}
      <ResetReminder resetDate={plan.reset_date} leftThisYear={result.max_left.this_year} />
    </article>
  )
}

function YearMeter({ title, left, annualMax }: { title: string; left: number; annualMax: number }) {
  const reduceMotion = useReducedMotion()
  const leftShare = annualMax > 0 ? Math.min(Math.max(left / annualMax, 0), 1) : 0
  const usedPercent = Math.round((1 - leftShare) * 100)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-medium text-ink">{title}</h4>
        <p className="text-sm text-muted-text">{usedPercent}% used</p>
      </div>
      <div
        role="meter"
        aria-label={`${title}: ${formatMoney(left)} left of your ${formatMoney(annualMax)} annual maximum`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usedPercent}
        className="h-3 w-full overflow-hidden rounded-full bg-savings/25"
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${usedPercent}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
        />
      </div>
      <p className="text-sm text-ink">
        <AnimatedMoney value={left} className="font-semibold text-savings-deep" /> left of your{' '}
        {formatMoney(annualMax)} annual maximum
      </p>
    </div>
  )
}
