import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ApiError, explain } from '../../api'
import { ArrowRight } from '../../components/Icons'
import TermSheet from './TermSheet'
import './documents.css'

/** iOS-like ease: quick start, long soft settle. */
const IOS_EASE = [0.32, 0.72, 0, 1] as const
/** When the cards start popping, after the blur has mostly settled (seconds). */
const CARDS_DELAY = 0.55
const EXPLAIN_ERROR = "We couldn't load an explanation right now. Please try again in a moment."

interface Props {
  /** A picture of the uploaded document, or null if one couldn't be made. */
  previewUrl: string | null
  phase: 'scanning' | 'revealed'
  terms: string[]
  onContinue: () => void
  /** Opens the chat about a term, or about the whole document when term is null. */
  onAsk?: (term: string | null) => void
}

/**
 * The reading and reveal moment (feature/documents):
 * 1. scanning: the real document with a light beam sweeping down it,
 * 2. revealed: the document blurs and sinks back (iPhone style) and term cards
 *    pop out. Tap one for a plain-language explanation from the AI.
 */
export default function DocumentReveal({ previewUrl, phase, terms, onContinue, onAsk }: Props) {
  const reduceMotion = useReducedMotion() ?? false
  const revealed = phase === 'revealed'
  const titleId = useId()
  const stageRef = useRef<HTMLElement>(null)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const [selected, setSelected] = useState<string | null>(null)
  const [explanations, setExplanations] = useState<Record<string, string>>({})

  useEffect(() => {
    stageRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  }, [reduceMotion])

  const open = useCallback(
    (term: string) => {
      setSelected(term)
      if (explanations[term]) return
      explain(term, 'en', 'simple')
        .then((r) => setExplanations((all) => ({ ...all, [term]: r.text })))
        .catch((e: unknown) =>
          setExplanations((all) => ({ ...all, [term]: e instanceof ApiError ? e.message : EXPLAIN_ERROR })),
        )
    },
    [explanations],
  )

  const close = useCallback(() => {
    const term = selected
    setSelected(null)
    // preventScroll: if the user is heading to the chat, focusing the card must not scroll back down.
    if (term) requestAnimationFrame(() => cardRefs.current.get(term)?.focus({ preventScroll: true }))
  }, [selected])

  return (
    <section
      ref={stageRef}
      aria-labelledby={titleId}
      aria-busy={!revealed}
      className="glass relative overflow-hidden rounded-3xl"
    >
      {/* One grid cell holds both the document and the cards, so the stage grows to fit the cards on small screens. */}
      <div className="relative grid min-h-[36rem] place-items-center px-4 py-10 sm:px-10">
        {/* The document: sharp while scanning, then blurred and pushed back. */}
        <motion.div
          className="relative col-start-1 row-start-1"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
          animate={
            revealed
              ? { opacity: 1, y: 0, scale: reduceMotion ? 1 : 0.92, filter: 'blur(10px) saturate(1.8) brightness(1.04)' }
              : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px) saturate(1) brightness(1)' }
          }
          transition={{ duration: reduceMotion ? 0 : revealed ? 0.8 : 0.45, ease: IOS_EASE }}
        >
          <div className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-ink/10">
            {previewUrl ? (
              <motion.img
                key={previewUrl}
                src={previewUrl}
                alt=""
                className="block max-h-[30rem] w-auto max-w-full bg-card"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
              />
            ) : (
              <PlainPage />
            )}
            {!revealed && <ScanBeam />}
          </div>
          {!revealed && <ScanCorners />}
        </motion.div>

        {/* Frosted tint over the blurred document. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-white/20"
          initial={false}
          animate={{ opacity: revealed ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: IOS_EASE }}
        />

        {revealed ? (
          <div className="relative z-10 col-start-1 row-start-1 flex w-full flex-col items-center gap-6">
            <motion.div
              className="space-y-1 text-center"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.35, ease: IOS_EASE }}
            >
              <h3 id={titleId} className="text-2xl font-semibold tracking-tight text-balance text-ink sm:text-3xl">
                Here&apos;s what your document is saying
              </h3>
              <p className="text-sm text-ink/80">Tap a term to see what it means in plain words.</p>
            </motion.div>

            <LayoutGroup>
              <ul className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center">
                {terms.map((term, i) => (
                  <li key={term}>
                    <motion.button
                      ref={(el) => {
                        if (el) cardRefs.current.set(term, el)
                        else cardRefs.current.delete(term)
                      }}
                      type="button"
                      layoutId={`term-${term}`}
                      onClick={() => open(term)}
                      aria-haspopup="dialog"
                      className="h-full min-h-11 w-full rounded-2xl bg-card/90 px-4 py-3 text-left shadow-lg ring-1 ring-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto sm:px-5 sm:py-4"
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 28 }}
                      animate={{ opacity: 1, scale: 1, y: 0, rotate: reduceMotion ? 0 : tilt(i) }}
                      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.04, rotate: 0 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                      transition={{
                        default: reduceMotion
                          ? { duration: 0.2, delay: i * 0.04 }
                          : { type: 'spring', stiffness: 320, damping: 20, delay: CARDS_DELAY + i * 0.08 },
                        layout: { type: 'spring', stiffness: 380, damping: 34 },
                      }}
                    >
                      <span className="block text-sm font-semibold tracking-tight text-ink sm:text-base">{term}</span>
                      <span className="mt-0.5 block text-xs text-muted-text">Tap to see what this means</span>
                    </motion.button>
                  </li>
                ))}
              </ul>

              <TermSheet
                term={selected}
                explanation={selected ? explanations[selected] : undefined}
                onClose={close}
                onAsk={onAsk}
              />
            </LayoutGroup>

            <motion.div
              className="flex flex-wrap justify-center gap-3"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : CARDS_DELAY + terms.length * 0.08 + 0.2 }}
            >
              {onAsk && (
                <button type="button" onClick={() => onAsk(null)} className="btn-secondary bg-card">
                  Ask about my document
                </button>
              )}
              <button type="button" onClick={onContinue} className="btn-primary">
                Check my details
                <ArrowRight />
              </button>
            </motion.div>
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-5 flex justify-center">
            <p
              id={titleId}
              role="status"
              className="flex items-center gap-2 rounded-full bg-card/90 px-4 py-2 text-sm font-medium text-ink shadow-sm"
            >
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
              </span>
              Reading your document…
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

/** A slight, stable tilt per card so the fan looks hand-placed. */
function tilt(i: number): number {
  return [-2, 1.5, -1, 2, -1.5, 1, -2.5, 1.5][i % 8] ?? 0
}

/** A band of light sweeping down the page, with a bright leading edge (loop in documents.css). */
function ScanBeam() {
  return (
    <div
      aria-hidden="true"
      className="doc-scan-beam pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-linear-to-b from-transparent via-primary/20 to-primary/45"
    >
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-primary shadow-[0_0_20px_6px_rgb(60_74_161/0.6)]" />
    </div>
  )
}

/** Camera-style corner brackets around the page while it's being read (loop in documents.css). */
function ScanCorners() {
  const corner = 'absolute size-7 border-primary'
  return (
    <div aria-hidden="true" className="doc-scan-corners pointer-events-none absolute -inset-3">
      <span className={`${corner} top-0 left-0 rounded-tl-xl border-t-2 border-l-2`} />
      <span className={`${corner} top-0 right-0 rounded-tr-xl border-t-2 border-r-2`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-xl border-b-2 border-l-2`} />
      <span className={`${corner} right-0 bottom-0 rounded-br-xl border-r-2 border-b-2`} />
    </div>
  )
}

/** Shown if a preview couldn't be made: a plain page with text lines. */
function PlainPage() {
  return (
    <div className="flex h-[26rem] w-[20rem] max-w-full flex-col gap-3 bg-card p-8">
      <span className="h-3 w-1/2 rounded bg-track" />
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className={`h-2 rounded bg-track ${i % 4 === 3 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}
