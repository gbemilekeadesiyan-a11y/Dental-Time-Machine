import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAbortError, narrate, speak } from '../../../api'
import { ArrowRight } from '../../../components/Icons'
import RollLabel from '../../../components/RollLabel'
import type { AppState } from '../../../state'
import type { Language, NarrateResponse, NarrateSegment, NarrateStep } from '../../../types'
import { completePlan } from '../chatUtils'
import './guide.css'
import { GUIDE_COPY } from './guideCopy'

/** The steps the guide talks through, in order. Their screen ids are the same words with "-". */
const GUIDED: NarrateStep[] = ['what_it_means', 'two_futures', 'summary', 'find_care', 'your_year']
const toStep = (screenId: string) => GUIDED.find((s) => s.replaceAll('_', '-') === screenId) ?? null
const toScreen = (step: NarrateStep) => step.replaceAll('_', '-')

/** Reading time when voice is off: about 60 ms a character, at least 1.6 s. */
const readMs = (text: string) => Math.max(1600, text.length * 60)
/** Gives the new page time to slide in and load its figures before the first caption. */
const START_DELAY_MS = 700
/** How long to wait for a highlighted element to appear (the screens load their own figures). */
const TARGET_WAIT_MS = 2000
/** Keys that scroll the page: pressing one means the user took over. */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

/** Narrations already fetched, by step and inputs, so going back doesn't fetch again. Memory only. */
const cache = new Map<string, NarrateResponse>()

interface Props {
  state: AppState
  /** The id of the step on screen ("what-it-means"); the guide shows on the five after Tell us. */
  screen: string
  /** Opens a step, the same way the Next button does. */
  onGo: (screen: string) => void
}

interface Playback {
  key: string
  index: number
  playing: boolean
  done: boolean
}

/**
 * The step-by-step guide (feature/guide). A floating card that reads the step's captions from
 * POST /narrate, speaks them with Polly when voice is on, and highlights the element each one
 * is about ([data-narrate]). Captions are always on screen. At the end it offers the next step
 * with a button; it never moves on by itself. Any failure hides it quietly: the app works as before.
 */
export default function GuideDock({ state, screen, onGo }: Props) {
  const { procedures, schedule, preferences } = state
  const plan = completePlan(state.plan)
  const step = toStep(screen)
  const copy = GUIDE_COPY[preferences.language]
  const reduceMotion = useReducedMotion()
  const [closed, setClosed] = useState(false)
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  // Bumped when a narration arrives, so the component re-reads the cache.
  const [, setFetched] = useState(0)
  const [playback, setPlayback] = useState<Playback | null>(null)
  const dockRef = useRef<HTMLElement>(null)
  const run = useRef<AbortController | null>(null)
  // Read inside the playback loop, so toggling voice mid-step applies to the next caption.
  const voice = useRef({ on: preferences.voice_on, failed: false, language: preferences.language })
  useEffect(() => {
    voice.current.on = preferences.voice_on
    voice.current.language = preferences.language
  }, [preferences.voice_on, preferences.language])

  // Two futures doesn't depend on the chosen timing, so moving a chip there doesn't restart it.
  const key =
    step && plan && procedures.length > 0
      ? JSON.stringify([step, procedures, plan, step === 'two_futures' ? null : schedule, preferences.language, preferences.style])
      : null
  const response = key ? cache.get(key) : undefined
  const hidden = key === null || failed.has(key)

  // Fetch this step's narration once per set of inputs.
  useEffect(() => {
    if (!key || !step || !plan || cache.has(key)) return
    const controller = new AbortController()
    narrate({ step, preferences, procedures, plan, schedule }, { signal: controller.signal })
      .then((r) => {
        cache.set(key, r)
        setFetched((n) => n + 1)
      })
      .catch((e: unknown) => {
        if (!isAbortError(e)) setFailed((f) => new Set(f).add(key))
      })
    return () => controller.abort()
  }, [key, step, plan, preferences, procedures, schedule])

  const stopRun = useCallback(() => {
    run.current?.abort()
    run.current = null
  }, [])

  const play = useCallback(
    async (segments: NarrateSegment[], from: number, forKey: string) => {
      stopRun()
      const controller = new AbortController()
      run.current = controller
      const { signal } = controller
      try {
        for (let i = from; i < segments.length; i++) {
          const segment = segments[i] as NarrateSegment
          // A part that isn't on the page (no reminder button when the maximum is used up, say) is skipped.
          const target = segment.target ? await findTarget(segment.target, signal) : null
          if (segment.target && !target) continue
          setPlayback({ key: forKey, index: i, playing: true, done: false })
          if (target) highlight(target, reduceMotion === true)
          try {
            let spoken = false
            if (voice.current.on && !voice.current.failed) {
              spoken = await speakAndWait(segment.text, voice.current.language, signal)
              if (!spoken) voice.current.failed = true // Polly is out: carry on with captions only.
            }
            if (!spoken) await sleep(readMs(segment.text), signal)
          } finally {
            target?.classList.remove('guide-highlight')
          }
          await sleep(segment.pause_ms, signal)
        }
        setPlayback({ key: forKey, index: segments.length - 1, playing: false, done: true })
      } catch (e) {
        if (!isAbortError(e)) throw e
      }
    },
    [stopRun, reduceMotion, setPlayback],
  )

  const pause = useCallback(() => {
    stopRun()
    setPlayback((p) => (p ? { ...p, playing: false } : p))
  }, [stopRun, setPlayback])

  // Start on entering a step (always after a click: Next, a step chip or the menu, so audio may play).
  // The ref is set inside the timer, so a cancelled timer (a quick step change) doesn't count as started.
  const startedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!key || !response || closed || startedFor.current === key) return
    const timer = window.setTimeout(() => {
      startedFor.current = key
      void play(response.segments, 0, key)
    }, START_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [key, response, closed, play])

  // Leaving the step (or changing its inputs) stops the voice and the highlight right away.
  useEffect(() => stopRun, [key, stopRun])

  const current: Playback | null = playback?.key === key ? playback : null
  const playing = current?.playing ?? false

  // The user takes over: scrolling, or typing in a field outside the guide, pauses it.
  useEffect(() => {
    if (!playing) return
    const outside = (e: Event) => !(e.target instanceof Node && dockRef.current?.contains(e.target))
    const onPointerScroll = (e: Event) => outside(e) && pause()
    const onKey = (e: KeyboardEvent) => {
      if (!outside(e)) return
      const field = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable="true"]')
      if (field || SCROLL_KEYS.has(e.key)) pause()
    }
    window.addEventListener('wheel', onPointerScroll, { passive: true })
    window.addEventListener('touchmove', onPointerScroll, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('input', onPointerScroll, true)
    return () => {
      window.removeEventListener('wheel', onPointerScroll)
      window.removeEventListener('touchmove', onPointerScroll)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('input', onPointerScroll, true)
    }
  }, [playing, pause])

  if (!step) return null

  if (closed) {
    return (
      <div className="fixed right-3 bottom-24 z-40 tablet:right-6">
        <button
          type="button"
          onClick={() => {
            setClosed(false)
            if (key && response) void play(response.segments, 0, key)
          }}
          className="btn-light px-4 text-sm shadow-lg shadow-ink/10"
        >
          <RollLabel>
            <GuideDot />
            {copy.open}
          </RollLabel>
        </button>
      </div>
    )
  }

  if (hidden || !key || !response || response.segments.length === 0) return null

  const segments = response.segments
  const index = Math.min(current?.index ?? 0, segments.length - 1)
  const caption = segments[index]?.text ?? ''
  const done = current?.done ?? false
  const stepNumber = GUIDED.indexOf(step) + 1
  const iconButton =
    'grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40'

  return (
    <aside
      ref={dockRef}
      aria-label={copy.name}
      className="glass fixed inset-x-3 bottom-24 z-40 space-y-3 rounded-3xl p-4 tablet:inset-x-auto tablet:right-6 tablet:w-[24rem]"
    >
      <div className="flex items-start gap-3">
        <GuideDot speaking={playing && !reduceMotion} />
        {/* Captions are always visible: voice always has a text alternative. */}
        <p className="min-h-14 flex-1 text-lg leading-snug text-ink" aria-live="polite">
          {caption}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="sr-only">{copy.progress(stepNumber, GUIDED.length)}</span>
          {GUIDED.map((s) => (
            <span key={s} aria-hidden="true" className={'size-2 rounded-full ' + (s === step ? 'bg-primary' : 'bg-ink/15')} />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => (playing ? pause() : void play(segments, done ? 0 : index, key))}
            aria-label={playing ? copy.pause : copy.play}
            className={iconButton}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (index + 1 < segments.length) {
                void play(segments, index + 1, key)
              } else {
                stopRun()
                setPlayback({ key, index, playing: false, done: true })
              }
            }}
            disabled={done}
            aria-label={copy.skip}
            className={iconButton}
          >
            <SkipIcon />
          </button>
          <button type="button" onClick={() => void play(segments, 0, key)} aria-label={copy.replay} className={iconButton}>
            <ReplayIcon />
          </button>
          <button
            type="button"
            onClick={() => {
              pause()
              setClosed(true)
            }}
            aria-label={copy.close}
            className={iconButton}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {done &&
        (response.next_step ? (
          <button
            type="button"
            onClick={() => onGo(toScreen(response.next_step as NarrateStep))}
            className="btn-primary w-full"
          >
            <RollLabel>
              {response.next_label}
              <ArrowRight />
            </RollLabel>
          </button>
        ) : (
          <p className="text-sm font-medium text-ink">{response.next_label}</p>
        ))}
    </aside>
  )
}

// ---------- playback helpers ----------

function abortError(): DOMException {
  return new DOMException('The guide stopped.', 'AbortError')
}

/** Waits ms, or rejects with an AbortError as soon as the guide stops. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError())
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(abortError())
    })
  })
}

/** Speaks the text with Polly and waits for it to finish. False if voice is unavailable. */
async function speakAndWait(text: string, language: Language, signal: AbortSignal): Promise<boolean> {
  try {
    await playAudio(await speak(text, language, { signal }), signal)
    return true
  } catch (e) {
    if (isAbortError(e)) throw e
    return false
  }
}

/** The [data-narrate] element, waiting briefly while the screen loads its figures. Null if it never shows. */
async function findTarget(id: string, signal: AbortSignal): Promise<HTMLElement | null> {
  const started = performance.now()
  while (performance.now() - started < TARGET_WAIT_MS) {
    const el = document.querySelector<HTMLElement>(`[data-narrate="${CSS.escape(id)}"]`)
    if (el) return el
    await sleep(100, signal)
  }
  return null
}

function highlight(el: HTMLElement, reduceMotion: boolean): void {
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  el.classList.add('guide-highlight')
}

/** Plays MP3 audio to the end; stops at once if the guide stops. */
function playAudio(blob: Blob, signal: AbortSignal): Promise<void> {
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  return new Promise<void>((resolve, reject) => {
    const finish = () => URL.revokeObjectURL(url)
    audio.onended = () => {
      finish()
      resolve()
    }
    audio.onerror = () => {
      finish()
      reject(new Error('audio failed'))
    }
    signal.addEventListener('abort', () => {
      audio.pause()
      finish()
      reject(abortError())
    })
    audio.play().catch((e: unknown) => {
      finish()
      reject(isAbortError(e) ? abortError() : new Error('audio blocked'))
    })
  })
}

// ---------- icons (decorative: every button has an aria-label) ----------

function GuideDot({ speaking = false }: { speaking?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        'mt-1.5 size-3 shrink-0 rounded-full bg-linear-135 from-gradient-from to-gradient-to ' + (speaking ? 'animate-pulse' : '')
      }
    />
  )
}

const iconClass = 'size-4 fill-none stroke-current'

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={iconClass} strokeWidth="1.75">
      <path d="M5.5 3.5v9M10.5 3.5v9" strokeLinecap="round" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
      <path d="M5 3.2v9.6a.7.7 0 0 0 1.06.6l7.4-4.8a.7.7 0 0 0 0-1.2l-7.4-4.8A.7.7 0 0 0 5 3.2Z" />
    </svg>
  )
}

function SkipIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={iconClass} strokeWidth="1.75">
      <path d="m4 3.5 6 4.5-6 4.5zM12 3.5v9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ReplayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={iconClass} strokeWidth="1.75">
      <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={iconClass} strokeWidth="1.75">
      <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  )
}
