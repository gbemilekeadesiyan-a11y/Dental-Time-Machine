import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { Fragment, useRef, useState } from 'react'
import Container from '../../../components/Container'
import { LANDING } from './landingCopy'

/**
 * "Why timing matters". Each word starts muted (the muted token at 30%) and turns
 * ink as the paragraph scrolls through the screen. One copy of each word, so
 * screen readers, copy and paste, and find-in-page all see the text once.
 * Colors are read from the section 11 tokens Tailwind puts on :root.
 */
export default function WordReveal() {
  const reduceMotion = useReducedMotion()
  const colors = useTokenColors()
  const paragraphRef = useRef<HTMLParagraphElement>(null)
  // Starts when the paragraph's top reaches 85% down the screen, ends when its bottom reaches 55%.
  const { scrollYProgress } = useScroll({ target: paragraphRef, offset: ['start 0.85', 'end 0.55'] })
  const words = LANDING.revealText.split(' ')

  return (
    // The carousel below gives the page enough scroll room for the reveal to finish.
    <section id={LANDING.nav.whyTiming.id} aria-labelledby="why-timing-title" className="section-y scroll-mt-16 bg-bg">
      <Container className="space-y-3">
        <h2 id="why-timing-title" className="eyebrow">
          {LANDING.revealLabel}
        </h2>
        <p
          ref={paragraphRef}
          className="text-[clamp(2rem,3.5vw,3rem)] leading-[1.15] font-medium tracking-tight text-pretty text-ink"
        >
          {words.map((word, i) => (
            <Fragment key={`${i}-${word}`}>
              <Word
                progress={scrollYProgress}
                start={i / words.length}
                end={(i + 1) / words.length}
                from={colors.muted30}
                to={colors.ink}
                done={!!reduceMotion}
              >
                {word}
              </Word>{' '}
            </Fragment>
          ))}
        </p>
      </Container>
    </section>
  )
}

interface WordProps {
  progress: MotionValue<number>
  start: number
  end: number
  from: string
  to: string
  /** Reduced motion: show the final, fully ink state. */
  done: boolean
  children: string
}

function Word({ progress, start, end, from, to, done, children }: WordProps) {
  const color = useTransform(progress, [start, end], [from, to])
  return <motion.span style={{ color: done ? to : color }}>{children}</motion.span>
}

/** The ink and muted tokens from :root, with muted at 30% opacity as an rgba() Framer Motion can blend. */
function useTokenColors() {
  const [colors] = useState(() => {
    const css = getComputedStyle(document.documentElement)
    const ink = css.getPropertyValue('--color-ink').trim()
    const muted = css.getPropertyValue('--color-muted').trim()
    return { ink, muted30: withAlpha(muted, 0.3) }
  })
  return colors
}

function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
