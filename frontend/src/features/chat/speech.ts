/**
 * Voice in and out for the chat feature.
 * - useSpeechInput: the browser's Web Speech API (speech to text). Nothing leaves the
 *   browser except what the browser's own engine needs; the transcript is shown to the user.
 * - useSpeaker: plays Polly audio from POST /speak. Text always stays on screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { isAbortError, speak } from '../../api'
import type { Language } from '../../types'
import { SPEECH_LOCALES } from './chatCopy'

// The Web Speech API isn't in TypeScript's DOM types yet; this is the part we use.
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: RecognitionResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionConstructor = new () => Recognition

function recognitionConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** Why the microphone didn't work, so the user knows what to fix. */
export type MicProblem = 'denied' | 'service' | 'no_mic' | 'other'

/** Browser error codes to a MicProblem. "no-speech" and "aborted" aren't problems. */
function micProblem(code: string): MicProblem | null {
  if (code === 'no-speech' || code === 'aborted') return null
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied'
  if (code === 'network') return 'service'
  if (code === 'audio-capture') return 'no_mic'
  return 'other'
}

/** A pause this long ends the message and sends it. Every new word restarts the countdown. */
const SILENCE_MS = 2_000
/** How long to wait for a first word before giving up. */
const NO_SPEECH_MS = 8_000
/** A hard cap on one listening session. */
const MAX_LISTEN_MS = 60_000

/**
 * Tap to talk. Sends what it heard (`onDone`) after a short pause, so it doesn't keep recording
 * long, unrelated speech; Stop still ends it early. Recognition stays continuous, so a pause
 * under 2 s mid-sentence keeps listening. `heardNothing` is true after a session that ended
 * without any words, until the next start or `clearHeardNothing`.
 */
export function useSpeechInput(language: Language, onDone: (transcript: string) => void) {
  const supported = typeof window !== 'undefined' && recognitionConstructor() !== undefined
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [problem, setProblem] = useState<MicProblem | null>(null)
  const [heardNothing, setHeardNothing] = useState(false)
  const recognition = useRef<Recognition | null>(null)
  const transcript = useRef('')
  // The countdown to stop: NO_SPEECH_MS until the first word, then SILENCE_MS after each word.
  const silenceTimer = useRef<number | undefined>(undefined)
  const maxTimer = useRef<number | undefined>(undefined)
  // Set when a session ends on purpose (language change) or with a mic problem: no "didn't hear" note then.
  const quiet = useRef(false)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  const clearTimers = useCallback(() => {
    window.clearTimeout(silenceTimer.current)
    window.clearTimeout(maxTimer.current)
  }, [])

  useEffect(
    () => () => {
      clearTimers()
      recognition.current?.abort()
    },
    [clearTimers],
  )

  // A session can't change language mid-way: when the language changes, drop the one that's
  // running (without sending what it half-heard). The next tap listens in the new language.
  useEffect(() => {
    if (!recognition.current) return
    quiet.current = true
    transcript.current = ''
    recognition.current.abort()
  }, [language])

  const start = useCallback(() => {
    const Ctor = recognitionConstructor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = SPEECH_LOCALES[language]
    r.interimResults = true
    r.continuous = true
    transcript.current = ''
    quiet.current = false
    r.onresult = (event) => {
      const text = Array.from(event.results, (result) => result[0]?.transcript ?? '').join(' ')
      transcript.current = text
      setInterim(text)
      window.clearTimeout(silenceTimer.current)
      silenceTimer.current = window.setTimeout(() => r.stop(), SILENCE_MS)
    }
    r.onerror = (event) => {
      clearTimers()
      const found = micProblem(event.error)
      if (found) quiet.current = true
      setProblem(found)
    }
    r.onend = () => {
      clearTimers()
      setListening(false)
      setInterim('')
      recognition.current = null
      const text = transcript.current.trim()
      if (text) done.current(text)
      else if (!quiet.current) setHeardNothing(true)
    }
    recognition.current = r
    setProblem(null)
    setHeardNothing(false)
    setListening(true)
    try {
      r.start()
      silenceTimer.current = window.setTimeout(() => r.stop(), NO_SPEECH_MS)
      maxTimer.current = window.setTimeout(() => r.stop(), MAX_LISTEN_MS)
    } catch {
      setProblem('other')
      setListening(false)
    }
  }, [language, clearTimers])

  const stop = useCallback(() => {
    clearTimers()
    recognition.current?.stop()
  }, [clearTimers])

  const clearHeardNothing = useCallback(() => setHeardNothing(false), [])

  return { supported, listening, interim, problem, heardNothing, start, stop, clearHeardNothing }
}

/** Plays Polly audio for a text. One clip at a time. */
export function useSpeaker() {
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const controller = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    if (audio.current) {
      audio.current.pause()
      URL.revokeObjectURL(audio.current.src)
      audio.current = null
    }
    setPlaying(false)
  }, [])

  useEffect(() => stop, [stop])

  const play = useCallback(
    async (text: string, language: Language) => {
      stop()
      setFailed(false)
      const c = new AbortController()
      controller.current = c
      setPlaying(true)
      try {
        const blob = await speak(text, language, { signal: c.signal })
        const clip = new Audio(URL.createObjectURL(blob))
        audio.current = clip
        clip.onended = stop
        await clip.play()
      } catch (e) {
        if (!isAbortError(e)) setFailed(true)
        setPlaying(false)
      }
    },
    [stop],
  )

  return { playing, failed, play, stop }
}
