/**
 * Shapes for the filters feature. Mirrors backend/app/routers/filter_models.py.
 *
 * Kept here, not in types.ts (core team only). Names reuse the section 6 FilterState
 * names where they overlap; the rest are filter additions to request from Samuel.
 */

import type { AgeRange, DentistListing } from '../../types'

export type Payment = 'insurance' | 'self_pay'
export type PlanChoice = 'my_plan' | 'demo_plan'
/** Catalog CDT codes (sourced fees) plus checkups, which have no sourced fee yet. */
export type Service = 'checkup' | 'D2391' | 'D3330' | 'D2740'
export type Specialty =
  | 'any'
  | 'general'
  | 'pediatric'
  | 'endodontics'
  | 'periodontics'
  | 'orthodontics'
  | 'oral_surgery'
  | 'prosthodontics'
export type Availability = 'any' | 'today' | 'tomorrow' | 'this_week' | 'two_weeks'
export type SortOrder = 'distance' | 'earliest'
export type FilterLanguage = 'English' | 'Spanish' | 'French' | 'Portuguese' | 'Vietnamese' | 'Chinese'

/** The one filter state. The form and the assistant both read and write this. */
export interface Filters {
  /** Five digits, or empty until the user enters one. */
  zip: string
  /** 1 to 100. */
  max_distance_miles: number
  /** The user's own cap on this year's cost, or null for no budget. */
  budget_this_year: number | null
  payment: Payment
  preferred_plan_id: PlanChoice
  in_network_only: boolean
  service: Service | null
  specialty: Specialty
  dentist_name: string
  age_range: AgeRange | null
  availability: Availability
  sort: SortOrder
  accepting_new_only: boolean
  languages: FilterLanguage[]
  no_referral_only: boolean
}

/** Only the filters a message changed. A missing key means "keep it". */
export type FilterChanges = Partial<Filters>

export interface FilterParseRequest {
  /** 1 to 2,000 characters. */
  text: string
}

export interface FilterParseResponse {
  changes: FilterChanges
  /** Clear every filter before applying changes. */
  reset: boolean
  /** A fixed sentence (safety reply or "didn't catch a filter"). */
  note: string | null
  /** "ai" when Bedrock read the message, "rules" when the fallback did. */
  source: 'ai' | 'rules'
}

/**
 * Real (NPI Registry): npi, name, address, specialty. Approximate: distance_miles.
 * Demo data: in_network, languages, accepting_new, next_available, no_referral_required.
 */
export interface DentistResult extends DentistListing {
  specialty: Exclude<Specialty, 'any'>
  specialty_label: string
  /** ISO date, for example "2026-10-05". Demo. */
  next_available: string
  no_referral_required: boolean
}

export interface DentistSearchResponse {
  dentists: DentistResult[]
  source: 'npi' | 'unavailable'
  note: string | null
}
