import { useEffect, useState, type ReactNode } from 'react'
import { ApiError, calculate, isAbortError, optimize } from '../../api'
import Disclaimer from '../../components/Disclaimer'
import Notice from '../../components/Notice'
import type { AppState } from '../../state'
import type { OptimizeResult, Result } from '../../types'
import CashVsInsurance from './CashVsInsurance'
import MaxUsage from './MaxUsage'
import ProcedureBreakdownChart from './ProcedureBreakdownChart'
import { SUMMARY_INTRO, SUMMARY_TITLE } from './summaryCopy'
import TotalsCard from './TotalsCard'

interface Props {
  state: AppState
  onEditCare: () => void
}

type Inputs = Pick<AppState, 'procedures' | 'plan' | 'schedule'>
interface Answer {
  inputs: Inputs
  outcome: { ok: true; chosen: Result; best: OptimizeResult } | { ok: false; message: string }
}

/**
 * The Summary step: totals, plan vs you, annual maximum used and left, savings,
 * a per-procedure breakdown, and cash vs insurance.
 *
 * Two engine calls: POST /calculate for the timing chosen on Two futures, and
 * POST /optimize for the best timing and its savings. Every dollar amount shown
 * comes from those responses (CLAUDE.md section 2).
 */
export default function SummaryScreen({ state, onEditCare }: Props) {
  const { procedures, plan, schedule } = state
  const [answer, setAnswer] = useState<Answer | null>(null)

  useEffect(() => {
    if (procedures.length === 0) return
    const inputs = { procedures, plan, schedule }
    const controller = new AbortController()
    const options = { signal: controller.signal }
    Promise.all([calculate(inputs, options), optimize({ procedures, plan }, options)])
      .then(([chosen, best]) => setAnswer({ inputs, outcome: { ok: true, chosen, best } }))
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
        setAnswer({ inputs, outcome: { ok: false, message } })
      })
    return () => controller.abort()
  }, [procedures, plan, schedule])

  const current =
    answer?.inputs.procedures === procedures && answer.inputs.plan === plan && answer.inputs.schedule === schedule

  let body: ReactNode
  if (procedures.length === 0) {
    body = (
      <Notice>
        Add your care first.{' '}
        <button type="button" onClick={onEditCare} className="font-medium text-primary underline underline-offset-2">
          Go to Tell us
        </button>
      </Notice>
    )
  } else if (!current) {
    body = <div className="glass h-96 animate-pulse rounded-3xl motion-reduce:animate-none" role="status" aria-label="Building your summary" />
  } else if (!answer.outcome.ok) {
    body = (
      <Notice tone="problem">
        {answer.outcome.message}{' '}
        <button type="button" onClick={onEditCare} className="font-medium text-primary underline underline-offset-2">
          Check your details
        </button>
      </Notice>
    )
  } else {
    const { chosen, best } = answer.outcome
    body = (
      <div className="space-y-6" aria-live="polite">
        <TotalsCard result={chosen} optimized={best} procedures={procedures} />
        <MaxUsage result={chosen} plan={plan} />
        <ProcedureBreakdownChart result={chosen} procedures={procedures} />
        <CashVsInsurance comparison={chosen.cash_comparison ?? null} />
      </div>
    )
  }

  return (
    <section aria-labelledby="summary-title" className="space-y-6">
      <div className="space-y-2">
        <h2 id="summary-title" className="text-4xl font-light tracking-tight text-ink sm:text-5xl">
          {SUMMARY_TITLE}
        </h2>
        <p className="text-ink/80">{SUMMARY_INTRO}</p>
      </div>
      {body}
      <Disclaimer />
    </section>
  )
}
