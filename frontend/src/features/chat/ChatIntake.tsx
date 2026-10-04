import { useCallback, useEffect, useId, useRef, useState, type Dispatch } from 'react'
import { ApiError, chat, isAbortError } from '../../api'
import { ArrowRight } from '../../components/Icons'
import Notice from '../../components/Notice'
import type { Action, AppState } from '../../state'
import type { ChatTurn, Procedure } from '../../types'
import { CHAT_COPY } from './chatCopy'
import { completePlan, displayNames } from './chatUtils'
import ConfirmProposals from './ConfirmProposals'
import { useSpeaker, useSpeechInput } from './speech'

interface Props {
  state: AppState
  dispatch: Dispatch<Action>
}

const MAX_TURNS = 20
const MAX_TEXT = 2_000

/**
 * The conversation survives moving between steps, but only in memory: it is gone on reload.
 * No browser storage (CLAUDE.md section 12).
 */
let savedTurns: ChatTurn[] = []

/** Voice or text intake: "Tell me what your dentist said". Every proposal needs the user's confirmation. */
export default function ChatIntake({ state, dispatch }: Props) {
  const { preferences } = state
  const copy = CHAT_COPY[preferences.language]
  const [turns, setTurns] = useState<ChatTurn[]>(savedTurns)
  const [greeting, setGreeting] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposals, setProposals] = useState<Procedure[]>([])
  const [canWaitIds, setCanWaitIds] = useState<string[]>([])
  const speaker = useSpeaker()
  const titleId = useId()
  const inputId = useId()
  const latest = useRef<AbortController | null>(null)

  useEffect(() => {
    savedTurns = turns
  }, [turns])

  // The greeting comes from the backend in the chosen language (no LLM call for it).
  useEffect(() => {
    const controller = new AbortController()
    chat({ turns: [], preferences, procedures: [], plan: null }, { signal: controller.signal })
      .then((r) => setGreeting(r.say))
      .catch(() => setGreeting(''))
    return () => controller.abort()
  }, [preferences])

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim().slice(0, MAX_TEXT)
      if (!clean || busy) return
      const next = [...turns, { role: 'user' as const, text: clean }].slice(-MAX_TURNS)
      setTurns(next)
      setDraft('')
      setError(null)
      setBusy(true)
      latest.current?.abort()
      const controller = new AbortController()
      latest.current = controller
      try {
        const reply = await chat(
          { turns: next, preferences, procedures: state.procedures, plan: completePlan(state.plan) },
          { signal: controller.signal },
        )
        setTurns((t) => [...t, { role: 'assistant' as const, text: reply.say }].slice(-MAX_TURNS))
        if (reply.proposed_procedures.length > 0) setProposals(reply.proposed_procedures)
        setCanWaitIds(reply.proposed_can_wait)
        if (preferences.voice_on) void speaker.play(reply.say, preferences.language)
      } catch (e) {
        if (isAbortError(e)) return
        setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
      } finally {
        setBusy(false)
      }
    },
    [busy, turns, preferences, state.procedures, state.plan, speaker],
  )

  const mic = useSpeechInput(preferences.language, (transcript) => void send(transcript))

  const names = displayNames(state.procedures)
  const waitable = canWaitIds.filter((id) => state.procedures.some((p) => p.id === id && !p.can_wait))

  return (
    <section aria-labelledby={titleId} className="glass space-y-4 rounded-3xl p-5 sm:p-6">
      <div className="space-y-1">
        <h3 id={titleId} className="text-xl font-semibold tracking-tight text-ink">
          {copy.intakeTitle}
        </h3>
        <p className="text-sm text-muted-text">{copy.intakeIntro}</p>
      </div>

      <ol className="max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
        {greeting && <Bubble who={copy.assistant} text={greeting} mine={false} />}
        {turns.map((t, i) => (
          <Bubble key={i} who={t.role === 'user' ? copy.you : copy.assistant} text={t.text} mine={t.role === 'user'} />
        ))}
        {busy && (
          <li className="text-sm text-muted-text" role="status">
            {copy.thinking}
          </li>
        )}
      </ol>

      {waitable.map((id) => (
        <div key={id} className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'set_can_wait', id, canWait: true })
              setCanWaitIds((ids) => ids.filter((x) => x !== id))
            }}
            className="btn-primary"
          >
            {copy.canWaitYes(names.get(id) ?? id)}
          </button>
          <button type="button" onClick={() => setCanWaitIds((ids) => ids.filter((x) => x !== id))} className="btn-secondary">
            {copy.canWaitNo}
          </button>
        </div>
      ))}

      {proposals.length > 0 && (
        <ConfirmProposals
          key={proposals.map((p) => p.id).join()}
          proposals={proposals}
          copy={copy}
          onConfirm={(confirmed) => {
            // Ids were unique when proposed; keep them unique if care was added since (e.g. Load Maya).
            const taken = new Set(state.procedures.map((p) => p.id))
            const unique = confirmed.map((p) => {
              let id = p.id
              while (taken.has(id)) id = `${p.id}_${crypto.randomUUID().slice(0, 8)}`
              taken.add(id)
              return { ...p, id }
            })
            dispatch({ type: 'add_procedures', procedures: unique })
            setProposals([])
          }}
          onDismiss={() => setProposals([])}
        />
      )}

      {error && <Notice tone="problem">{error}</Notice>}
      {mic.failed && <Notice>{copy.micProblem}</Notice>}
      {speaker.failed && <Notice>{copy.voiceProblem}</Notice>}
      {mic.listening && (
        <p className="text-sm text-ink" role="status">
          {copy.listening} {mic.interim && <span className="text-muted-text">“{mic.interim}”</span>}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(draft)
        }}
        className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {copy.messageLabel}
          </label>
          <input
            id={inputId}
            type="text"
            value={draft}
            maxLength={MAX_TEXT}
            placeholder={copy.messagePlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            className="field"
          />
        </div>
        {mic.supported && (
          <button
            type="button"
            onClick={mic.listening ? mic.stop : mic.start}
            disabled={busy}
            aria-pressed={mic.listening}
            className="btn-secondary"
          >
            <MicIcon />
            {mic.listening ? copy.stopTalking : copy.talk}
          </button>
        )}
        <button type="submit" disabled={busy || draft.trim() === ''} className="btn-primary">
          {copy.send}
          <ArrowRight />
        </button>
      </form>
    </section>
  )
}

function Bubble({ who, text, mine }: { who: string; text: string; mine: boolean }) {
  return (
    <li className={mine ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          'max-w-[85%] rounded-2xl px-4 py-2 text-sm ' + (mine ? 'bg-primary text-white' : 'bg-card text-ink shadow-sm ring-1 ring-ink/5')
        }
      >
        <span className="sr-only">{who}: </span>
        {text}
      </div>
    </li>
  )
}

function MicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  )
}
