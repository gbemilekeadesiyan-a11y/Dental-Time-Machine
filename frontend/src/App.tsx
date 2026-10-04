import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { useEffect, useReducer, useState } from 'react'
import { ArrowLeft, ArrowRight } from './components/Icons'
import Container from './components/Container'
import SiteHeader from './components/SiteHeader'
import StepIndicator from './components/StepIndicator'
import FindCare from './features/filters/FindCare'
import TellUs from './screens/TellUs'
import TwoFutures from './screens/TwoFutures'
import WhatItMeans from './screens/WhatItMeans'
import YourYear from './screens/YourYear'
import Landing from './features/timeline/landing/Landing'
import ChatIntake from './features/chat/ChatIntake'
import ChatSummary from './features/chat/ChatSummary'
import GuideDock from './features/chat/guide/GuideDock'
import SummaryScreen from './features/summary/SummaryScreen'
import { NAV, stepOf } from './copy'
import { initialState, reducer } from './state'
import { StepContext } from './stepContext'
import RollLabel from './components/RollLabel'

interface ScreenDef {
  id: string
  label: string
}

const SCREENS = [
  { id: 'tell-us', label: 'Tell us' },
  { id: 'what-it-means', label: 'What it means' },
  { id: 'two-futures', label: 'Two futures' },
  { id: 'summary', label: 'Summary' }, // Mount point (feature/summary)
  { id: 'find-care', label: 'Find care' }, // Mount point (feature/filters)
  { id: 'your-year', label: 'Your year' },
] as const satisfies readonly ScreenDef[]

type ScreenIndex = 0 | 1 | 2 | 3 | 4 | 5
type View = 'start' | ScreenIndex
/** 1 when moving forward through the flow, -1 when going back. */
type Direction = 1 | -1
const LAST: ScreenIndex = 5

/** Where a view sits in the flow, so a move can tell forward from back. The landing is first. */
const rank = (v: View) => (v === 'start' ? -1 : v)

/** Quick start, long soft landing. */
const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Steps fade and slide a little in the direction of travel. */
const stepSlide: Variants = {
  enter: (dir: Direction) => ({ opacity: 0, x: 32 * dir }),
  center: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE_OUT } },
  exit: (dir: Direction) => ({ opacity: 0, x: -32 * dir, transition: { duration: 0.2, ease: 'easeIn' } }),
}

/**
 * Landing to steps and back: a fade only. A transform here would pin the fixed header
 * to this wrapper while it fades.
 */
const pageFade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.45, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } },
}

/** Under reduced motion every page change is a short cross-fade with no movement. */
const quickFade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}

/** The old page has faded out, so the jump to the top is never seen. */
const toTop = () => window.scrollTo({ top: 0, behavior: 'instant' })

export default function App() {
  const [{ view, dir }, setNav] = useState<{ view: View; dir: Direction }>({ view: 'start', dir: 1 })
  const [state, dispatch] = useReducer(reducer, initialState)

  // Screen readers and the browser's speech engine follow the page language. Set here, not in a
  // picker, because the language pickers now live in the chat cards and aren't on every page.
  useEffect(() => {
    document.documentElement.lang = state.preferences.language
  }, [state.preferences.language])
  const reduceMotion = useReducedMotion()

  /** Moves to another view and remembers which way we went, for the slide. */
  const go = (to: View | ((from: View) => View)) =>
    setNav((cur) => {
      const next = typeof to === 'function' ? to(cur.view) : to
      return next === cur.view ? cur : { view: next, dir: rank(next) > rank(cur.view) ? 1 : -1 }
    })

  function renderScreen(current: ScreenIndex) {
    switch (current) {
      case 0:
        // Mount point (feature/chat): voice/text intake, first in Tell us' left column.
        return <TellUs state={state} dispatch={dispatch} intake={<ChatIntake state={state} dispatch={dispatch} />} />
      case 1:
        return <WhatItMeans state={state} onEditCare={() => go(0)} />
      case 2:
        return <TwoFutures state={state} dispatch={dispatch} onEditCare={() => go(0)} />
      case 3:
        // Mount point (feature/chat): the chatbot recap, beside the visual summary.
        return <SummaryScreen state={state} onEditCare={() => go(0)} recap={<ChatSummary state={state} dispatch={dispatch} />} />
      case 4:
        return <FindCare state={state} onEditCare={() => go(0)} />
      case 5:
        return <YourYear state={state} onEditCare={() => go(0)} />
    }
  }

  const goBack = () => go((v) => (v === 'start' ? v : v === 0 ? 'start' : ((v - 1) as ScreenIndex)))
  const goNext = () => go((v) => (v === 'start' ? 0 : v < LAST ? ((v + 1) as ScreenIndex) : v))

  const page = reduceMotion ? quickFade : pageFade
  const step = reduceMotion ? quickFade : stepSlide

  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={toTop}>
      {view === 'start' ? (
        // Mount point (feature/timeline): the landing page is full-width, outside the step layout.
        <motion.div key="landing" variants={page} initial="enter" animate="center" exit="exit">
          <Landing dispatch={dispatch} onStart={() => go(0)} />
        </motion.div>
      ) : (
        // overflow-x-clip: a step sliding in never adds a sideways scrollbar.
        <motion.div key="steps" className="overflow-x-clip" variants={page} initial="enter" animate="center" exit="exit">
          <BackgroundBlobs />
          {/* The same morphing header as the landing page; it stays put while the steps slide. */}
          <SiteHeader
            tone="light"
            navLabel={NAV.pagesLabel}
            links={[{ label: NAV.home, onSelect: () => go('start') }]}
            note={stepOf(view + 1, SCREENS.length)}
            menuItems={[
              { label: NAV.home, onSelect: () => go('start') },
              ...SCREENS.map((s, i) => ({ label: s.label, current: i === view, onSelect: () => go(i as ScreenIndex) })),
            ]}
          />
          {/* pt-24 clears the 72 px header with 24 px to spare. */}
          <Container className="flex min-h-screen flex-col gap-8 pt-24 pb-6 tablet:pb-8">
            <h1 className="sr-only">Dental Time Machine</h1>
            <StepIndicator steps={SCREENS} current={view} onSelect={(i) => go(i as ScreenIndex)} />

            <main className="flex-1">
              <AnimatePresence mode="wait" initial={false} custom={dir} onExitComplete={toTop}>
                <motion.div
                  key={SCREENS[view].id}
                  custom={dir}
                  variants={step}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {/* Inside the keyed page, so a page fading out keeps its own step number. */}
                  <StepContext.Provider value={{ number: view + 1, total: SCREENS.length }}>
                    {renderScreen(view)}
                  </StepContext.Provider>
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Navigation (feature/summary): Back and Next stay on screen, so long steps need no scrolling to move on. */}
            <footer className="glass sticky bottom-3 z-20 flex justify-between gap-3 rounded-full p-2">
              <button type="button" onClick={goBack} className="btn-secondary">
                <RollLabel>
                  <ArrowLeft />
                  Back
                </RollLabel>
              </button>
              <button type="button" onClick={goNext} disabled={view === LAST} className="btn-primary">
                <RollLabel>
                  Next
                  <ArrowRight />
                </RollLabel>
              </button>
            </footer>
          </Container>
          {/* Mount point (feature/guide): the step-by-step guide, outside the sliding page so it stays put. */}
          <GuideDock state={state} screen={SCREENS[view].id} onGo={(id) => go(SCREENS.findIndex((s) => s.id === id) as ScreenIndex)} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Large, soft, blurred blue shapes behind the glass. Decorative only. */
function BackgroundBlobs() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-48 -left-40 size-[38rem] rounded-full bg-gradient-from/45 blur-[110px]" />
      <div className="absolute top-1/3 -right-48 size-[32rem] rounded-full bg-gradient-to/35 blur-[110px]" />
      <div className="absolute -bottom-56 left-1/4 size-[30rem] rounded-full bg-primary/25 blur-[110px]" />
    </div>
  )
}
