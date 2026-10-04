import { motion } from 'framer-motion'
import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { NAV } from '../copy'
import { HEADER_SPRING } from './headerMotion'
import RollLabel from './RollLabel'

export interface MenuItem {
  label: string
  /** Section links keep a real href (#id); actions like Start have none. */
  href?: string
  onSelect: () => void
  /** The step the user is on: announced as the current step and marked with a dot. */
  current?: boolean
}

interface Props {
  id: string
  items: MenuItem[]
  /** Closes the menu and puts focus back on the menu button. */
  onClose: () => void
  /** False under reduced motion: no grow, the panel only fades. */
  animate: boolean
}

/**
 * The dark menu. Its surface shares a layoutId with the header's, so it grows out of the
 * pill. A modal dialog: focus moves to the first link on open and Tab stays inside;
 * Esc, the X and a click outside close it. Hovering or focusing one link fades the others.
 */
export default function MenuPanel({ id, items, onClose, animate }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('.menu-link')?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function keepTabInside(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !panelRef.current) return
    const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')]
    const first = focusable[0]
    const last = focusable.at(-1)
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  }

  function choose(e: MouseEvent, item: MenuItem) {
    e.preventDefault()
    onClose()
    item.onSelect()
  }

  const link =
    'menu-link inline-block gap-3 rounded-lg text-left text-3xl font-semibold tracking-tight transition-opacity duration-200 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ' +
    'group-has-[.menu-link:hover]/menu:opacity-40 group-has-[.menu-link:focus-visible]/menu:opacity-40 hover:opacity-100! focus-visible:opacity-100!'

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="fixed inset-0 z-[55] bg-ink/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onKeyDown={keepTabInside}
        className="fixed inset-x-4 top-3 z-60 mx-auto isolate max-w-[720px] p-6 text-white tablet:p-8"
        initial={animate ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={animate ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          layoutId={animate ? 'nav-surface' : undefined}
          transition={HEADER_SPRING}
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-ink shadow-2xl shadow-ink/30"
          style={{ borderRadius: 24 }}
        />

        <motion.div
          initial={{ opacity: 0, y: animate ? 8 : 0 }}
          animate={{ opacity: 1, y: 0, transition: { delay: animate ? 0.12 : 0, duration: 0.25 } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          <div className="flex items-center justify-between gap-4">
            <p id={labelId} className="text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">
              {NAV.explore}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label={NAV.closeMenu}
              className="grid size-11 place-items-center rounded-full border border-white/30 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <CloseIcon />
            </button>
          </div>

          <ul className="group/menu mt-6 space-y-3 tablet:mt-8">
            {items.map((item) => (
              <li key={item.href ?? item.label}>
                {item.href ? (
                  <a href={item.href} onClick={(e) => choose(e, item)} className={link}>
                    <RollLabel>{item.label}</RollLabel>
                  </a>
                ) : (
                  <button type="button" onClick={(e) => choose(e, item)} aria-current={item.current ? 'step' : undefined} className={link}>
                    <RollLabel>
                      {item.label}
                      {item.current && <span aria-hidden="true" className="size-2 rounded-full bg-white" />}
                    </RollLabel>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </motion.div>
      </motion.div>
    </>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-none stroke-current" strokeWidth="1.75">
      <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
    </svg>
  )
}
