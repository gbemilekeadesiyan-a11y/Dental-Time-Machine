/**
 * Fixed wording and chart colors for the Summary step (feature/summary).
 * Calm and conditional (CLAUDE.md section 12). No dollar amounts here.
 */

import type { CashComparison } from '../../types'

export const SUMMARY_TITLE = 'Your summary'
export const SUMMARY_INTRO = 'Everything the estimate found, in one place.'

export const CASH_VERDICT: Record<CashComparison['cheaper'], string> = {
  insurance: 'For this care, using your plan likely costs less than paying cash.',
  cash: 'For this care, paying cash may cost less than using your plan. Ask your dentist whether they offer a self-pay price.',
  about_equal: 'For this care, paying cash and using your plan likely cost about the same.',
}

export const CASH_UNAVAILABLE = "A cash comparison isn't available for this estimate."

/**
 * Chart fills. Recharts draws SVG and takes colors as props, so these mirror the
 * index.css tokens: plan pays = savings green, you pay = primary blue.
 */
export const CHART_COLORS = {
  planPays: '#589c7d', // --color-savings
  youPay: '#3c4aa1', // --color-primary
  surface: '#ffffff', // --color-card: the 2px gap between stacked segments
  grid: '#dcdfe8', // --color-track
  axisText: '#666668', // --color-muted-text
} as const
