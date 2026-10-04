import { useEffect, useState } from 'react'
import { ApiError, readDocument } from '../../api'
import Notice from '../../components/Notice'
import type { DocumentReadResult, Plan, Procedure } from '../../types'
import DocumentConfirm from './DocumentConfirm'
import DocumentReveal from './DocumentReveal'
import DocumentUpload, { MAX_BYTES, TOO_LARGE } from './DocumentUpload'
import { makePreviewUrl } from './documentPreview'
import { revealTerms } from './documentTerms'
import { resizeImage } from './resizeImage'

/** Keep the scan on screen at least this long so it reads as a moment, not a flicker (ms). */
const MIN_SCAN_MS = 2400
const UNEXPECTED = 'Something went wrong. Please try again.'

type Step = 'upload' | 'scanning' | 'revealed' | 'confirm'

interface Props {
  /**
   * Called only after the user confirms on the form. Returns a short message
   * saying what was applied, shown under the upload area.
   */
  onConfirm: (plan: Plan | null, procedures: Procedure[]) => string
  /** Called as soon as a document is read (before confirming), so the chat can talk about it. */
  onRead?: (result: DocumentReadResult) => void
  /** Opens the chat about a term, or about the whole document when term is null. */
  onAsk?: (term: string | null) => void
}

/**
 * Upload a benefits summary or treatment estimate (feature/documents):
 * upload -> scanning (real document, light sweep) -> revealed (blur + term
 * cards, only when there are terms) -> confirm form. Nothing is applied until
 * the user confirms.
 */
export default function DocumentIntake({ onConfirm, onRead, onAsk }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<DocumentReadResult | null>(null)
  const [terms, setTerms] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState<string | null>(null)

  // Free the preview image when it's replaced or the intake goes away.
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function handleFile(original: File) {
    setError(null)
    setApplied(null)
    setPreviewUrl(null)
    setStep('scanning')
    const preview = makePreviewUrl(original).then((url) => {
      setPreviewUrl(url)
      return url
    })
    try {
      const file = await resizeImage(original)
      if (file.size > MAX_BYTES) throw new ApiError(422, TOO_LARGE)
      // Reveal only once the real page is showing, so the blur always has the document behind it.
      const [read] = await Promise.all([readDocument(file), wait(MIN_SCAN_MS), preview])
      const cards = revealTerms(read)
      setResult(read)
      setTerms(cards)
      onRead?.(read)
      setStep(cards.length > 0 ? 'revealed' : 'confirm')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED)
      setPreviewUrl(null)
      setStep('upload')
    }
  }

  function reset() {
    setResult(null)
    setTerms([])
    setPreviewUrl(null)
    setStep('upload')
  }

  return (
    <section aria-labelledby="document-intake-title" className="space-y-4">
      <div className="space-y-1">
        <h3 id="document-intake-title" className="text-xl font-semibold tracking-tight text-ink">
          Or upload a document
        </h3>
        <p className="text-sm text-muted-text">
          A benefits summary, plan page, or your dentist&apos;s treatment estimate. We read it in memory and never save it.
        </p>
      </div>

      {step === 'upload' && <DocumentUpload onFile={(f) => void handleFile(f)} error={error} />}

      {(step === 'scanning' || step === 'revealed') && (
        <DocumentReveal
          previewUrl={previewUrl}
          phase={step === 'scanning' ? 'scanning' : 'revealed'}
          terms={terms}
          onContinue={() => setStep('confirm')}
          onAsk={onAsk}
        />
      )}

      {step === 'confirm' && result && (
        <DocumentConfirm
          result={result}
          onCancel={reset}
          onConfirm={(plan, procedures) => {
            setApplied(onConfirm(plan, procedures))
            reset()
          }}
        />
      )}

      {applied && <Notice>{applied}</Notice>}
    </section>
  )
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
