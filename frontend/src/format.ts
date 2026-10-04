/**
 * Display formatting only. Never computes a dollar amount (CLAUDE.md section 2):
 * every amount passed in here comes from an API response or the user's own input.
 */

const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const withCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** $1,975 for whole dollars, $12.50 otherwise. */
export function formatMoney(amount: number): string {
  return Number.isInteger(amount) ? wholeDollars.format(amount) : withCents.format(amount)
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "01-01" to "January 1". Returns null when the date isn't in MM-DD form. */
export function formatResetDate(mmdd: string): string | null {
  const match = /^(\d{2})-(\d{2})$/.exec(mmdd)
  if (!match) return null
  const month = MONTHS[Number(match[1]) - 1]
  const day = Number(match[2])
  return month && day >= 1 && day <= 31 ? `${month} ${day}` : null
}

/**
 * Display names that tell repeated procedures apart: "Crown 1", "Crown 2".
 * Unique names stay as they are.
 */
export function procedureLabels(procedures: { id: string; name: string }[]): Map<string, string> {
  const totals = new Map<string, number>()
  for (const p of procedures) totals.set(p.name, (totals.get(p.name) ?? 0) + 1)
  const seen = new Map<string, number>()
  const labels = new Map<string, string>()
  for (const p of procedures) {
    const n = (seen.get(p.name) ?? 0) + 1
    seen.set(p.name, n)
    labels.set(p.id, (totals.get(p.name) ?? 0) > 1 ? `${p.name} ${n}` : p.name)
  }
  return labels
}

/**
 * "the root canal", "crown 2", "the root canal and crown 2".
 * Numbered labels read better without "the".
 */
export function listOfNames(names: string[]): string {
  const items = names.map((n) => (/\d$/.test(n) ? n.toLowerCase() : `the ${n.toLowerCase()}`))
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
