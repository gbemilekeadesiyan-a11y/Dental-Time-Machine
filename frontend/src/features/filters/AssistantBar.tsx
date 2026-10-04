import { useId, useState, type FormEvent } from 'react'
import { ApiError, parseFilters } from '../../api'
import { ArrowRight } from '../../components/Icons'
import Notice from '../../components/Notice'
import { FILTER_LABELS, describeValue } from './filterOptions'
import { addTurn, applyAiChanges, useFilterStore } from './filterStore'
import type { Filters } from './types'

const EXAMPLES = [
  'Find me an in-network dentist within 10 miles, under $200, that can see me this week.',
  "Actually I'll drive 25 miles if someone can see me tomorrow.",
  'Spanish-speaking pediatric dentist accepting new patients',
]

const MAX_TEXT = 2000

/** What changed, in the same words the form uses. */
function reply(keys: (keyof Filters)[], filters: Filters, reset: boolean, note: string | null): string {
  const parts: string[] = []
  if (reset) parts.push('Cleared your filters.')
  if (keys.length > 0) {
    const list = keys.map((k) => `${FILTER_LABELS[k]}: ${describeValue(k, filters[k])}`).join(' · ')
    parts.push(`Updated ${list}.`)
    if (!reset) parts.push('Everything else stayed the same.')
  } else if (!reset && !note) {
    parts.push('Those filters were already set.')
  }
  if (note) parts.push(note)
  return parts.join(' ')
}

/**
 * Plain-language filter requests. The assistant only changes the shared filters;
 * the user can see each change on the form and undo or adjust it by hand.
 */
export default function AssistantBar() {
  const { turns } = useFilterStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()

  async function send(message: string) {
    const trimmed = message.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await parseFilters(trimmed.slice(0, MAX_TEXT))
      addTurn({ role: 'user', text: trimmed })
      const { filters, keys } = applyAiChanges(result.changes, result.reset)
      addTurn({ role: 'assistant', text: reply(keys, filters, result.reset, result.note) })
      setText('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send(text)
  }

  return (
    <div className="glass space-y-4 rounded-3xl p-5 sm:p-6">
      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor={inputId} className="text-xl font-semibold tracking-tight text-ink">
          Tell us what you&apos;re looking for
        </label>
        <p className="text-sm text-muted-text">We&apos;ll set the filters below. You can change any of them by hand.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={inputId}
            type="text"
            value={text}
            maxLength={MAX_TEXT}
            onChange={(e) => setText(e.target.value)}
            placeholder="For example: in-network, within 10 miles, this week"
            className="field"
          />
          <button type="submit" disabled={busy || !text.trim()} className="btn-primary shrink-0">
            {busy ? 'Setting filters…' : 'Set filters'}
            <ArrowRight />
          </button>
        </div>
      </form>

      {turns.length === 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Examples">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => void send(example)}
              disabled={busy}
              className="min-h-9 rounded-full bg-card px-3 py-1.5 text-left text-sm text-ink shadow-sm ring-1 ring-ink/5 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-45"
            >
              {example}
            </button>
          ))}
        </div>
      ) : (
        <ol className="space-y-2" aria-live="polite" aria-label="Conversation">
          {turns.slice(-6).map((turn, i) => (
            <li
              key={Math.max(0, turns.length - 6) + i}
              className={
                'w-fit max-w-[90%] rounded-2xl px-4 py-2 text-sm ' +
                (turn.role === 'user' ? 'ml-auto bg-primary text-white' : 'bg-card text-ink shadow-sm ring-1 ring-ink/5')
              }
            >
              <span className="sr-only">{turn.role === 'user' ? 'You said: ' : 'Assistant: '}</span>
              {turn.text}
            </li>
          ))}
        </ol>
      )}

      {error && <Notice tone="problem">{error}</Notice>}
    </div>
  )
}
