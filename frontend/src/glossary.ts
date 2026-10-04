/**
 * Fixed plain-language explanations for the MVP (CLAUDE.md section 4).
 *
 * Rules (CLAUDE.md sections 10 and 12):
 * - No dollar amounts or coverage percentages. Only the engine counts.
 * - Never claim everyone gets two annual maximums. Use the approved reset wording.
 * - Calm tone: "you'll likely pay", never "you owe".
 */

export const GLOSSARY_TERMS = ['deductible', 'coinsurance', 'annual maximum', 'plan year'] as const

export type GlossaryTerm = (typeof GLOSSARY_TERMS)[number]

export interface GlossaryEntry {
  term: string
  explanation: string
}

/** Approved wording from CLAUDE.md section 10. Reuse it, don't paraphrase it. */
export const RESET_WORDING =
  "When your plan year resets, eligible benefits may become available again, based on your plan's rules."

export const GLOSSARY = {
  deductible: {
    term: 'Deductible',
    explanation:
      'Your deductible is the part of the bill you pay yourself before your plan starts sharing the cost. ' +
      'Most plans charge it once per plan year, and many skip it for preventive care like cleanings.',
  },
  coinsurance: {
    term: 'Coinsurance',
    explanation:
      'Coinsurance is how you and your plan split the cost after the deductible. ' +
      "Your plan pays its share of the allowed fee, and you'll likely pay the part that's left.",
  },
  'annual maximum': {
    term: 'Annual maximum',
    explanation:
      'Your annual maximum is the most your plan will pay toward your care in one plan year. ' +
      `After that, you'll likely pay the rest. ${RESET_WORDING}`,
  },
  'plan year': {
    term: 'Plan year',
    explanation: `Your plan year is the twelve months your benefits run for. ${RESET_WORDING}`,
  },
} as const satisfies Record<GlossaryTerm, GlossaryEntry>
