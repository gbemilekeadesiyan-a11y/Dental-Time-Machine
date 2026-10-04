import { useId, useState } from 'react'
import { GLOSSARY, type GlossaryTerm } from '../glossary'

/**
 * A tappable insurance term. Opens a plain-language explanation from glossary.ts.
 * Renders a button and its explanation side by side: place it inside a
 * `flex flex-wrap` row so the explanation can take a full line.
 */
export default function JargonChip({ term }: { term: GlossaryTerm }) {
  const [open, setOpen] = useState(false)
  const explanationId = useId()
  const entry = GLOSSARY[term]

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={explanationId}
        onClick={() => setOpen((o) => !o)}
        className={
          'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
          (open ? 'border-primary bg-primary text-white' : 'border-muted bg-card/90 text-ink hover:border-primary')
        }
      >
        {entry.term}
        <span aria-hidden="true" className="text-xs">
          {open ? '×' : '?'}
        </span>
        <span className="sr-only">{open ? ', hide explanation' : ', what does this mean?'}</span>
      </button>
      <p id={explanationId} hidden={!open} className="basis-full rounded-2xl bg-card p-3 text-sm text-ink shadow-sm">
        {entry.explanation}
      </p>
    </>
  )
}
