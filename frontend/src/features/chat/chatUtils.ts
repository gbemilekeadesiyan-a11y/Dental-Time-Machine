import type { Plan, Procedure } from '../../types'

/** The plan, or null while the form still has empty fields (the backend rejects NaN). */
export function completePlan(plan: Plan): Plan | null {
  const numbers = [
    plan.annual_max,
    plan.deductible,
    plan.used_this_year,
    plan.deductible_paid_this_year,
    plan.coverage.preventive,
    plan.coverage.basic,
    plan.coverage.major,
  ]
  return numbers.every(Number.isFinite) && /^\d{2}-\d{2}$/.test(plan.reset_date) ? plan : null
}

/** Procedure id to a readable name; repeated names get a number ("Crown 2"), like the backend. */
export function displayNames(procedures: Procedure[]): Map<string, string> {
  const totals = new Map<string, number>()
  for (const p of procedures) totals.set(p.name, (totals.get(p.name) ?? 0) + 1)
  const seen = new Map<string, number>()
  const names = new Map<string, string>()
  for (const p of procedures) {
    const n = (seen.get(p.name) ?? 0) + 1
    seen.set(p.name, n)
    names.set(p.id, (totals.get(p.name) ?? 0) > 1 ? `${p.name} ${n}` : p.name)
  }
  return names
}
