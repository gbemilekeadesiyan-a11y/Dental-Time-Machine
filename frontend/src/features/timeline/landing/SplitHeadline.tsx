import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import type { RefObject } from 'react'
import { LANDING } from './landingCopy'

/** How far each half drifts outward while the hero scrolls away. */
const DRIFT = '15vw'

/**
 * "Same care" and "Smarter timing". As the hero scrolls off screen, the halves drift
 * apart: left goes left, right goes right. Screen readers get one plain heading.
 */
export default function SplitHeadline({ heroRef }: { heroRef: RefObject<HTMLElement | null> }) {
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 })
  const leftX = useTransform(smooth, [0, 1], ['0vw', `-${DRIFT}`])
  const rightX = useTransform(smooth, [0, 1], ['0vw', DRIFT])

  const half =
    'pointer-events-none z-10 text-5xl leading-[0.95] font-light tracking-tight text-white text-shadow-md text-shadow-ink/30 sm:text-6xl lg:text-6xl xl:text-7xl 2xl:text-8xl'

  return (
    <>
      <h1 className="sr-only">{LANDING.headline}</h1>
      <motion.p aria-hidden="true" data-half="left" className={`headline-left ${half}`} style={reduceMotion ? undefined : { x: leftX }}>
        <Glow />
        <span className="block">{LANDING.left.sans}</span>
        <span className="font-display-serif block">{LANDING.left.serif}</span>
      </motion.p>
      <motion.p aria-hidden="true" data-half="right" className={`headline-right ${half}`} style={reduceMotion ? undefined : { x: rightX }}>
        <Glow />
        <span className="block">{LANDING.right.sans}</span>
        <span className="font-display-serif block">{LANDING.right.serif}</span>
      </motion.p>
    </>
  )
}

/**
 * A soft, feathered dark glow behind one headline half. It keeps the white text at
 * 4.5:1 or better while the rest of the hero photo stays light and visible. Moves with
 * its half, so it never drifts away from the text.
 */
function Glow() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -inset-x-16 -inset-y-12 -z-10 rounded-[50%] bg-ink/60 blur-3xl"
    />
  )
}
