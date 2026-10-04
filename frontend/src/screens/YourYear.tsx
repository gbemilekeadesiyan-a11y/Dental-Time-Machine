import { useEffect, useState } from 'react'
import { ApiError, calculate, isAbortError } from '../api'
import AnimatedMoney from '../components/AnimatedMoney'
import Disclaimer from '../components/Disclaimer'
import JargonChip from '../components/JargonChip'
import MaxRing from '../components/MaxRing'
import Notice from '../components/Notice'
import type { AppState } from '../state'
import type { Result } from '../types'

interface Props {
  state: AppState
  onEditCare: () => void
}

type Inputs = Pick<AppState, 'procedures' | 'plan' | 'schedule'>
interface Answer {
  inputs: Inputs
  outcome: { ok: true; result: Result } | { ok: false; message: string }
}

/** Your year at a glance, for the timing chosen on Two futures. Every amount comes from POST /calculate. */
export default function YourYear({ state, onEditCare }: Props) {
  const { procedures, plan, schedule } = state
  const [answer, setAnswer] = useState<Answer | null>(null)

  useEffect(() => {
    if (procedures.length === 0) return
    const inputs = { procedures, plan, schedule }
    const controller = new AbortController()
    calculate(inputs, { signal: controller.signal })
      .then((result) => setAnswer({ inputs, outcome: { ok: true, result } }))
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
        setAnswer({ inputs, outcome: { ok: false, message } })
      })
    return () => controller.abort()
  }, [procedures, plan, schedule])

  const current =
    answer?.inputs.procedures === procedures && answer.inputs.plan === plan && answer.inputs.schedule === schedule
  const movedCount = Object.values(schedule).filter((y) => y === 'next_year').length

  return (
    <section aria-labelledby="your-year-title" className="space-y-6">
      <div className="space-y-2">
        <h2 id="your-year-title" className="text-2xl font-semibold text-maroon">
          Your year
        </h2>
        <p className="text-muted">
          {movedCount === 0
            ? 'Based on getting all of your care this plan year.'
            : `Based on the timing you chose, with ${movedCount} ${movedCount === 1 ? 'procedure' : 'procedures'} in next plan year.`}
        </p>
      </div>

      {procedures.length === 0 ? (
        <Notice>
          Add your care first.{' '}
          <button type="button" onClick={onEditCare} className="font-medium text-maroon underline">
            Go to Tell us
          </button>
        </Notice>
      ) : !current ? (
        <div className="h-64 animate-pulse rounded-xl bg-cream motion-reduce:animate-none" role="status" aria-label="Working out your year" />
      ) : !answer.outcome.ok ? (
        <Notice tone="problem">
          {answer.outcome.message}{' '}
          <button type="button" onClick={onEditCare} className="font-medium text-maroon underline">
            Check your details
          </button>
        </Notice>
      ) : (
        <div className="grid items-center gap-6 rounded-xl bg-cream p-5 sm:grid-cols-[auto_1fr]">
          <MaxRing left={answer.outcome.result.max_left.this_year} annualMax={plan.annual_max} />
          <div className="space-y-4">
            <dl className="space-y-4" aria-live="polite">
              <div>
                <dt className="text-sm text-muted">You&apos;ll likely pay</dt>
                <dd>
                  <AnimatedMoney value={answer.outcome.result.totals.you_pay} className="text-3xl font-bold text-ink" />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Your plan likely pays</dt>
                <dd>
                  <AnimatedMoney value={answer.outcome.result.totals.plan_pays} className="text-xl font-semibold text-savings" />
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-start gap-2" aria-label="Terms used above">
              <JargonChip term="annual maximum" />
              <JargonChip term="plan year" />
            </div>
          </div>
        </div>
      )}

      <Disclaimer />
    </section>
  )
}
