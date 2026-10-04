import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from 'framer-motion'
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { LANDING } from './landingCopy'
import RollLabel from '../../../components/RollLabel'

/** Seconds each slide stays before moving to the next. */
const SLIDE_SECONDS = 6
/** Pixel size of every photo (4:3), set on the img so the layout doesn't shift while it loads. */
const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 900

type Slide = (typeof LANDING.features)[number]

/**
 * "How it works": four feature tabs and one large image card.
 *
 * Auto-advances every 6 s. Pauses while the pointer is over the carousel (the tabs and the
 * image card; not the heading or the section's empty space, which can fill a whole laptop
 * screen and would stop it from ever moving), while keyboard focus is inside it, while it's off screen, while the browser tab is hidden, and when the
 * user presses Pause. Under reduced motion: no autoplay, no zoom, instant swaps.
 */
export default function FeatureCarousel() {
  const slides = LANDING.features
  const reduceMotion = !!useReducedMotion()
  const baseId = useId()
  const headingId = `${baseId}-heading`
  const panelId = `${baseId}-panel`
  const tabId = (i: number) => `${baseId}-tab-${i}`

  const sectionRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const [active, setActive] = useState(0)
  /** Bumped on every manual selection so the timer restarts even when the same tab is chosen. */
  const [cycle, setCycle] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [keyboardFocusInside, setKeyboardFocusInside] = useState(false)
  const [pageHidden, setPageHidden] = useState(() => document.hidden)
  const [missingImages, setMissingImages] = useState<ReadonlySet<string>>(() => new Set())
  const inView = useInView(sectionRef, { amount: 0.3 })

  const progress = useMotionValue(0)
  const timer = useRef<AnimationPlaybackControls | null>(null)

  const running = !reduceMotion && !userPaused && !hovered && !keyboardFocusInside && inView && !pageHidden

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // One 6-second timer per slide. It's created paused; the effect below plays or pauses it.
  useEffect(() => {
    if (reduceMotion) return
    progress.set(0)
    const controls = animate(progress, 1, {
      duration: SLIDE_SECONDS,
      ease: 'linear',
      onComplete: () => {
        progress.set(0)
        setActive((i) => (i + 1) % slides.length)
      },
    })
    controls.pause()
    timer.current = controls
    return () => controls.stop()
  }, [active, cycle, reduceMotion, progress, slides.length])

  // Warm the next slide's photo once the carousel is on screen, so it fades in with its slide.
  useEffect(() => {
    if (!inView) return
    const next = slides[(active + 1) % slides.length]
    if (next) new Image().src = next.image
  }, [active, inView, slides])

  useEffect(() => {
    if (running) timer.current?.play()
    else timer.current?.pause()
  }, [running, active, cycle])

  function select(i: number) {
    progress.set(0)
    setActive(i)
    setCycle((c) => c + 1)
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = slides.length - 1
    const next =
      event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    select(next)
    tabRefs.current[next]?.focus()
  }

  // Keyboard focus pauses rotation (mouse users are covered by hover). Focus on the
  // Pause/Play control itself doesn't, so pressing Play actually resumes.
  function onFocusIn(event: FocusEvent<HTMLElement>) {
    const target = event.target
    setKeyboardFocusInside(target !== toggleRef.current && target.matches(':focus-visible'))
  }

  function onFocusOut(event: FocusEvent<HTMLElement>) {
    if (!sectionRef.current?.contains(event.relatedTarget as Node | null)) setKeyboardFocusInside(false)
  }

  const slide = slides[active] as Slide

  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      className="graph-paper px-5 py-24 sm:px-8 sm:py-32"
      onFocus={onFocusIn}
      onBlur={onFocusOut}
    >
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="space-y-4">
          <p className="text-sm font-medium tracking-[0.18em] text-muted-text uppercase">{LANDING.featuresLabel}</p>
          <h2 id={headingId} className="text-4xl font-light tracking-tight text-ink sm:text-5xl">
            {LANDING.featuresHeading}
          </h2>
        </div>

        <div
          className="grid items-center gap-8 lg:grid-cols-[2fr_3fr] lg:gap-12"
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          {/* Tabs: second on phones (under the image), left column on wide screens. */}
          <div role="tablist" aria-labelledby={headingId} aria-orientation="vertical" className="order-2 space-y-2 lg:order-1">
            {slides.map((s, i) => {
              const selected = i === active
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    tabRefs.current[i] = el
                  }}
                  id={tabId(i)}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(i)}
                  onKeyDown={(e) => onTabKeyDown(e, i)}
                  className={
                    'block w-full space-y-2 rounded-2xl p-4 text-left transition-colors ' +
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
                    (selected ? 'glass' : 'hover:bg-card/60')
                  }
                >
                  <span className="block text-lg font-semibold tracking-tight text-ink">{s.title}</span>
                  <span className="block text-sm leading-relaxed text-muted-text">{s.line}</span>
                  <span aria-hidden="true" className="mt-3 block h-0.5 overflow-hidden rounded-full bg-ink/10">
                    <motion.span
                      className="block h-full origin-left rounded-full bg-primary"
                      style={{ scaleX: selected ? (reduceMotion ? 1 : progress) : 0 }}
                    />
                  </span>
                </button>
              )
            })}
          </div>

          {/* The image: first on phones, right column on wide screens. */}
          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId(active)}
            aria-live={running ? 'off' : 'polite'}
            className="group relative order-1 aspect-4/3 overflow-hidden rounded-3xl shadow-xl shadow-primary/10 ring-1 ring-ink/5 lg:order-2"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={slide.id}
                className="absolute inset-0"
                initial={reduceMotion ? false : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -24 }}
                transition={{ duration: reduceMotion ? 0 : 0.5, ease: 'easeOut' }}
              >
                <SlideVisual
                  slide={slide}
                  first={active === 0}
                  missing={missingImages.has(slide.image)}
                  reduceMotion={reduceMotion}
                  onMissing={() => setMissingImages((prev) => new Set(prev).add(slide.image))}
                />
              </motion.div>
            </AnimatePresence>

            {!reduceMotion && (
              <button
                ref={toggleRef}
                type="button"
                onClick={() => setUserPaused((p) => !p)}
                aria-label={userPaused ? LANDING.playLabel : LANDING.pauseLabel}
                className="btn-light absolute top-4 right-4 z-10 px-4 text-sm"
              >
                <RollLabel>
                  {userPaused ? <PlayIcon /> : <PauseIcon />}
                  {userPaused ? LANDING.play : LANDING.pause}
                </RollLabel>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

interface SlideVisualProps {
  slide: Slide
  first: boolean
  missing: boolean
  /** Reduced motion: no fade-in and no hover zoom. */
  reduceMotion: boolean
  onMissing: () => void
}

/**
 * A soft gradient placeholder with the slide title, with the photo fading in on top once
 * it loads (0.5 s, the same feel as the slide crossfade). If the photo file is missing,
 * only the placeholder shows.
 */
function SlideVisual({ slide, first, missing, reduceMotion, onMissing }: SlideVisualProps) {
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      <div className="absolute inset-0 flex items-end bg-linear-to-br from-gradient-from/20 to-gradient-to/35 p-6 sm:p-10">
        <p className="max-w-sm text-3xl font-light tracking-tight text-ink sm:text-4xl">{slide.title}</p>
      </div>
      {!missing && (
        <motion.img
          src={slide.image}
          alt={slide.alt}
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
          loading={first ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={onMissing}
          initial={false}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, ease: 'easeOut' }}
          className={
            'absolute inset-0 size-full object-cover ' +
            (reduceMotion ? '' : 'transition-transform duration-[600ms] ease-out group-hover:scale-[1.04]')
          }
        />
      )}
    </>
  )
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
      <rect x="3.5" y="3" width="3" height="10" rx="1" />
      <rect x="9.5" y="3" width="3" height="10" rx="1" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
      <path d="M4.5 2.8v10.4a.8.8 0 0 0 1.2.7l8.3-5.2a.8.8 0 0 0 0-1.4L5.7 2.1a.8.8 0 0 0-1.2.7Z" />
    </svg>
  )
}
