import { AnimatePresence, LayoutGroup, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { useCallback, useId, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { NAV } from '../copy'
import { HEADER_SPRING } from './headerMotion'
import { ArrowRight } from './Icons'
import Logo from './Logo'
import MenuPanel, { type MenuItem } from './MenuPanel'
import RollLabel from './RollLabel'

/** Scroll distance in px after which the bar becomes the floating pill. */
const COMPACT_AFTER = 40
/** Under 810 px (section 11 tablet breakpoint) the header is always the pill. */
const PHONE_QUERY = '(max-width: 809.98px)'

export interface HeaderLink {
  label: string
  /** Section links keep a real href (#id); page links have none. */
  href?: string
  onSelect: () => void
}

interface Props {
  /** 'photo': white text over the landing hero while at the top. 'light': ink text over the light step pages. */
  tone: 'photo' | 'light'
  /** Accessible name for the left-hand links. */
  navLabel: string
  links: HeaderLink[]
  /** A short note after the links, such as "Step 2 of 6". */
  note?: string
  /** The primary pill on the right (Start on the landing page). */
  cta?: { label: string; onSelect: () => void }
  menuItems: MenuItem[]
}

/**
 * The header on every page. At the top it is a full-width transparent bar: links on the
 * left, the logo in the middle, an optional primary pill and a menu button on the right.
 * Once the page scrolls it morphs (a layout spring, not a jump) into a centered glass
 * pill with ink text. Phones always get the pill with just the logo and the menu button.
 * Reduced motion: no morph or grow; states swap and the menu only fades.
 */
export default function SiteHeader({ tone, navLabel, links, note, cta, menuItems }: Props) {
  const reduceMotion = useReducedMotion()
  const animate = !reduceMotion
  const phone = useMediaQuery(PHONE_QUERY)
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(() => scrollY.get() >= COMPACT_AFTER)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y >= COMPACT_AFTER))
  const compact = phone || scrolled
  const onPhoto = tone === 'photo' && !compact

  const [open, setOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const closeMenu = useCallback(() => {
    setOpen(false)
    menuButtonRef.current?.focus({ preventScroll: true })
  }, [])

  function follow(event: MouseEvent, link: HeaderLink) {
    event.preventDefault()
    link.onSelect()
  }

  const controlTone = onPhoto ? 'hover:bg-white/15 focus-visible:outline-white' : 'hover:bg-ink/5 focus-visible:outline-primary'
  const linkClass = `rounded-full px-3 py-2 font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${controlTone}`
  const radius = compact ? 26 : 0

  return (
    <LayoutGroup id={`site-header-${tone}`}>
      <motion.header
        layout={animate}
        transition={HEADER_SPRING}
        data-compact={compact}
        className={
          'fixed inset-x-0 z-50 mx-auto isolate flex items-center justify-between tablet:grid tablet:grid-cols-[1fr_auto_1fr] ' +
          (compact
            ? 'top-3 h-13 w-[calc(100%-2rem)] max-w-[720px] gap-2 pr-1 pl-2 text-sm text-ink'
            : 'top-0 h-18 w-full max-w-[1200px] gap-4 px-4 text-[0.9375rem] tablet:px-6 desktop:px-10 ' +
              (onPhoto ? 'text-white' : 'text-ink'))
        }
        style={{ borderRadius: radius }}
      >
        {/* The surface. While the menu is open it becomes the menu panel (shared layoutId). */}
        {!open && (
          <motion.div
            layoutId={animate ? 'nav-surface' : undefined}
            transition={HEADER_SPRING}
            aria-hidden="true"
            className={'absolute inset-0 -z-10 ' + (compact ? 'glass' : '')}
            style={{ borderRadius: radius }}
          />
        )}

        <motion.nav
          layout={animate ? 'position' : false}
          transition={HEADER_SPRING}
          aria-label={navLabel}
          className="hidden items-center gap-1 justify-self-start tablet:flex"
        >
          {links.map((link) =>
            link.href ? (
              <a key={link.label} href={link.href} onClick={(e) => follow(e, link)} className={linkClass}>
                {link.label}
              </a>
            ) : (
              <button key={link.label} type="button" onClick={link.onSelect} className={linkClass}>
                {link.label}
              </button>
            ),
          )}
          {note && <span className={'px-3 whitespace-nowrap ' + (onPhoto ? 'text-white/80' : 'text-muted-text')}>{note}</span>}
        </motion.nav>

        <motion.p layout={animate ? 'position' : false} transition={HEADER_SPRING} className="justify-self-center">
          <Logo />
        </motion.p>

        <motion.div
          layout={animate ? 'position' : false}
          transition={HEADER_SPRING}
          className="flex items-center gap-2 justify-self-end"
        >
          {cta && (
            <span className="hidden tablet:block">
              <button type="button" onClick={cta.onSelect} className="btn-primary px-4 text-sm">
                <RollLabel>
                  {cta.label}
                  <ArrowRight />
                </RollLabel>
              </button>
            </span>
          )}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={NAV.menu}
            className={`grid size-11 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${controlTone}`}
          >
            <MenuIcon />
          </button>
        </motion.div>
      </motion.header>

      <AnimatePresence>
        {open && <MenuPanel key="menu" id={panelId} items={menuItems} onClose={closeMenu} animate={animate} />}
      </AnimatePresence>
    </LayoutGroup>
  )
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-none stroke-current" strokeWidth="1.75">
      <path d="M3 7h14M3 13h14" strokeLinecap="round" />
    </svg>
  )
}

/** True while the media query matches; follows changes (rotation, window resize). */
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
