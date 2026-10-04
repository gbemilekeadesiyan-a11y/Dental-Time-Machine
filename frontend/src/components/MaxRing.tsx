import { motion, useReducedMotion } from 'framer-motion'
import { formatMoney } from '../format'

interface Props {
  /** From the engine: Result.max_left.this_year. */
  left: number
  /** The plan's annual maximum, as the user entered it. */
  annualMax: number
}

const SIZE = 168
const STROKE = 16
const RADIUS = (SIZE - STROKE) / 2

/**
 * How much of this plan year's annual maximum is left.
 *
 * The ring's fill is a proportion, not a dollar amount. The only dollar figures
 * shown are `left` (from the engine) and `annualMax` (the user's own input), so
 * nothing here computes money (CLAUDE.md section 2).
 */
export default function MaxRing({ left, annualMax }: Props) {
  const reduceMotion = useReducedMotion()
  const share = annualMax > 0 ? Math.min(Math.max(left / annualMax, 0), 1) : 0
  const label = `${formatMoney(left)} left of your ${formatMoney(annualMax)} annual maximum this plan year`

  return (
    <figure className="flex flex-col items-center gap-3">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
        {/* Used: the full track. Left: drawn on top in green. */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-maroon/25" />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap={share > 0 ? 'round' : 'butt'}
          className="stroke-savings"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          initial={false}
          animate={{ pathLength: share }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
        />
        <text x="50%" y="47%" textAnchor="middle" className="fill-ink text-2xl font-bold">
          {formatMoney(left)}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="fill-muted text-sm">
          left this year
        </text>
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-full bg-savings" /> Left
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-full bg-maroon/25" /> Used
        </span>
        <span>of your {formatMoney(annualMax)} annual maximum</span>
      </figcaption>
    </figure>
  )
}
