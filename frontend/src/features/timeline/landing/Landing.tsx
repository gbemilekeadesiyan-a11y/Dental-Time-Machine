import type { Dispatch } from 'react'
import type { Action } from '../../../state'
import { useLoadMaya } from '../../../useLoadMaya'
import FeatureCarousel from './FeatureCarousel'
import FocusHero from './FocusHero'
import './landing.css'
import StickyBar from './StickyBar'
import WordReveal from './WordReveal'

interface Props {
  dispatch: Dispatch<Action>
  /** Opens Tell us. */
  onStart: () => void
}

/**
 * The landing page, shown before Tell us (Samuel, feature/timeline).
 * Three scroll effects: a focus-window hero, a split headline that drifts apart,
 * and a word-by-word text reveal. All motion turns off under prefers-reduced-motion.
 */
export default function Landing({ dispatch, onStart }: Props) {
  const { load, loading, error } = useLoadMaya(dispatch)

  function goToTellUs() {
    window.scrollTo({ top: 0 })
    onStart()
  }

  async function seeMaya() {
    if (await load()) goToTellUs()
  }

  return (
    <div className="min-h-svh overflow-x-clip bg-bg text-ink">
      <StickyBar onStart={goToTellUs} />
      <main>
        <FocusHero onSeeMaya={() => void seeMaya()} loading={loading} error={error} />
        <WordReveal />
        <FeatureCarousel />
      </main>
    </div>
  )
}
