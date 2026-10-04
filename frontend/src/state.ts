/**
 * App state. Lives in memory only: no browser storage, nothing persisted
 * (CLAUDE.md section 10: state lives in the browser session only).
 */

import type { DocumentReadResult, Language, Plan, Preferences, Procedure, Schedule } from './types'

export interface AppState {
  procedures: Procedure[]
  plan: Plan
  /** Procedure id to plan year. Missing ids mean this year. */
  schedule: Schedule
  /** True while the plan is Maya's unedited demo plan (shows the "Demo plan" label). */
  isDemo: boolean
  /** Language, wording style and voice (feature/chat). Session only. */
  preferences: Preferences
  /** What the reader found in the last uploaded document, not yet confirmed (feature/documents). Session only. */
  document: DocumentReadResult | null
  /** A question for the chat sent from elsewhere (e.g. a document term card); the chat sends it once. */
  chatAsk: { id: number; text: string } | null
}

const LANGUAGES: readonly Language[] = ['en', 'es', 'fr', 'pt']

/** Offer the browser's language when we support it; the user can change it any time. */
function browserLanguage(): Language {
  const code = typeof navigator === 'undefined' ? '' : navigator.language.slice(0, 2).toLowerCase()
  return LANGUAGES.find((l) => l === code) ?? 'en'
}

/**
 * A blank plan. Unknown numbers are NaN so the form shows empty fields;
 * we never invent fees or coverage numbers (CLAUDE.md section 12).
 */
export const BLANK_PLAN: Plan = {
  annual_max: Number.NaN,
  deductible: Number.NaN,
  deductible_waived_for: ['preventive'],
  coverage: { preventive: Number.NaN, basic: Number.NaN, major: Number.NaN },
  reset_date: '',
  used_this_year: 0,
  deductible_paid_this_year: 0,
  in_network: true,
}

export const initialState: AppState = {
  procedures: [],
  plan: BLANK_PLAN,
  schedule: {},
  isDemo: false,
  preferences: { language: browserLanguage(), style: 'simple', voice_on: false },
  document: null,
  chatAsk: null,
}

export type Action =
  | { type: 'loaded_demo'; procedures: Procedure[]; plan: Plan }
  | { type: 'set_can_wait'; id: string; canWait: boolean }
  | { type: 'update_plan'; plan: Plan }
  | { type: 'set_schedule'; schedule: Schedule }
  | { type: 'add_procedures'; procedures: Procedure[] }
  | { type: 'set_preferences'; preferences: Preferences }
  /**
   * Details the user confirmed on a document upload. Replaces procedures and/or
   * the plan; null leaves that part as it was. Only dispatched after the user confirms.
   */
  | { type: 'confirmed_intake'; procedures: Procedure[] | null; plan: Plan | null }
  /** A document was read (feature/documents): the chat may talk about it. */
  | { type: 'document_read'; document: DocumentReadResult }
  /** Ask the chat a question on the user's behalf; the chat sends it and clears it. */
  | { type: 'ask_chat'; text: string }
  | { type: 'chat_ask_handled'; id: number }

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loaded_demo':
      return { ...state, procedures: action.procedures, plan: action.plan, schedule: {}, isDemo: true }

    case 'add_procedures':
      // Only called after the user confirms proposals on a form. New procedures start in this year.
      return { ...state, procedures: [...state.procedures, ...action.procedures] }

    case 'set_preferences':
      return { ...state, preferences: action.preferences }

    case 'set_can_wait': {
      const procedures = state.procedures.map((p) => (p.id === action.id ? { ...p, can_wait: action.canWait } : p))
      if (action.canWait) return { ...state, procedures }
      // A locked procedure can't stay in next year: put it back in this year.
      const { [action.id]: _removed, ...schedule } = state.schedule
      return { ...state, procedures, schedule }
    }

    case 'set_schedule':
      // Only called with a schedule the engine has already accepted.
      return action.schedule === state.schedule ? state : { ...state, schedule: action.schedule }

    case 'update_plan':
      // Once the user edits the plan it's no longer the demo plan.
      return { ...state, plan: action.plan, isDemo: false }

    case 'confirmed_intake':
      // New procedures replace the old ones, so old schedule moves no longer apply.
      // The user's own details are never the demo plan.
      return {
        ...state,
        procedures: action.procedures ?? state.procedures,
        plan: action.plan ?? state.plan,
        schedule: action.procedures ? {} : state.schedule,
        isDemo: false,
      }

    case 'document_read':
      return { ...state, document: action.document }

    case 'ask_chat':
      return { ...state, chatAsk: { id: (state.chatAsk?.id ?? 0) + 1, text: action.text } }

    case 'chat_ask_handled':
      return state.chatAsk?.id === action.id ? { ...state, chatAsk: null } : state

    default: {
      const unreachable: never = action
      return unreachable
    }
  }
}
