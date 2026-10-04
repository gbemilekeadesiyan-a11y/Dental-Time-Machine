import { useAnimate, useReducedMotion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'

const RING = '0 0 0 3px rgb(60 74 161 / 0.45)'
const NO_RING = '0 0 0 3px rgb(60 74 161 / 0)'
const TINT = 'rgb(60 74 161 / 0.08)'
const NO_TINT = 'rgb(60 74 161 / 0)'

/**
 * Briefly rings a filter when the assistant changes it, so the user sees what moved.
 * Animates in place (no remount), so focus and typing are never interrupted.
 */
export default function Flash({ version, active, children }: { version: number; active: boolean; children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!active || !scope.current) return
    void animate(
      scope.current,
      { boxShadow: [RING, RING, NO_RING], backgroundColor: [TINT, TINT, NO_TINT] },
      { duration: reduceMotion ? 0.01 : 2.4, times: [0, 0.5, 1], ease: 'easeOut' },
    )
  }, [version, active, animate, scope, reduceMotion])

  return (
    <div ref={scope} className="-m-2 rounded-2xl p-2">
      {children}
    </div>
  )
}
