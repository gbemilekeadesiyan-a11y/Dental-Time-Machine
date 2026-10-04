import { useState } from 'react'
import Notice from '../../components/Notice'
import type { DocumentReadResult, Plan, Procedure } from '../../types'
import DocumentConfirm from './DocumentConfirm'
import DocumentUpload from './DocumentUpload'

interface Props {
  /**
   * Called only after the user confirms on the form. Returns a short message
   * saying what was applied, shown under the upload area.
   */
  onConfirm: (plan: Plan | null, procedures: Procedure[]) => string
}

/** Upload a benefits summary or treatment estimate, then confirm what was read (feature/documents). */
export default function DocumentIntake({ onConfirm }: Props) {
  const [result, setResult] = useState<DocumentReadResult | null>(null)
  const [applied, setApplied] = useState<string | null>(null)

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

      {result ? (
        <DocumentConfirm
          result={result}
          onCancel={() => setResult(null)}
          onConfirm={(plan, procedures) => {
            setApplied(onConfirm(plan, procedures))
            setResult(null)
          }}
        />
      ) : (
        <DocumentUpload
          onRead={(r) => {
            setApplied(null)
            setResult(r)
          }}
        />
      )}

      {applied && <Notice>{applied}</Notice>}
    </section>
  )
}
