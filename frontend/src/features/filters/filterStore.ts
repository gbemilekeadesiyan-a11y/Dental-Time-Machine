/**
 * The one filter state, shared by the filter form and the assistant.
 *
 * Memory only (no browser storage: ZIP and age are never persisted, CLAUDE.md section 12).
 * It lives outside React so filters survive moving between steps.
 */

import { useSyncExternalStore } from 'react'
import { DEFAULT_FILTERS } from './filterOptions'
import type { FilterChanges, Filters } from './types'

export interface AssistantTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface FilterStoreState {
  filters: Filters
  /** The keys the assistant changed last, so the form can show them changing. */
  lastAiChange: { keys: (keyof Filters)[]; version: number } | null
  turns: AssistantTurn[]
}

/** Keep the conversation short: CLAUDE.md caps chat history at 20 turns. */
const MAX_TURNS = 20

let state: FilterStoreState = { filters: DEFAULT_FILTERS, lastAiChange: null, turns: [] }
const listeners = new Set<() => void>()

function update(next: FilterStoreState) {
  state = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useFilterStore(): FilterStoreState {
  return useSyncExternalStore(subscribe, () => state)
}

/** A manual change from the form. */
export function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
  update({ ...state, filters: { ...state.filters, [key]: value } })
}

/** Put one filter back to its default (the x on a chip). */
export function clearFilter(key: keyof Filters) {
  setFilter(key, DEFAULT_FILTERS[key])
}

export function clearAllFilters() {
  update({ ...state, filters: DEFAULT_FILTERS })
}

/**
 * Apply the assistant's changes on top of the current filters.
 * Only the keys in `changes` move; everything the user set stays.
 * Returns the new filters and the keys whose value actually changed.
 */
export function applyAiChanges(changes: FilterChanges, reset: boolean): { filters: Filters; keys: (keyof Filters)[] } {
  const base = reset ? DEFAULT_FILTERS : state.filters
  const filters = { ...base, ...changes }
  const keys = (Object.keys(filters) as (keyof Filters)[]).filter(
    (key) => JSON.stringify(filters[key]) !== JSON.stringify(state.filters[key]),
  )
  update({ ...state, filters, lastAiChange: { keys, version: (state.lastAiChange?.version ?? 0) + 1 } })
  return { filters, keys }
}

export function addTurn(turn: AssistantTurn) {
  update({ ...state, turns: [...state.turns, turn].slice(-MAX_TURNS) })
}
