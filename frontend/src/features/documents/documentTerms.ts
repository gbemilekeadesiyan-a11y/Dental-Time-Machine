import type { DocumentReadResult } from '../../types'

/** Most cards we show, so the reveal stays readable. */
const MAX_CARDS = 8

/** Terms implied by what the reader found, for when the AI lists few or none. */
const FIELD_TERMS: { field: string; term: string }[] = [
  { field: 'deductible', term: 'Deductible' },
  { field: 'coverage.basic', term: 'Coinsurance' },
  { field: 'annual_max', term: 'Annual maximum' },
  { field: 'reset_date', term: 'Plan year' },
  { field: 'in_network', term: 'In-network' },
]

/** Words that don't change which term a card is about ("Annual benefit maximum" = "Maximum"). */
const FILLER = new Set(['annual', 'benefit', 'benefits', 'provision', 'provisions', 'individual', 'your', 'the', 'plan'])

/** "Annual benefit maximum" and "Annual maximum" -> "maximum"; "Waiting periods" -> "waiting period". */
function termKey(term: string): string {
  const words = term
    .toLowerCase()
    .split(/[\s-]+/)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
  const core = words.filter((w) => !FILLER.has(w))
  return (core.length > 0 ? core : words).join(' ')
}

/**
 * The cards for the reveal: terms the AI spotted in the document first, then
 * terms implied by the fields it read. Near-duplicates ("Annual deductible" and
 * "Deductible", "Annual benefit maximum" and "Annual maximum") share one card.
 */
export function revealTerms(result: DocumentReadResult): string[] {
  const terms: string[] = []
  const keys: string[] = []
  const add = (term: string) => {
    const key = termKey(term)
    if (keys.some((k) => k === key || k.includes(key) || key.includes(k))) return
    keys.push(key)
    terms.push(term)
  }
  for (const term of result.terms_found ?? []) add(term)
  for (const { field, term } of FIELD_TERMS) {
    if (result.fields_found.includes(field)) add(term)
  }
  return terms.slice(0, MAX_CARDS)
}
