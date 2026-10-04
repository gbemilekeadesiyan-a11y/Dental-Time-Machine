/**
 * Data shapes. Mirrors backend/app/models.py exactly (CLAUDE.md section 6).
 *
 * snake_case on purpose: these are the JSON field names on the wire.
 * Frozen at 7pm Sat: after that, only ADD optional fields. Never rename or remove.
 * Every field is required here, so the frontend always sends complete data.
 */

export type Category = 'preventive' | 'basic' | 'major'
export type Year = 'this_year' | 'next_year'
export type Reason = 'deductible' | 'coinsurance' | 'over_annual_max' | 'not_covered' | 'balance_bill'

// ---------- inputs ----------

/** One procedure the dentist recommended. */
export interface Procedure {
  /** Letters, numbers, dashes and underscores, 1 to 64 characters. crypto.randomUUID() fits. */
  id: string
  name: string
  cdt_code: string
  category: Category
  /** 1 to 32, or null when unknown. */
  tooth: number | null
  /** 0 to 50,000. */
  billed_fee: number
  /** 0 to 50,000. Equals billed_fee in the MVP. */
  allowed_fee: number
  /** Id of the procedure this one must not come before, or null. */
  depends_on: string | null
  /** False until the user confirms "My dentist said this can wait." */
  can_wait: boolean
  /** Feature addition. Self-pay price if the dentist offers one; otherwise cash = billed_fee. 0 to 50,000. */
  cash_price?: number | null
}

/** Share of the allowed fee the plan pays, per category. Each is 0 to 1. */
export interface Coverage {
  preventive: number
  basic: number
  major: number
}

/** The user's dental plan details. */
export interface Plan {
  annual_max: number
  deductible: number
  /** Default ["preventive"]. At most 3, no repeats. */
  deductible_waived_for: Category[]
  coverage: Coverage
  /** "MM-DD" */
  reset_date: string
  used_this_year: number
  deductible_paid_this_year: number
  in_network: boolean
  /** Feature addition. Needed for a fair cash vs insurance comparison. 0 to 50,000. */
  annual_premium?: number | null
}

/** Procedure id to the plan year it is scheduled in. */
export type Schedule = Record<string, Year>

// ---------- engine results ----------

/** The engine's answer for one procedure. */
export interface LineResult {
  id: string
  year: Year
  billed_fee: number
  allowed_fee: number
  deductible_applied: number
  plan_pays: number
  you_pay: number
  reasons: Reason[]
}

export interface Totals {
  plan_pays: number
  you_pay: number
}

/** Annual maximum remaining in each plan year after this schedule. */
export interface MaxLeft {
  this_year: number
  next_year: number
}

export interface Result {
  per_procedure: LineResult[]
  totals: Totals
  max_left: MaxLeft
  warnings: string[]
  /** Feature addition. Computed by the engine (not built yet, so absent for now). */
  cash_comparison?: CashComparison | null
}

export interface OptimizeResult {
  all_now: Result
  best: Result
  best_schedule: Schedule
  savings: number
  /** Procedure ids moved to next year in the best schedule. */
  moved: string[]
  /** Feature addition. Up to 5 valid schedules (not built yet, so absent for now). */
  alternatives?: Alternative[] | null
}

export interface CatalogItem {
  cdt_code: string
  name: string
  category: Category
  default_fee: number
}

// ---------- request and response bodies (CLAUDE.md section 7) ----------

export interface DemoResponse {
  procedures: Procedure[]
  plan: Plan
}

export interface CalculateRequest {
  procedures: Procedure[]
  plan: Plan
  schedule: Schedule
}

export interface OptimizeRequest {
  procedures: Procedure[]
  plan: Plan
  /** Feature addition. Cap on this year's you_pay. Accepted, not applied yet. 0 to 50,000. */
  budget_this_year?: number | null
}

export interface ParseRequest {
  /** 1 to 2,000 characters. */
  text: string
}

export interface ExplainRequest {
  /** 1 to 200 characters. */
  term: string
  language: string
  style: string
}

export interface ExplainResponse {
  text: string
}

/** Every error response body: one plain-English sentence. */
export interface ErrorResponse {
  detail: string
}

// ---------- feature additions (CLAUDE.md section 6). Shapes only: no engine logic yet ----------

export type Language = 'en' | 'es' | 'fr' | 'pt'
export type Style = 'simple' | 'detailed' | 'numbers'
export type AgeRange = 'under_18' | '18_64' | '65_plus'

/** Feature addition. Cash vs insurance for the same care, computed by the engine. */
export interface CashComparison {
  cash_total: number
  insurance_you_pay: number
  premiums_in_period: number | null
  cheaper: 'cash' | 'insurance' | 'about_equal'
  assumptions: string[]
}

/** One valid schedule from the optimizer, for the timeline permutations. */
export interface Alternative {
  schedule: Schedule
  you_pay: number
  moved: string[]
}

/** Session only. Never stored. */
export interface Preferences {
  language: Language
  style: Style
  voice_on: boolean
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  /** 1 to 2,000 characters. */
  text: string
}

export interface ChatRequest {
  /** At most 20 turns. */
  turns: ChatTurn[]
  preferences: Preferences
  /** At most 20. */
  procedures: Procedure[]
  plan: Plan | null
}

export interface ChatResponse {
  /** Checked by the dollar guard. */
  say: string
  /** Needs the user's confirmation before use. */
  proposed_procedures: Procedure[]
  /** Needs an explicit "yes" from the user before any procedure is unlocked. */
  proposed_can_wait: string[]
  done_intake: boolean
}

export interface SummaryRequest {
  procedures: Procedure[]
  plan: Plan
  schedule: Schedule
  optimize: OptimizeResult
  preferences: Preferences
}

export interface SummaryResponse {
  /** Checked by the dollar guard. */
  text: string
}

/** Always shown on a confirm form, never applied directly. */
export interface DocumentReadResult {
  plan: Plan | null
  procedures: Procedure[]
  fields_found: string[]
  warnings: string[]
  /** Feature addition. Confusing terms printed in the document, at most 8, letters only. */
  terms_found?: string[]
}

export interface FilterState {
  /** Five digits, for example "27401". */
  zip: string
  age_range: AgeRange
  /** More than 0, at most 500. */
  max_distance_miles: number
  in_network_only: boolean
  preferred_plan_id: string
  /** At most 10, each up to 40 characters. */
  languages: string[]
  /** 0 to 50,000. */
  budget_this_year: number
}

export interface PlanOption {
  id: string
  name: string
  /** 0 to 50,000. */
  monthly_premium: number
  plan: Plan
  source: 'demo' | 'user'
}

/** in_network, languages and accepting_new are demo data. */
export interface DentistListing {
  /** Ten digits. */
  npi: string
  name: string
  address: string
  distance_miles: number
  in_network: boolean
  languages: string[]
  accepting_new: boolean
}
