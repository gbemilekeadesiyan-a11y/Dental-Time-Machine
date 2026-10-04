import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId, useState } from 'react'
import { GLOSSARY_HEADING } from '../copy'
import { GLOSSARY, GLOSSARY_TERMS, type GlossaryTerm } from '../glossary'
import { ChevronDown } from './Icons'

/** The glossary as tap-to-expand rows. Several rows can be open at once. Text comes from glossary.ts. */
export default function GlossaryAccordion() {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="glass rounded-3xl p-2">
      <h3 id={headingId} className="px-3 pt-3 pb-1 text-sm font-medium text-muted-text">
        {GLOSSARY_HEADING}
      </h3>
      <ul className="divide-y divide-muted/25">
        {GLOSSARY_TERMS.map((term) => (
          <AccordionRow key={term} term={term} />
        ))}
      </ul>
    </section>
  )
}

function AccordionRow({ term }: { term: GlossaryTerm }) {
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const id = useId()
  const buttonId = `${id}-button`
  const panelId = `${id}-panel`
  const entry = GLOSSARY[term]

  return (
    <li>
      <h4>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left font-medium text-ink hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          {entry.term}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="text-primary"
          >
            <ChevronDown />
          </motion.span>
        </button>
      </h4>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <p className="px-3 pt-1 pb-4 text-sm leading-relaxed text-ink">{entry.explanation}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
