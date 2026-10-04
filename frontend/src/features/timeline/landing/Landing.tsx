import { useReducedMotion } from 'framer-motion'
import type { Dispatch } from 'react'
import SiteHeader from '../../../components/SiteHeader'
import { NAV } from '../../../copy'
import type { Action } from '../../../state'
import { useLoadMaya } from '../../../useLoadMaya'
import FeatureCarousel from './FeatureCarousel'
import FocusHero from './FocusHero'
import './landing.css'
import { LANDING } from './landingCopy'
import WordReveal from './WordReveal'

interface Props {
  dispatch: Dispatch<Action>
  /** Opens Tell us. The app fades the page out and scrolls to the top. */
  onStart: () => void
}

/**
 * The landing page, shown before Tell us (Samuel, feature/timeline).
 * Three scroll effects: a focus-window hero, a split headline that drifts apart,
 * and a word-by-word text reveal. All motion turns off under prefers-reduced-motion.
 */
export default function Landing({ dispatch, onStart }: Props) {
  const { load, loading, error } = useLoadMaya(dispatch)
  const reduceMotion = useReducedMotion()

  async function seeMaya() {
    if (await load()) onStart()
  }

  const sections = [LANDING.nav.howItWorks, LANDING.nav.whyTiming].map((s) => ({
    label: s.label,
    href: `#${s.id}`,
    onSelect: () => document.getElementById(s.id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }),
  }))

  return (
    <div className="min-h-svh overflow-x-clip bg-bg text-ink">
      <SiteHeader
        tone="photo"
        navLabel={NAV.sectionsLabel}
        links={sections}
        cta={{ label: LANDING.start, onSelect: onStart }}
        menuItems={[
          ...sections,
          { label: loading ? LANDING.loadingMaya : LANDING.seeMaya, onSelect: () => void seeMaya() },
          { label: LANDING.start, onSelect: onStart },
        ]}
      />
      <main>
        <FocusHero onSeeMaya={() => void seeMaya()} loading={loading} error={error} />
        <WordReveal />
        <FeatureCarousel />
      </main>
    </div>
  )
}
