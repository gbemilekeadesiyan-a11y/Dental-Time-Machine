import { useId, type Dispatch } from 'react'
import type { Action } from '../../state'
import type { Language, Preferences, Style } from '../../types'
import { CHAT_COPY, LANGUAGE_NAMES } from './chatCopy'

interface Props {
  preferences: Preferences
  dispatch: Dispatch<Action>
  /**
   * "full": labelled selects and a checkbox. "compact": 36 px controls for a card header,
   * a language select with a globe, a style select and a speaker toggle.
   */
  variant?: 'full' | 'compact'
  /** Called after the user picks a language here (the chat announces it). */
  onLanguageChange?: (language: Language) => void
}

const LANGUAGES = Object.keys(LANGUAGE_NAMES) as Language[]
const STYLES: Style[] = ['simple', 'detailed', 'numbers']

/**
 * Language, wording style and voice. Changes wording only, never numbers. Session only.
 * Every picker reads and writes the same state.preferences, so two can be on screen at once;
 * ids come from useId, so they stay unique.
 */
export default function PreferencesPicker({ preferences, dispatch, variant = 'full', onLanguageChange }: Props) {
  const copy = CHAT_COPY[preferences.language]
  const languageId = useId()
  const styleId = useId()
  const voiceId = useId()
  const set = (change: Partial<Preferences>) =>
    dispatch({ type: 'set_preferences', preferences: { ...preferences, ...change } })
  const setLanguage = (language: Language) => {
    set({ language })
    onLanguageChange?.(language)
  }

  const languageOptions = LANGUAGES.map((l) => (
    <option key={l} value={l} lang={l}>
      {LANGUAGE_NAMES[l]}
    </option>
  ))
  const styleOptions = STYLES.map((s) => (
    <option key={s} value={s}>
      {copy.styles[s]}
    </option>
  ))

  if (variant === 'compact') {
    const control = 'field h-9 min-h-9 w-full rounded-full py-0 text-sm'
    // Two rows so it fits beside a card title even in a half-width column: language and the
    // speaker on top, style underneath. The sr-only labels are absolutely positioned, so they
    // take no grid cells. Tab order: language, speaker, style.
    return (
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label htmlFor={languageId} className="sr-only">
          {copy.languageLabel}
        </label>
        <span className="relative">
          <GlobeIcon />
          <select
            id={languageId}
            value={preferences.language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className={`${control} pr-8 pl-9`}
          >
            {languageOptions}
          </select>
        </span>

        {/* The visible label is a tooltip on hover and focus; screen readers get it as text. */}
        <button
          type="button"
          aria-pressed={preferences.voice_on}
          onClick={() => set({ voice_on: !preferences.voice_on })}
          className={
            'group relative grid size-9 place-items-center rounded-full border transition-colors ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
            (preferences.voice_on
              ? 'border-primary bg-primary text-white'
              : 'border-muted bg-white/90 text-ink hover:bg-white')
          }
        >
          <SpeakerIcon on={preferences.voice_on} />
          <span className="sr-only">{copy.voiceLabel}</span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-full right-0 z-10 mt-2 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {copy.voiceLabel}
          </span>
        </button>

        <label htmlFor={styleId} className="sr-only">
          {copy.styleLabel}
        </label>
        <select
          id={styleId}
          value={preferences.style}
          onChange={(e) => set({ style: e.target.value as Style })}
          className={`${control} col-span-2 pr-8 pl-3`}
        >
          {styleOptions}
        </select>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label htmlFor={languageId} className="sr-only">
        {copy.languageLabel}
      </label>
      <select
        id={languageId}
        value={preferences.language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="field w-auto py-1"
      >
        {languageOptions}
      </select>

      <label htmlFor={styleId} className="sr-only">
        {copy.styleLabel}
      </label>
      <select
        id={styleId}
        value={preferences.style}
        onChange={(e) => set({ style: e.target.value as Style })}
        className="field w-auto py-1"
      >
        {styleOptions}
      </select>

      <div className="flex min-h-11 items-center gap-2">
        <input
          id={voiceId}
          type="checkbox"
          checked={preferences.voice_on}
          onChange={(e) => set({ voice_on: e.target.checked })}
          className="size-5 accent-primary"
        />
        <label htmlFor={voiceId} className="text-ink">
          {copy.voiceLabel}
        </label>
      </div>
    </div>
  )
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-none stroke-current text-muted-text"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="7.25" />
      <path d="M2.75 10h14.5M10 2.75c2 2 3 4.5 3 7.25s-1 5.25-3 7.25c-2-2-3-4.5-3-7.25s1-5.25 3-7.25Z" />
    </svg>
  )
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-none stroke-current" strokeWidth="1.6">
      <path d="M3.5 7.5h3l4-3.25v11.5l-4-3.25h-3z" strokeLinejoin="round" />
      {on ? (
        <path d="M13.5 7.25a3.75 3.75 0 0 1 0 5.5M15.75 5a7 7 0 0 1 0 10" strokeLinecap="round" />
      ) : (
        <path d="m13.5 8 4 4m0-4-4 4" strokeLinecap="round" />
      )}
    </svg>
  )
}
