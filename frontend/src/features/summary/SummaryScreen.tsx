import { useEffect, useState, type ReactNode } from 'react'
import { ApiError, calculate, isAbortError, optimize } from '../../api'
import Disclaimer from '../../components/Disclaimer'
import Notice from '../../components/Notice'
import StepShell from '../../components/StepShell'
import type { AppState } from '../../state'
import type { OptimizeResult, Result } from '../../types'
import CashVsInsurance from './CashVsInsurance'
import MaxUsage from './MaxUsage'
import ProcedureBreakdownChart from './ProcedureBreakdownChart'
import AnimatedMoney from '../../components/AnimatedMoney'
import { SUMMARY_INTRO, SUMMARY_TITLE, TAB_LABELS, type SummaryTab } from './summaryCopy'
import SummaryTabs from './SummaryTabs'
import TotalsCard from './TotalsCard'

interface Props {
  state: AppState
  onEditCare: () => void
  /** Mount point (feature/chat): the chatbot recap, in the left column beside the tabs. */
  recap?: ReactNode
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
export default function SummaryScreen({ state, onEditCare, recap }: Props) {
  const { procedures, plan, schedule } = state
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [tab, setTab] = useState<SummaryTab>('overview')

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
  let intro: ReactNode = SUMMARY_INTRO
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
    // The short version: the one line to read if you read nothing else. Stays above every tab.
    intro = (
      <span aria-live="polite">
        You&apos;ll likely pay <AnimatedMoney value={chosen.totals.you_pay} className="font-semibold text-ink" /> with the
        timing you chose. Your plan likely pays{' '}
        <AnimatedMoney value={chosen.totals.plan_pays} className="font-semibold text-savings-deep" />.
      </span>
    )
    body = (
      <SummaryTabs
        label="Summary sections"
        current={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'overview',
            label: TAB_LABELS.overview,
            panel: (
              <div className="space-y-6">
                <TotalsCard result={chosen} optimized={best} procedures={procedures} />
                <MaxUsage result={chosen} plan={plan} />
              </div>
            ),
          },
          {
            id: 'procedures',
            label: TAB_LABELS.procedures,
            panel: <ProcedureBreakdownChart result={chosen} procedures={procedures} />,
          },
          {
            id: 'cash',
            label: TAB_LABELS.cash,
            panel: <CashVsInsurance comparison={chosen.cash_comparison ?? null} />,
          },
        ]}
      />
    )
  }

  return (
    <StepShell titleId="summary-title" title={SUMMARY_TITLE} intro={intro} aside={recap} after={<Disclaimer />}>
      {body}
    </StepShell>
  )
}
