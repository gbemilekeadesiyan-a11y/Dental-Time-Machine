import { useMotionValueEvent, useScroll } from 'framer-motion'
import { useState } from 'react'
import { ArrowRight } from '../../../components/Icons'
import { LANDING } from './landingCopy'
import RollLabel from '../../../components/RollLabel'

/** Distance in px after which the bar turns into glass. */
const GLASS_AFTER = 24

/**
 * A slim top bar: app name and a "Start" pill. Transparent with white text over the
 * hero; glass with ink text once the page scrolls. Color changes skip their
 * transition when the user prefers reduced motion.
 */
export default function StickyBar({ onStart }: { onStart: () => void }) {
  const { scrollY } = useScroll()
  const [glass, setGlass] = useState(() => scrollY.get() > GLASS_AFTER)
  useMotionValueEvent(scrollY, 'change', (y) => setGlass(y > GLASS_AFTER))

  return (
    <header
      data-glass={glass}
      className={
        'fixed inset-x-3 top-3 z-50 flex items-center justify-between gap-3 rounded-full py-2 pr-2 pl-5 transition-colors duration-200 motion-reduce:transition-none sm:inset-x-6 ' +
        (glass ? 'glass text-ink' : 'border border-transparent bg-transparent text-white')
      }
    >
      <p className="text-sm font-semibold tracking-tight">{LANDING.appName}</p>
      <button
        type="button"
        onClick={onStart}
        className={'px-5 text-sm ' + (glass ? 'btn-primary' : 'btn-light [--focus-ring:#fff]')}
      >
        <RollLabel>
          {LANDING.start}
          <ArrowRight />
        </RollLabel>
      </button>
    </header>
  )
}
