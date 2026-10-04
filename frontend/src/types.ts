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
}

export interface OptimizeResult {
  all_now: Result
  best: Result
  best_schedule: Schedule
  savings: number
  /** Procedure ids moved to next year in the best schedule. */
  moved: string[]
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
