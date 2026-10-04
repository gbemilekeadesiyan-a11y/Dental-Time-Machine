import { useRef } from 'react'
import { ArrowRight } from '../../../components/Icons'
import Notice from '../../../components/Notice'
import HeroArt from './HeroArt'
import { LANDING } from './landingCopy'
import SplitHeadline from './SplitHeadline'

interface Props {
  onSeeMaya: () => void
  loading: boolean
  error: string | null
}

/**
 * Full-screen hero. The art is drawn twice: blurred and dimmed behind, and sharp
 * inside a rounded "window" in the middle. Both copies fill the same box, so the
 * window always shows exactly what's behind it, just in focus.
 */
export default function FocusHero({ onSeeMaya, loading, error }: Props) {
  const heroRef = useRef<HTMLElement>(null)

  return (
    <section ref={heroRef} className="focus-hero relative h-svh min-h-[36rem] overflow-hidden">
      {/* Blurred, dimmed background. Scaled up so the blur doesn't fade at the edges. */}
      <div aria-hidden="true" className="absolute inset-0 scale-110 blur-2xl brightness-75">
        <HeroArt />
      </div>

      {/* The same art, sharp, clipped to the window. */}
      <div aria-hidden="true" className="focus-window-clip absolute inset-0">
        <HeroArt />
      </div>

      {/* The window frame: thin white border, a soft highlight, the way in. */}
      <div className="focus-window-frame border border-white/70 shadow-2xl shadow-ink/25">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[inherit] bg-linear-to-br from-white/20 via-white/0 to-white/0"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-6 sm:p-8">
          <button
            type="button"
            onClick={onSeeMaya}
            disabled={loading}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-card px-6 text-base font-medium text-ink shadow-lg shadow-ink/20 transition-shadow hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white disabled:opacity-70"
          >
            {loading ? LANDING.loadingMaya : LANDING.seeMaya}
            <ArrowRight />
          </button>
          {error && (
            <div className="w-full max-w-sm">
              <Notice tone="problem">{error}</Notice>
            </div>
          )}
        </div>
      </div>

      <SplitHeadline heroRef={heroRef} />
    </section>
  )
}
