/**
 * Fixed user-facing wording, kept in one place for review against CLAUDE.md section 10.
 * Calm tone: "you'll likely pay", never "you owe". No dollar amounts here.
 */

import type { GlossaryTerm } from './glossary'
import type { Category, Reason } from './types'

/** Shown on every result screen (CLAUDE.md section 10). Exact wording. */
export const DISCLAIMER = 'Estimate, not medical or coverage advice. Confirm with your dentist and plan.'

/** The only way a procedure gets unlocked (CLAUDE.md section 10). Exact wording. */
export const CAN_WAIT_LABEL = 'My dentist said this can wait'

export const CAN_WAIT_HELP = 'Only check this if your dentist told you. We never decide whether care can wait.'

export const DEMO_PLAN_LABEL = 'Demo plan'

export const CATEGORY_LABELS: Record<Category, string> = {
  preventive: 'Preventive',
  basic: 'Basic',
  major: 'Major',
}

/** Which glossary term explains each reason the engine gives. */
export const REASON_TERMS: Record<Reason, GlossaryTerm | null> = {
  deductible: 'deductible',
  coinsurance: 'coinsurance',
  over_annual_max: 'annual maximum',
  not_covered: null,
  balance_bill: null,
}

/** Plain sentences for reasons the glossary doesn't cover yet. */
export const REASON_NOTES: Partial<Record<Reason, string>> = {
  not_covered: "Your plan doesn't cover this kind of care.",
  balance_bill: "Your dentist charges more than your plan allows, and you'll likely pay the difference.",
}

export const MOVE_TO_NEXT_YEAR = 'Move to next year'
export const MOVE_TO_THIS_YEAR = 'Move to this year'
export const LOCKED_LABEL = 'Locked'
export const LOCKED_HELP = "Your dentist hasn't confirmed this can wait. You can change that on Tell us."
export const NOTHING_CAN_WAIT =
  'Nothing is marked as able to wait yet. If your dentist says something can wait, tick it on Tell us to compare timings.'
export const NO_BETTER_TIMING =
  "With what your dentist has confirmed so far, moving care to next year wouldn't lower what you'll likely pay."
