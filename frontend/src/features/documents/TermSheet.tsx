import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  /** The open term, or null when closed. */
  term: string | null
  /** The AI explanation (already dollar-guarded by the backend), or undefined while loading. */
  explanation: string | undefined
  onClose: () => void
  onAsk?: (term: string) => void
}

/**
 * The tapped card grown into a sheet (shared layoutId with the card), with a
 * plain-language explanation. Esc or the backdrop closes it. Rendered on
 * document.body: the frosted stage's backdrop-filter would otherwise trap the
 * fixed backdrop inside the stage.
 */
export default function TermSheet({ term, explanation, onClose, onAsk }: Props) {
  const reduceMotion = useReducedMotion() ?? false
  const titleId = useId()
  const backRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!term) return
    backRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [term, onClose])

  return createPortal(
    <AnimatePresence>
      {term && (
        <>
          <motion.div
            key="backdrop"
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            onClick={onClose}
          />
          <div key="sheet" className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              layoutId={reduceMotion ? undefined : `term-${term}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="pointer-events-auto w-full max-w-md space-y-4 rounded-3xl bg-card p-6 shadow-2xl ring-1 ring-ink/5"
              initial={reduceMotion ? { opacity: 0 } : undefined}
              animate={reduceMotion ? { opacity: 1 } : undefined}
              exit={reduceMotion ? { opacity: 0 } : undefined}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              <motion.h4 layout="position" id={titleId} className="text-2xl font-semibold tracking-tight text-ink">
                {term}
              </motion.h4>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.15 }}
                className="space-y-4"
              >
                {explanation ? (
                  <p className="leading-relaxed text-ink">{explanation}</p>
                ) : (
                  <div role="status" aria-label="Loading the explanation" className="space-y-2">
                    {['w-full', 'w-11/12', 'w-2/3'].map((w) => (
                      <span key={w} className={`block h-3 animate-pulse rounded bg-track motion-reduce:animate-none ${w}`} />
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-text">
                  Explained by AI in plain words. Your plan documents have the exact rules for you.
                </p>
                <div className="flex flex-wrap justify-end gap-3">
                  {onAsk && (
                    <button type="button" onClick={() => onAsk(term)} className="btn-secondary">
                      Ask a question
                    </button>
                  )}
                  <button ref={backRef} type="button" onClick={onClose} className="btn-primary">
                    Back
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
