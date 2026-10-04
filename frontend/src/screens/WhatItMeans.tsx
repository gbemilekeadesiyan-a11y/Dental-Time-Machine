import { useEffect, useState } from 'react'
import { ApiError, calculate, isAbortError } from '../api'
import Disclaimer from '../components/Disclaimer'
import JargonChip from '../components/JargonChip'
import Notice from '../components/Notice'
import ProcedureCard from '../components/ProcedureCard'
import { formatMoney } from '../format'
import type { AppState } from '../state'
import type { Result } from '../types'

interface Props {
  state: AppState
  onEditCare: () => void
}

type Load =
  | { status: 'loading' }
  | { status: 'ready'; result: Result }
  | { status: 'error'; message: string }

type Inputs = Pick<AppState, 'procedures' | 'plan' | 'schedule'>

/** An answer from the API, tagged with the exact inputs it was computed for. */
interface Answer {
  inputs: Inputs
  load: Exclude<Load, { status: 'loading' }>
}

/** Every amount on this screen comes from POST /calculate (CLAUDE.md section 2). */
export default function WhatItMeans({ state, onEditCare }: Props) {
  const { procedures, plan, schedule } = state
  const [answer, setAnswer] = useState<Answer | null>(null)

  useEffect(() => {
    if (procedures.length === 0) return
    const inputs = { procedures, plan, schedule }
    const controller = new AbortController()
    calculate(inputs, { signal: controller.signal })
      .then((result) => setAnswer({ inputs, load: { status: 'ready', result } }))
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
        setAnswer({ inputs, load: { status: 'error', message } })
      })
    return () => controller.abort()
  }, [procedures, plan, schedule])

  // Still loading until the answer matches the current inputs, so stale numbers never show.
  const current =
    answer?.inputs.procedures === procedures && answer.inputs.plan === plan && answer.inputs.schedule === schedule
  const load: Load = current ? answer.load : { status: 'loading' }

  const names = new Map(procedures.map((p) => [p.id, p.name]))

  return (
    <section aria-labelledby="what-it-means-title" className="space-y-6">
      <div className="space-y-2">
        <h2 id="what-it-means-title" className="text-2xl font-semibold text-maroon">
          What it means
        </h2>
        <p className="text-muted">What your plan likely pays and what you&apos;ll likely pay, in plain words.</p>
      </div>

      {procedures.length === 0 ? (
        <Notice>
          Add your care first.{' '}
          <button type="button" onClick={onEditCare} className="font-medium text-maroon underline">
            Go to Tell us
          </button>
        </Notice>
      ) : load.status === 'loading' ? (
        <LoadingCards count={procedures.length} />
      ) : load.status === 'error' ? (
        <Notice tone="problem">
          {load.message}{' '}
          <button type="button" onClick={onEditCare} className="font-medium text-maroon underline">
            Check your details
          </button>
        </Notice>
      ) : (
        <>
          <Summary result={load.result} />
          <div className="space-y-3" aria-live="polite">
            {load.result.per_procedure.map((line) => (
              <ProcedureCard key={line.id} name={names.get(line.id) ?? 'Procedure'} line={line} />
            ))}
          </div>
          {load.result.warnings.map((w) => (
            <Notice key={w}>{w}</Notice>
          ))}
        </>
      )}

      <Disclaimer />
    </section>
  )
}

function Summary({ result }: { result: Result }) {
  return (
    <div className="space-y-3 rounded-xl bg-cream p-4">
      <p className="text-3xl font-bold text-ink">
        Altogether, you&apos;ll likely pay {formatMoney(result.totals.you_pay)}
      </p>
      <p className="text-muted">
        Your plan likely pays <span className="font-semibold text-savings">{formatMoney(result.totals.plan_pays)}</span>.
        Annual maximum left this plan year: {formatMoney(result.max_left.this_year)}.
      </p>
      <div className="flex flex-wrap items-start gap-2" aria-label="Terms used above">
        <JargonChip term="annual maximum" />
        <JargonChip term="plan year" />
      </div>
    </div>
  )
}

function LoadingCards({ count }: { count: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Working out your estimate">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-cream motion-reduce:animate-none" />
      ))}
    </div>
  )
}
