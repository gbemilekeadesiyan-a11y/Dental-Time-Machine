import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState, type Dispatch } from 'react'
import { PLAN_FORM_ID } from '../../anchors'
import { ApiError, chat, isAbortError } from '../../api'
import { ArrowRight } from '../../components/Icons'
import Notice from '../../components/Notice'
import { procedureLabels } from '../../format'
import type { Action, AppState } from '../../state'
import type { ChatTurn, Language, PlanDetails, Procedure } from '../../types'
import { setFilter } from '../filters/filterStore'
import { CHAT_COPY, LANGUAGE_NAMES } from './chatCopy'
import { completePlan } from './chatUtils'
import ConfirmPlan from './ConfirmPlan'
import ConfirmProposals from './ConfirmProposals'
import PreferencesPicker from './PreferencesPicker'
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
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null)
  const [zip, setZip] = useState<string | null>(null)
  // After Apply on the plan card: a short confirmation until the next message.
  const [planAdded, setPlanAdded] = useState(false)
  // Set when the user changes the language here; announced politely.
  const [switchedTo, setSwitchedTo] = useState<Language | null>(null)
  const reduceMotion = useReducedMotion()
  const speaker = useSpeaker()
  const titleId = useId()
  const inputId = useId()
  const latest = useRef<AbortController | null>(null)

  useEffect(() => {
    savedTurns = turns
  }, [turns])

  // The assistant writes the greeting in the chosen language and style, knowing whether care is
  // already entered. It's asked again only when language or style change, not on every edit.
  const care = useRef({ procedures: state.procedures, plan: completePlan(state.plan), voiceOn: preferences.voice_on })
  useEffect(() => {
    care.current = { procedures: state.procedures, plan: completePlan(state.plan), voiceOn: preferences.voice_on }
  }, [state.procedures, state.plan, preferences.voice_on])
  const { language, style } = preferences
  useEffect(() => {
    const controller = new AbortController()
    const { procedures, plan, voiceOn } = care.current
    chat({ turns: [], preferences: { language, style, voice_on: voiceOn }, procedures, plan }, { signal: controller.signal })
      .then((r) => setGreeting(r.say))
      .catch(() => setGreeting(''))
    return () => controller.abort()
  }, [language, style])

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim().slice(0, MAX_TEXT)
      if (!clean || busy) return
      const next = [...turns, { role: 'user' as const, text: clean }].slice(-MAX_TURNS)
      setTurns(next)
      setDraft('')
      setError(null)
      setPlanAdded(false)
      setSwitchedTo(null)
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
        if (reply.proposed_plan) setPlanDetails(reply.proposed_plan)
        if (reply.proposed_zip) setZip(reply.proposed_zip)
        setCanWaitIds(reply.proposed_can_wait)
        if (preferences.voice_on) void speaker.play(reply.say, reply.language ?? preferences.language)
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

  const names = procedureLabels(state.procedures)
  const waitable = canWaitIds.filter((id) => state.procedures.some((p) => p.id === id && !p.can_wait))

  return (
    <section aria-labelledby={titleId} className="glass space-y-4 rounded-3xl p-5 sm:p-6">
      <div className="space-y-2">
        {/* Title on the left, language and style on the right; the picker wraps under it below 810 px. */}
        <div className="flex flex-wrap items-start justify-between gap-3 tablet:flex-nowrap">
          <div className="min-w-0 space-y-1">
            <h3 id={titleId} className="text-xl font-semibold tracking-tight text-ink">
              {copy.intakeTitle}
            </h3>
            <p className="text-sm text-muted-text">{copy.intakeIntro}</p>
          </div>
          <PreferencesPicker
            variant="compact"
            preferences={preferences}
            dispatch={dispatch}
            onLanguageChange={setSwitchedTo}
          />
        </div>
        {/* Always rendered (empty until a change), so screen readers announce it. The conversation stays. */}
        <p className="text-sm text-muted-text" role="status">
          {switchedTo && copy.nowReplying(LANGUAGE_NAMES[switchedTo])}
        </p>
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
          existing={state.procedures}
          copy={copy}
          onConfirm={(confirmed) => {
            // Ids were unique when proposed; keep them unique if care was added since (e.g. Load Maya),
            // and point "comes after" links at the renamed ids.
            const taken = new Set(state.procedures.map((p) => p.id))
            const renamed = new Map<string, string>()
            for (const p of confirmed) {
              let id = p.id
              while (taken.has(id)) id = `${p.id}_${crypto.randomUUID().slice(0, 8)}`
              taken.add(id)
              renamed.set(p.id, id)
            }
            const unique = confirmed.map((p) => ({
              ...p,
              id: renamed.get(p.id) ?? p.id,
              depends_on: p.depends_on === null ? null : (renamed.get(p.depends_on) ?? p.depends_on),
            }))
            dispatch({ type: 'add_procedures', procedures: unique })
            setProposals([])
          }}
          onDismiss={() => setProposals([])}
        />
      )}

      {planDetails && (
        <ConfirmPlan
          details={planDetails}
          plan={state.plan}
          copy={copy}
          onApply={(plan) => {
            dispatch({ type: 'update_plan', plan })
            setPlanDetails(null)
            setPlanAdded(true)
            // Show the filled-in form, where every value can still be edited.
            requestAnimationFrame(() =>
              document
                .getElementById(PLAN_FORM_ID)
                ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }),
            )
          }}
          onDismiss={() => setPlanDetails(null)}
        />
      )}

      {planAdded && (
        <p className="text-sm font-medium text-ink" role="status">
          {copy.planAdded}
        </p>
      )}

      {zip && (
        // Only where the dentist search starts; the ZIP stays in memory (CLAUDE.md section 12).
        <div className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ink/5">
          <p className="text-sm text-ink">{copy.zipQuestion(zip)}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setFilter('zip', zip)
                setZip(null)
              }}
              className="btn-primary"
            >
              {copy.zipUse}
            </button>
            <button type="button" onClick={() => setZip(null)} className="btn-secondary">
              {copy.zipSkip}
            </button>
          </div>
        </div>
      )}

      {error && <Notice tone="problem">{error}</Notice>}
      {mic.problem && <Notice>{copy.micProblems[mic.problem]}</Notice>}
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
