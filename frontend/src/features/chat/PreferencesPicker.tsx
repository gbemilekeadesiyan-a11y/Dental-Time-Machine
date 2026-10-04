import { useEffect, useId, type Dispatch } from 'react'
import type { Action } from '../../state'
import type { Language, Preferences, Style } from '../../types'
import { CHAT_COPY, LANGUAGE_NAMES } from './chatCopy'

interface Props {
  preferences: Preferences
  dispatch: Dispatch<Action>
}

const LANGUAGES = Object.keys(LANGUAGE_NAMES) as Language[]
const STYLES: Style[] = ['simple', 'detailed', 'numbers']

/** Language, wording style and voice. Changes wording only, never numbers. Session only. */
export default function PreferencesPicker({ preferences, dispatch }: Props) {
  const copy = CHAT_COPY[preferences.language]
  const languageId = useId()
  const styleId = useId()
  const voiceId = useId()
  const set = (change: Partial<Preferences>) =>
    dispatch({ type: 'set_preferences', preferences: { ...preferences, ...change } })

  // Screen readers and the browser's speech engine follow the page language.
  useEffect(() => {
    document.documentElement.lang = preferences.language
  }, [preferences.language])

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label htmlFor={languageId} className="sr-only">
        {copy.languageLabel}
      </label>
      <select
        id={languageId}
        value={preferences.language}
        onChange={(e) => set({ language: e.target.value as Language })}
        className="field w-auto py-1"
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
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
        {STYLES.map((s) => (
          <option key={s} value={s}>
            {copy.styles[s]}
          </option>
        ))}
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
