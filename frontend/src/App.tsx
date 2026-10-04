import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useReducer, useState } from 'react'
import { ArrowLeft, ArrowRight } from './components/Icons'
import StepIndicator from './components/StepIndicator'
import TellUs from './screens/TellUs'
import TwoFutures from './screens/TwoFutures'
import WhatItMeans from './screens/WhatItMeans'
import YourYear from './screens/YourYear'
import Landing from './features/timeline/landing/Landing'
import ChatIntake from './features/chat/ChatIntake'
import ChatSummary from './features/chat/ChatSummary'
import PreferencesPicker from './features/chat/PreferencesPicker'
import SummaryScreen from './features/summary/SummaryScreen'
import { initialState, reducer } from './state'
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
  { id: 'your-year', label: 'Your year' },
] as const satisfies readonly ScreenDef[]

type ScreenIndex = 0 | 1 | 2 | 3 | 4
type View = 'start' | ScreenIndex
const LAST: ScreenIndex = 4

export default function App() {
  const [view, setView] = useState<View>('start')
  const [state, dispatch] = useReducer(reducer, initialState)
  const reduceMotion = useReducedMotion()

  function renderScreen(current: ScreenIndex) {
    switch (current) {
      case 0:
        return (
          <div className="space-y-6">
            {/* Mount point (feature/chat): voice/text intake above the form. */}
            <ChatIntake state={state} dispatch={dispatch} />
            <TellUs state={state} dispatch={dispatch} />
          </div>
        )
      case 1:
        return <WhatItMeans state={state} onEditCare={() => setView(0)} />
      case 2:
        return <TwoFutures state={state} dispatch={dispatch} onEditCare={() => setView(0)} />
      case 3:
        return (
          <div className="space-y-6">
            <SummaryScreen state={state} onEditCare={() => setView(0)} />
            {/* Mount point (feature/chat): the chatbot recap under the visual summary. */}
            <ChatSummary state={state} />
          </div>
        )
      case 4:
        return <YourYear state={state} onEditCare={() => setView(0)} />
    }
  }

  const goBack = () => setView((v) => (v === 'start' ? v : v === 0 ? 'start' : ((v - 1) as ScreenIndex)))
  const goNext = () => setView((v) => (v === 'start' ? 0 : v < LAST ? ((v + 1) as ScreenIndex) : v))

  // Mount point (feature/timeline): the landing page is full-width, outside the step layout.
  if (view === 'start') return <Landing dispatch={dispatch} onStart={() => setView(0)} />

  return (
    <>
      <BackgroundBlobs />
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-sm font-semibold tracking-tight text-ink">Dental Time Machine</h1>
          <StepIndicator steps={SCREENS} current={view} onSelect={(i) => setView(i as ScreenIndex)} />
          {/* Mount point (feature/chat): language, style and voice. */}
          <PreferencesPicker preferences={state.preferences} dispatch={dispatch} />
        </header>

        <main className="flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={SCREENS[view].id}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {renderScreen(view)}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="flex justify-between gap-3">
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
      </div>
    </>
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
