import { useEffect, useId, useState, type Dispatch } from 'react'
import { ApiError, isAbortError, optimize, summary } from '../../api'
import Notice from '../../components/Notice'
import type { Action, AppState } from '../../state'
import { CHAT_COPY } from './chatCopy'
import { completePlan } from './chatUtils'
import PreferencesPicker from './PreferencesPicker'
import { useSpeaker } from './speech'

interface Props {
  state: AppState
  /** For the language and style picker in the header; it writes the same preferences as the chat. */
  dispatch: Dispatch<Action>
}

interface Inputs {
  procedures: AppState['procedures']
  plan: AppState['plan']
  schedule: AppState['schedule']
  language: string
  style: string
}
type Outcome = { inputs: Inputs; ok: true; text: string } | { inputs: Inputs; ok: false; message: string }

/**
 * End-of-flow recap in the user's language and style. The text comes from POST /summary,
 * which recomputes every figure with the engine and passes the dollar guard. It already
 * ends with the reset wording and the disclaimer. Read aloud with Polly when voice is on.
 */
export default function ChatSummary({ state, dispatch }: Props) {
  const { procedures, plan, schedule, preferences } = state
  const { language, style } = preferences
  const copy = CHAT_COPY[language]
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const speaker = useSpeaker()
  const titleId = useId()
  const ready = completePlan(plan)

  useEffect(() => {
    if (procedures.length === 0 || ready === null) return
    const inputs = { procedures, plan: ready, schedule, language, style }
    const controller = new AbortController()
    const options = { signal: controller.signal }
    // voice_on doesn't change the text, so toggling voice doesn't ask for a new summary.
    const prefs = { language, style, voice_on: false }
    optimize({ procedures, plan: ready }, options)
      .then((result) => summary({ procedures, plan: ready, schedule, optimize: result, preferences: prefs }, options))
      .then((r) => setOutcome({ inputs, ok: true, text: r.text }))
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
        setOutcome({ inputs, ok: false, message })
      })
    return () => controller.abort()
  }, [procedures, ready, schedule, language, style])

  const i = outcome?.inputs
  const current =
    i && i.procedures === procedures && i.plan === ready && i.schedule === schedule && i.language === language && i.style === style
      ? outcome
      : null

  return (
    <section aria-labelledby={titleId} className="glass space-y-4 rounded-3xl p-5 sm:p-6">
      {/* Switching the language here rewrites the recap in that language. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 id={titleId} className="text-xl font-semibold tracking-tight text-ink">
          {copy.summaryTitle}
        </h3>
        <PreferencesPicker variant="compact" preferences={preferences} dispatch={dispatch} />
      </div>

      {procedures.length === 0 || ready === null ? (
        <Notice>{copy.summaryNeedsCare}</Notice>
      ) : current === null ? (
        <p className="text-sm text-muted-text" role="status">
          {copy.summaryWorking}
        </p>
      ) : !current.ok ? (
        <Notice tone="problem">{current.message}</Notice>
      ) : (
        <>
          <p className="leading-relaxed text-ink" aria-live="polite">
            {current.text}
          </p>
          {preferences.voice_on && (
            <button
              type="button"
              onClick={() => (speaker.playing ? speaker.stop() : void speaker.play(current.text, language))}
              className="btn-secondary"
            >
              {speaker.playing ? copy.stopAudio : copy.readAloud}
            </button>
          )}
          {speaker.failed && <Notice>{copy.voiceProblem}</Notice>}
        </>
      )}
    </section>
  )
}
