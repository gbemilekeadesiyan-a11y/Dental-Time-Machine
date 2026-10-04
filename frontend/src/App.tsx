import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useReducer, useState } from 'react'
import TellUs from './screens/TellUs'
import TwoFutures from './screens/TwoFutures'
import WhatItMeans from './screens/WhatItMeans'
import YourYear from './screens/YourYear'
import { initialState, reducer } from './state'

interface ScreenDef {
  id: string
  label: string
}

const SCREENS = [
  { id: 'tell-us', label: 'Tell us' },
  { id: 'what-it-means', label: 'What it means' },
  { id: 'two-futures', label: 'Two futures' },
  { id: 'your-year', label: 'Your year' },
] as const satisfies readonly ScreenDef[]

type ScreenIndex = 0 | 1 | 2 | 3
const LAST: ScreenIndex = 3

export default function App() {
  const [current, setCurrent] = useState<ScreenIndex>(0)
  const [state, dispatch] = useReducer(reducer, initialState)
  const reduceMotion = useReducedMotion()
  const screen = SCREENS[current]

  function renderScreen() {
    switch (current) {
      case 0:
        return <TellUs state={state} dispatch={dispatch} />
      case 1:
        return <WhatItMeans state={state} onEditCare={() => setCurrent(0)} />
      case 2:
        return <TwoFutures state={state} dispatch={dispatch} onEditCare={() => setCurrent(0)} />
      case 3:
        return <YourYear state={state} onEditCare={() => setCurrent(0)} />
    }
  }

  const goBack = () => setCurrent((i) => (i > 0 ? ((i - 1) as ScreenIndex) : i))
  const goNext = () => setCurrent((i) => (i < LAST ? ((i + 1) as ScreenIndex) : i))

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-maroon-dark">Dental Time Machine</h1>
        <p className="text-muted">
          Your dentist tells you what you need. We show you what happens if you change when you get it.
        </p>
      </header>

      <nav aria-label="Steps">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SCREENS.map((s, i) => {
            const active = i === current
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(i as ScreenIndex)}
                  aria-current={active ? 'step' : undefined}
                  className={
                    'w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors ' +
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ' +
                    (active
                      ? 'border-maroon bg-maroon text-white'
                      : 'border-line bg-surface text-ink hover:border-maroon')
                  }
                >
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.label}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <main className="flex-1 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="flex justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={current === 0}
          className="rounded-lg border border-line bg-surface px-4 py-2 font-medium text-ink hover:border-maroon disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
        >
          Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={current === LAST}
          className="rounded-lg bg-maroon px-4 py-2 font-medium text-white hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
        >
          Next
        </button>
      </footer>
    </div>
  )
}
