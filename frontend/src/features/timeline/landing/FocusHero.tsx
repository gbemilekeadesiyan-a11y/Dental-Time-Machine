import { useRef } from 'react'
import { ArrowRight } from '../../../components/Icons'
import Notice from '../../../components/Notice'
import HeroPhoto from './HeroPhoto'
import { LANDING } from './landingCopy'
import SplitHeadline from './SplitHeadline'
import RollLabel from '../../../components/RollLabel'

interface Props {
  onSeeMaya: () => void
  loading: boolean
  error: string | null
}

/**
 * Full-screen hero. The photo is drawn twice: blurred and dimmed behind, and sharp
 * inside a rounded "window" in the middle, so the window shows exactly what's behind
 * it, just in focus. The edges are darkened to pull the eye to the window.
 */
export default function FocusHero({ onSeeMaya, loading, error }: Props) {
  const heroRef = useRef<HTMLElement>(null)

  return (
    <section ref={heroRef} className="focus-hero relative h-svh min-h-[36rem] overflow-hidden">
      {/* Ambient fill: the photo stretched over the whole hero, very blurred and dim, so the
          space around the smaller photo isn't empty. Extends past the edges so the blur
          doesn't fade to a light halo. */}
      <div aria-hidden="true" className="absolute -inset-24 blur-3xl brightness-[0.7]">
        <HeroPhoto variant="fill" priority />
      </div>

      {/* Blurred, dimmed copy of the centered photo; its soft edges melt into the fill.
          Positioned from the center, so it lines up exactly with the sharp copy. */}
      <div aria-hidden="true" className="hero-feather absolute -inset-24 blur-md brightness-[0.85]">
        <HeroPhoto variant="fit" />
      </div>

      {/* Darker edges, so the eye goes to the window. */}
      <div aria-hidden="true" className="absolute inset-0 bg-radial from-transparent from-45% to-ink/45" />

      {/* A soft dark band along the top, so the white top-bar text stays readable on bright photos. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-48 bg-linear-to-b from-ink/50 to-transparent" />

      {/* The same photo, sharp, clipped to the window. */}
      <div aria-hidden="true" className="focus-window-clip absolute inset-0">
        <HeroPhoto variant="fit" />
      </div>

      {/* The window frame: thin white border, a soft highlight, the way in. */}
      {/* Soft inner shadow darkens the window rim (depth, and contrast where the headline overlaps). */}
      <div className="focus-window-frame border border-white/70 shadow-2xl shadow-ink/25 inset-shadow-[0_0_72px] inset-shadow-ink/45">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[inherit] bg-linear-to-br from-white/20 via-white/0 to-white/0"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-6 sm:p-8">
          <button
            type="button"
            onClick={onSeeMaya}
            disabled={loading}
            className="btn-light min-h-12 px-6 text-base shadow-lg shadow-ink/20 [--focus-ring:#fff]"
          >
            <RollLabel>
              {loading ? LANDING.loadingMaya : LANDING.seeMaya}
              <ArrowRight />
            </RollLabel>
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
