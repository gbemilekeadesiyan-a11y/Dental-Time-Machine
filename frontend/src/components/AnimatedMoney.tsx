import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { formatMoney } from '../format'

/**
 * A dollar amount that slides to its new value when it changes.
 *
 * It swaps whole values instead of counting up, so the screen only ever shows
 * amounts the engine actually returned (CLAUDE.md section 2).
 */
export default function AnimatedMoney({ value, className = '' }: { value: number; className?: string }) {
  const reduceMotion = useReducedMotion()
  return (
    <span className={`relative inline-flex overflow-hidden align-bottom tabular-nums ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduceMotion ? { opacity: 0 } : { y: '70%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: '-70%', opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: 'easeOut' }}
        >
          {formatMoney(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
