import { LayoutGroup } from 'framer-motion'
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type RefObject } from 'react'
import { ApiError, calculate, isAbortError, optimize } from '../api'
import AnimatedMoney from '../components/AnimatedMoney'
import Disclaimer from '../components/Disclaimer'
import Notice from '../components/Notice'
import TimelineChip from '../components/TimelineChip'
import { NO_BETTER_TIMING, NOTHING_CAN_WAIT } from '../copy'
import { formatMoney, formatResetDate, listOfNames, procedureLabels } from '../format'
import { RESET_WORDING } from '../glossary'
import type { Action, AppState } from '../state'
import type { LineResult, OptimizeResult, Plan, Procedure, Result, Schedule, Year } from '../types'

interface Props {
  state: AppState
  dispatch: Dispatch<Action>
  onEditCare: () => void
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.'
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : FALLBACK_ERROR)

/**
 * Two futures: everything now versus the best allowed schedule (POST /optimize),
 * plus a timeline the user can rearrange, recalculated on every move (POST /calculate).
 * Every dollar amount comes from those two responses (CLAUDE.md section 2).
 */
export default function TwoFutures({ state, dispatch, onEditCare }: Props) {
  const { procedures, plan } = state

  if (procedures.length === 0) {
    return (
      <Screen>
        <Notice>
          Add your care first.{' '}
          <button type="button" onClick={onEditCare} className="font-medium text-maroon underline">
            Go to Tell us
          </button>
        </Notice>
      </Screen>
    )
  }

  return (
    <Screen>
      <Futures procedures={procedures} plan={plan} onEditCare={onEditCare} />
      <Timeline state={state} dispatch={dispatch} />
    </Screen>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="two-futures-title" className="space-y-8">
      <div className="space-y-2">
        <h2 id="two-futures-title" className="text-2xl font-semibold text-maroon">
          Two futures
        </h2>
        <p className="text-muted">See what changes if some of your care happens after your plan resets.</p>
      </div>
      {children}
      <Disclaimer />
    </section>
  )
}

// ---------- the two rows, from /optimize ----------

function Futures({ procedures, plan, onEditCare }: { procedures: Procedure[]; plan: Plan; onEditCare: () => void }) {
  const [answer, setAnswer] = useState<{
    procedures: Procedure[]
    plan: Plan
    outcome: { ok: true; result: OptimizeResult } | { ok: false; message: string }
  } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    optimize({ procedures, plan }, { signal: controller.signal })
      .then((result) => setAnswer({ procedures, plan, outcome: { ok: true, result } }))
      .catch((e: unknown) => {
        if (!isAbortError(e)) setAnswer({ procedures, plan, outcome: { ok: false, message: messageOf(e) } })
      })
    return () => controller.abort()
  }, [procedures, plan])

  const current = answer?.procedures === procedures && answer.plan === plan
  if (!current) return <div className="h-48 animate-pulse rounded-xl bg-cream motion-reduce:animate-none" role="status" aria-label="Comparing timings" />
  if (!answer.outcome.ok) {
    return (
      <Notice tone="problem">
        {answer.outcome.message}{' '}
        <button type="button" onClick={onEditCare} className="font-medium text-maroon underline">
          Check your details
        </button>
      </Notice>
    )
  }

  const { all_now, best, savings, moved } = answer.outcome.result
  const labels = procedureLabels(procedures)
  const anyCanWait = procedures.some((p) => p.can_wait)

  let sentence: string
  if (!anyCanWait) sentence = NOTHING_CAN_WAIT
  else if (moved.length === 0) sentence = NO_BETTER_TIMING
  else {
    const names = listOfNames(moved.map((id) => labels.get(id) ?? 'this procedure'))
    // Conditional on purpose (CLAUDE.md section 10): never "you should wait".
    sentence = `If your dentist confirms ${names} can wait, you'd pay ${formatMoney(best.totals.you_pay)}.`
  }

  return (
    <div className="space-y-3" aria-live="polite">
      <FutureRow title="Everything now" detail="All of your care in this plan year" youPay={all_now.totals.you_pay} />
      <FutureRow
        title="Best schedule"
        detail={moved.length > 0 ? `Moves ${moved.length} to next plan year` : 'Same timing as everything now'}
        youPay={best.totals.you_pay}
        savings={savings}
        highlight={savings > 0}
      />
      <p className="text-ink">{sentence}</p>
    </div>
  )
}

function FutureRow(props: { title: string; detail: string; youPay: number; savings?: number; highlight?: boolean }) {
  return (
    <div
      className={
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ' +
        (props.highlight ? 'border-savings/40 bg-savings-bg' : 'border-line bg-surface')
      }
    >
      <div>
        <h3 className="font-semibold text-ink">{props.title}</h3>
        <p className="text-sm text-muted">{props.detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-right">
          <span className="block text-xs text-muted">You&apos;ll likely pay</span>
          <AnimatedMoney value={props.youPay} className="text-3xl font-bold text-ink" />
        </p>
        {props.savings !== undefined && props.savings > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-savings px-3 py-1 text-sm font-semibold text-white">
            Saves <AnimatedMoney value={props.savings} />
          </span>
        )}
      </div>
    </div>
  )
}

// ---------- the timeline, recalculated on every move ----------

interface Calc {
  schedule: Schedule
  procedures: Procedure[]
  plan: Plan
  result: Result
}

function Timeline({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const { procedures, plan, schedule: committed } = state
  /** A move the engine hasn't accepted yet. Shown right away, undone on a 422. */
  const [pending, setPending] = useState<Schedule | null>(null)
  const [calc, setCalc] = useState<Calc | null>(null)
  /** The last rejection, tagged with the schedule it was for. Cleared by the next move. */
  const [moveError, setMoveError] = useState<{ schedule: Schedule; message: string } | null>(null)
  const [hoverYear, setHoverYear] = useState<Year | null>(null)
  const thisYearRef = useRef<HTMLDivElement>(null)
  const nextYearRef = useRef<HTMLDivElement>(null)

  const shown = pending ?? committed

  useEffect(() => {
    const controller = new AbortController()
    calculate({ procedures, plan, schedule: shown }, { signal: controller.signal })
      .then((result) => {
        setCalc({ schedule: shown, procedures, plan, result })
        dispatch({ type: 'set_schedule', schedule: shown }) // Accepted: keep it.
        setPending((p) => (p === shown ? null : p))
        // Snapping back recalculates the old schedule; keep the message the user needs to see.
        setMoveError((err) => (err?.schedule === shown ? null : err))
      })
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        setMoveError({ schedule: shown, message: messageOf(e) })
        setPending((p) => (p === shown ? null : p)) // Rejected: the chip snaps back.
      })
    return () => controller.abort()
  }, [procedures, plan, shown, dispatch])

  const updating = !(calc && calc.schedule === shown && calc.procedures === procedures && calc.plan === plan)
  const result = calc?.result
  const lines = new Map(result?.per_procedure.map((l) => [l.id, l]))
  const labels = procedureLabels(procedures)
  const yearOf = (id: string): Year => shown[id] ?? 'this_year'

  function move(id: string, to: Year) {
    const procedure = procedures.find((p) => p.id === id)
    if (!procedure?.can_wait || yearOf(id) === to) return
    const next: Schedule = { ...shown }
    if (to === 'next_year') next[id] = 'next_year'
    else delete next[id]
    setMoveError(null)
    setPending(next)
  }

  function yearAt(point: { x: number; y: number }): Year | null {
    const inside = (ref: RefObject<HTMLDivElement | null>) => {
      const r = ref.current?.getBoundingClientRect()
      return !!r && point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom
    }
    if (inside(thisYearRef)) return 'this_year'
    if (inside(nextYearRef)) return 'next_year'
    return null
  }

  const resetsOn = formatResetDate(plan.reset_date)

  const columnProps = {
    procedures,
    yearOf,
    labels,
    lines,
    hoverYear,
    onMove: move,
    onDragAt: (point: { x: number; y: number } | null) => setHoverYear(point ? yearAt(point) : null),
    onDrop: (id: string, point: { x: number; y: number }) => {
      const to = yearAt(point)
      if (to) move(id, to)
    },
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-ink">Try a different timing</h3>
        <p className="text-sm text-muted">
          Drag care that can wait across the wall, or use its button. Locked care stays where it is.
        </p>
      </div>

      <div className="rounded-xl bg-cream p-4" aria-live="polite" aria-busy={updating}>
        <p className="text-lg text-ink">
          With this timing, you&apos;ll likely pay{' '}
          {result ? <AnimatedMoney value={result.totals.you_pay} className="text-2xl font-bold" /> : '…'}
        </p>
        {updating && <span className="sr-only">Updating</span>}
      </div>

      {moveError && <Notice tone="problem">{moveError.message}</Notice>}

      <LayoutGroup>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
          <YearColumn ref={thisYearRef} year="this_year" title="This plan year" maxLeft={result?.max_left.this_year} {...columnProps} />
          <ResetWall resetsOn={resetsOn} />
          <YearColumn ref={nextYearRef} year="next_year" title="Next plan year" maxLeft={result?.max_left.next_year} {...columnProps} />
        </div>
      </LayoutGroup>

      <p className="text-sm text-muted">{RESET_WORDING}</p>
    </div>
  )
}

interface YearColumnProps {
  ref: RefObject<HTMLDivElement | null>
  year: Year
  title: string
  maxLeft: number | undefined
  procedures: Procedure[]
  yearOf: (id: string) => Year
  labels: Map<string, string>
  lines: Map<string, LineResult>
  hoverYear: Year | null
  onMove: (id: string, to: Year) => void
  onDragAt: (point: { x: number; y: number } | null) => void
  onDrop: (id: string, point: { x: number; y: number }) => void
}

/** One side of the wall. Highlights while a chip is dragged over it. */
function YearColumn({ ref, year, title, maxLeft, procedures, yearOf, labels, lines, hoverYear, ...handlers }: YearColumnProps) {
  const here = procedures.filter((p) => yearOf(p.id) === year)
  return (
    <div
      ref={ref}
      className={
        'min-h-40 space-y-3 rounded-xl border-2 border-dashed p-3 transition-colors ' +
        (hoverYear === year ? 'border-maroon bg-cream' : 'border-transparent')
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-semibold text-ink">{title}</h4>
        {maxLeft !== undefined && (
          <p className="text-xs text-muted">
            Annual maximum left: <AnimatedMoney value={maxLeft} />
          </p>
        )}
      </div>
      <ul className="space-y-3" aria-label={title}>
        {here.map((p) => (
          <TimelineChip
            key={p.id}
            id={p.id}
            label={labels.get(p.id) ?? p.name}
            year={year}
            canMove={p.can_wait}
            youPay={lines.get(p.id)?.you_pay}
            note={p.depends_on ? `Comes after ${listOfNames([labels.get(p.depends_on) ?? 'another procedure'])}` : undefined}
            {...handlers}
          />
        ))}
      </ul>
      {here.length === 0 && <p className="text-sm text-muted">Nothing scheduled here yet.</p>}
    </div>
  )
}

/** The line between plan years: horizontal on phones, vertical on wider screens. */
function ResetWall({ resetsOn }: { resetsOn: string | null }) {
  const label = resetsOn ? `Plan resets ${resetsOn}` : 'Plan resets'
  return (
    <div className="relative flex items-center justify-center py-2 md:px-1 md:py-0" role="separator" aria-label={label}>
      <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-orange md:inset-x-auto md:inset-y-0 md:left-1/2 md:top-0 md:border-t-0 md:border-l-2" />
      <span aria-hidden="true" className="relative rounded-full bg-orange px-3 py-1 text-xs font-semibold whitespace-nowrap text-white md:[writing-mode:vertical-rl] md:px-1 md:py-3">
        {label}
      </span>
    </div>
  )
}
