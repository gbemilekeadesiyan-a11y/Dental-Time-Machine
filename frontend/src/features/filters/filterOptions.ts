/**
 * Defaults, labels and dentist matching for the filters feature.
 * No dollar math here: budgets are the user's own numbers, estimates come from /calculate.
 */

import { formatMoney } from '../../format'
import type { AgeRange } from '../../types'
import type { Availability, DentistResult, FilterLanguage, Filters, Payment, Service, SortOrder, Specialty } from './types'

export const MIN_MILES = 1
export const MAX_MILES = 100

export const DEFAULT_FILTERS: Filters = {
  zip: '',
  max_distance_miles: 10,
  budget_this_year: null,
  payment: 'insurance',
  preferred_plan_id: 'my_plan',
  in_network_only: false,
  service: null,
  specialty: 'any',
  dentist_name: '',
  age_range: null,
  availability: 'any',
  sort: 'distance',
  accepting_new_only: false,
  languages: [],
  no_referral_only: false,
}

export const FILTER_LABELS: Record<keyof Filters, string> = {
  zip: 'ZIP code',
  max_distance_miles: 'Distance',
  budget_this_year: 'Budget',
  payment: 'Paying with',
  preferred_plan_id: 'Insurance plan',
  in_network_only: 'Network',
  service: 'Service',
  specialty: 'Specialty',
  dentist_name: 'Dentist',
  age_range: 'Age',
  availability: 'Availability',
  sort: 'Sort',
  accepting_new_only: 'New patients',
  languages: 'Language',
  no_referral_only: 'Referral',
}

export const PAYMENT_LABELS: Record<Payment, string> = { insurance: 'Insurance', self_pay: 'Self-pay' }

export const PLAN_LABELS: Record<Filters['preferred_plan_id'], string> = {
  my_plan: 'My plan (from Tell us)',
  demo_plan: "Maya's demo plan",
}

export const SERVICE_LABELS: Record<Service, string> = {
  checkup: 'Cleaning or checkup',
  D2391: 'Filling',
  D3330: 'Root canal',
  D2740: 'Crown',
}

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  any: 'Any dentist',
  general: 'General dentist',
  pediatric: 'Pediatric dentist',
  endodontics: 'Endodontist (root canals)',
  periodontics: 'Periodontist (gums)',
  orthodontics: 'Orthodontist (braces)',
  oral_surgery: 'Oral surgeon',
  prosthodontics: 'Prosthodontist (crowns, dentures)',
}

export const AGE_LABELS: Record<AgeRange, string> = { under_18: 'Under 18', '18_64': '18 to 64', '65_plus': '65 or older' }

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  any: 'Any time',
  today: 'Today',
  tomorrow: 'By tomorrow',
  this_week: 'Next 7 days',
  two_weeks: 'Next 2 weeks',
}

/** Days from today an opening can be, per availability choice. */
const AVAILABILITY_DAYS: Record<Exclude<Availability, 'any'>, number> = {
  today: 0,
  tomorrow: 1,
  this_week: 7,
  two_weeks: 14,
}

export const SORT_LABELS: Record<SortOrder, string> = { distance: 'Closest first', earliest: 'Earliest available' }

export const LANGUAGES: FilterLanguage[] = ['English', 'Spanish', 'French', 'Portuguese', 'Vietnamese', 'Chinese']

/** Who usually does each service. General dentists do all of these. */
const SERVICE_SPECIALTIES: Record<Service, Specialty[]> = {
  checkup: ['general', 'pediatric', 'periodontics'],
  D2391: ['general', 'pediatric'],
  D3330: ['general', 'endodontics'],
  D2740: ['general', 'prosthodontics'],
}

/** A short, readable value for a filter, used in chips and assistant replies. */
export function describeValue<K extends keyof Filters>(key: K, value: Filters[K]): string {
  const v = value as Filters[keyof Filters]
  switch (key) {
    case 'zip':
      return String(v)
    case 'max_distance_miles':
      return `${v} ${v === 1 ? 'mile' : 'miles'}`
    case 'budget_this_year':
      return v === null ? 'No budget' : `Under ${formatMoney(v as number)}`
    case 'payment':
      return PAYMENT_LABELS[v as Payment]
    case 'preferred_plan_id':
      return PLAN_LABELS[v as Filters['preferred_plan_id']]
    case 'in_network_only':
      return v ? 'In-network only' : 'Any network'
    case 'service':
      return v === null ? 'Any service' : SERVICE_LABELS[v as Service]
    case 'specialty':
      return SPECIALTY_LABELS[v as Specialty]
    case 'dentist_name':
      return v ? `"${v}"` : 'Any name'
    case 'age_range':
      return v === null ? 'Not set' : AGE_LABELS[v as AgeRange]
    case 'availability':
      return AVAILABILITY_LABELS[v as Availability]
    case 'sort':
      return SORT_LABELS[v as SortOrder]
    case 'accepting_new_only':
      return v ? 'Accepting new patients' : 'Any'
    case 'languages':
      return (v as FilterLanguage[]).length ? (v as FilterLanguage[]).join(' or ') : 'Any language'
    case 'no_referral_only':
      return v ? 'No referral needed' : 'Any'
    default:
      return String(v)
  }
}

/** Filters that differ from the defaults, for the chip row. */
export function activeKeys(filters: Filters): (keyof Filters)[] {
  return (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).filter(
    (key) => JSON.stringify(filters[key]) !== JSON.stringify(DEFAULT_FILTERS[key]),
  )
}

/** Whole days from today (local time) to an ISO date. */
export function daysFromToday(iso: string, today = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
  return Math.round((target.getTime() - start.getTime()) / 86_400_000)
}

/**
 * How far to search for a distance setting. Wider than the setting, so dentists just past it
 * can still be listed below the nearby ones instead of disappearing.
 */
export function searchRadius(miles: number): number {
  return Math.min(MAX_SEARCH_MILES, Math.max(FARTHER_MIN_MILES, miles * 2))
}
const MAX_SEARCH_MILES = 100 // The /dentists limit.
const FARTHER_MIN_MILES = 25

export function isNearby(d: DentistResult, f: Filters): boolean {
  return d.distance_miles <= f.max_distance_miles
}

/** Every filter except distance: distance only orders the list (see matchAndSort). */
export function matchesDentist(d: DentistResult, f: Filters, today = new Date()): boolean {
  if (f.in_network_only && f.payment === 'insurance' && !d.in_network) return false
  if (f.accepting_new_only && !d.accepting_new) return false
  if (f.no_referral_only && !d.no_referral_required) return false
  if (f.languages.length && !f.languages.some((lang) => d.languages.includes(lang))) return false
  if (f.specialty !== 'any' && d.specialty !== f.specialty) return false
  if (f.service && !SERVICE_SPECIALTIES[f.service].includes(d.specialty)) return false
  if (f.dentist_name.trim() && !d.name.toLowerCase().includes(f.dentist_name.trim().toLowerCase())) return false
  if (f.availability !== 'any' && daysFromToday(d.next_available, today) > AVAILABILITY_DAYS[f.availability]) {
    return false
  }
  return true
}

/**
 * Matching dentists, with the ones inside the distance setting first (in the chosen order)
 * and the farther ones after them, nearest first. Distance is a preference, not a cutoff.
 */
export function matchAndSort(dentists: DentistResult[], f: Filters, today = new Date()): DentistResult[] {
  const byDistance = (a: DentistResult, b: DentistResult) =>
    a.distance_miles - b.distance_miles || a.name.localeCompare(b.name)
  const nearbyFirst = (a: DentistResult, b: DentistResult) => Number(!isNearby(a, f)) - Number(!isNearby(b, f))
  return dentists
    .filter((d) => matchesDentist(d, f, today))
    .sort(
      (a, b) =>
        nearbyFirst(a, b) ||
        (f.sort === 'earliest' && isNearby(a, f)
          ? a.next_available.localeCompare(b.next_available) || byDistance(a, b)
          : byDistance(a, b)),
    )
}
