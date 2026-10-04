import type { Plan } from '../../types'

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
