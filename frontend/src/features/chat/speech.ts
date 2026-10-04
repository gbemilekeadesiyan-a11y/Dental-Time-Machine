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

/** Tap to talk, tap to stop. `onDone` gets the final transcript. */
export function useSpeechInput(language: Language, onDone: (transcript: string) => void) {
  const supported = typeof window !== 'undefined' && recognitionConstructor() !== undefined
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [problem, setProblem] = useState<MicProblem | null>(null)
  const recognition = useRef<Recognition | null>(null)
  const transcript = useRef('')
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => () => recognition.current?.abort(), [])

  const start = useCallback(() => {
    const Ctor = recognitionConstructor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = SPEECH_LOCALES[language]
    r.interimResults = true
    r.continuous = true
    transcript.current = ''
    r.onresult = (event) => {
      const text = Array.from(event.results, (result) => result[0]?.transcript ?? '').join(' ')
      transcript.current = text
      setInterim(text)
    }
    r.onerror = (event) => setProblem(micProblem(event.error))
    r.onend = () => {
      setListening(false)
      setInterim('')
      recognition.current = null
      const text = transcript.current.trim()
      if (text) done.current(text)
    }
    recognition.current = r
    setProblem(null)
    setListening(true)
    try {
      r.start()
    } catch {
      setProblem('other')
      setListening(false)
    }
  }, [language])

  const stop = useCallback(() => recognition.current?.stop(), [])

  return { supported, listening, interim, problem, start, stop }
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
