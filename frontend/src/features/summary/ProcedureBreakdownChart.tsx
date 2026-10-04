import { useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney, procedureLabels } from '../../format'
import type { LineResult, Procedure, Result, Year } from '../../types'
import { CHART_COLORS } from './summaryCopy'

interface Props {
  result: Result
  procedures: Procedure[]
}

interface Row {
  label: string
  year: Year
  plan_pays: number
  you_pay: number
}

const YEAR_LABELS: Record<Year, string> = { this_year: 'This plan year', next_year: 'Next plan year' }
const ROW_HEIGHT = 44
const BAR_SIZE = 20

/** Per procedure: what the plan likely pays and what you'll likely pay, straight from the engine's LineResults. */
export default function ProcedureBreakdownChart({ result, procedures }: Props) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const animate = !useReducedMotion()
  const labels = procedureLabels(procedures)
  const lines = new Map<string, LineResult>(result.per_procedure.map((l) => [l.id, l]))
  const rows: Row[] = procedures.flatMap((p) => {
    const line = lines.get(p.id)
    return line ? [{ label: labels.get(p.id) ?? p.name, year: line.year, plan_pays: line.plan_pays, you_pay: line.you_pay }] : []
  })

  return (
    <article className="glass space-y-4 rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-tight text-ink">Each procedure</h3>
          <p className="text-sm text-muted-text">What your plan likely pays and what you&apos;ll likely pay, per procedure.</p>
        </div>
        <button
          type="button"
          onClick={() => setView((v) => (v === 'chart' ? 'table' : 'chart'))}
          className="btn-secondary min-h-9 px-4 py-1.5 text-sm"
        >
          {view === 'chart' ? 'Show as a table' : 'Show as a chart'}
        </button>
      </div>

      {view === 'chart' ? (
        <>
          <Legend />
          <div aria-hidden="true" className="w-full" data-testid="breakdown-chart">
            <ResponsiveContainer width="100%" height={rows.length * ROW_HEIGHT + 32}>
              <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barSize={BAR_SIZE}>
                <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => formatMoney(v)}
                  tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={96}
                  tick={{ fill: CHART_COLORS.axisText, fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: 'rgb(60 74 161 / 0.06)' }} content={<RowTooltip />} />
                <Bar dataKey="plan_pays" name="Plan likely pays" stackId="cost" isAnimationActive={animate} fill={CHART_COLORS.planPays} stroke={CHART_COLORS.surface} strokeWidth={2} />
                <Bar dataKey="you_pay" name="You'll likely pay" stackId="cost" isAnimationActive={animate} fill={CHART_COLORS.youPay} stroke={CHART_COLORS.surface} strokeWidth={2} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Screen readers get the same numbers as a table; the chart above is visual only. */}
          <BreakdownTable rows={rows} className="sr-only" />
        </>
      ) : (
        <BreakdownTable rows={rows} />
      )}
    </article>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-text" aria-hidden="true">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-savings" /> Plan likely pays
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-primary" /> You&apos;ll likely pay
      </span>
    </div>
  )
}

interface TooltipProps {
  active?: boolean
  payload?: { payload: Row }[]
}

function RowTooltip({ active, payload }: TooltipProps) {
  const row = active ? payload?.[0]?.payload : undefined
  if (!row) return null
  return (
    <div className="rounded-xl bg-card p-3 text-sm text-ink shadow-lg ring-1 ring-ink/10">
      <p className="font-semibold">{row.label}</p>
      <p className="mb-1 text-muted-text">{YEAR_LABELS[row.year]}</p>
      <p className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-sm bg-savings" /> Plan likely pays {formatMoney(row.plan_pays)}
      </p>
      <p className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" /> You&apos;ll likely pay {formatMoney(row.you_pay)}
      </p>
    </div>
  )
}

function BreakdownTable({ rows, className = '' }: { rows: Row[]; className?: string }) {
  return (
    <div className={'overflow-x-auto ' + className}>
      <table className="w-full text-left text-sm text-ink">
        <caption className="sr-only">Each procedure: what your plan likely pays and what you&apos;ll likely pay</caption>
        <thead className="text-muted-text">
          <tr className="border-b border-ink/10">
            <th scope="col" className="py-2 pr-3 font-medium">Procedure</th>
            <th scope="col" className="py-2 pr-3 font-medium">Plan year</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Plan likely pays</th>
            <th scope="col" className="py-2 text-right font-medium">You&apos;ll likely pay</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-ink/5 last:border-0">
              <th scope="row" className="py-2 pr-3 font-medium">{r.label}</th>
              <td className="py-2 pr-3 text-muted-text">{YEAR_LABELS[r.year]}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-savings-deep">{formatMoney(r.plan_pays)}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(r.you_pay)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
