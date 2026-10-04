import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import Notice from '../../components/Notice'
import { warmUpPdf } from './documentPreview'

/** Matches the backend limit on POST /read-document (CLAUDE.md section 12: files 5 MB). */
export const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

const WRONG_TYPE = 'Please upload a PDF, JPG, or PNG file.'
export const TOO_LARGE = 'The file is too large. Please upload a file under 5 MB.'
const EMPTY = 'The file is empty. Please upload a PDF, JPG, or PNG file.'

interface Props {
  /** Called with a file of an accepted type. The parent shrinks and reads it. */
  onFile: (file: File) => void
  /** A problem from reading the last file, shown under the drop zone. */
  error?: string | null
}

/**
 * Drop zone plus a "Select file" button (the button is the keyboard and
 * screen-reader path; dragging is optional). Checks the file type and hands it
 * to the parent. The file stays in memory only.
 */
export default function DocumentUpload({ onFile, error: readError = null }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)
  const [typeError, setTypeError] = useState<string | null>(null)
  const error = typeError ?? readError

  useEffect(warmUpPdf, [])

  function handleFile(original: File | undefined) {
    if (!original) return
    setTypeError(null)
    // Let the same file be chosen again later.
    if (inputRef.current) inputRef.current.value = ''
    if (!ACCEPTED_TYPES.includes(original.type)) return setTypeError(WRONG_TYPE)
    if (original.size === 0) return setTypeError(EMPTY)
    onFile(original)
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={
          'relative overflow-hidden rounded-3xl border-2 border-dashed px-6 py-10 transition-colors ' +
          (dragging ? 'border-primary bg-primary/10' : 'border-primary/40 bg-primary/5')
        }
      >
        {/* Soft glow behind the file icon. Decorative only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-[8%] size-80 rounded-full bg-gradient-from/30 blur-3xl"
        />

        <div className="relative flex flex-col items-center gap-4 text-center">
          <div className="flex items-end gap-6">
            <FileBadge />
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadIcon className="size-5" />
            </span>
          </div>

          <p className="text-base font-medium text-ink">
            Drag and drop your file here or upload manually
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-describedby={hintId}
            className="btn-secondary min-w-44 border-white bg-card shadow-sm"
          >
            <UploadIcon />
            Select file
          </button>

          <p id={hintId} className="text-sm text-muted-text">
            Supported file types: PDF (.pdf), JPG (.jpg), PNG (.png). Up to 5 MB.
          </p>
        </div>
      </div>

      {error && <Notice tone="problem">{error}</Notice>}
    </div>
  )
}

// ---------- icons (decorative; the text next to them says the same thing) ----------

function UploadIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={`shrink-0 fill-none stroke-current ${className}`} strokeWidth="1.75">
      <path d="M8 10V2.5M5 5.5l3-3 3 3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A page with a "PDF" tag, like the reference design's file icon. */
function FileBadge() {
  return (
    <span aria-hidden="true" className="relative block h-16 w-13">
      <span className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-ink/10" />
      <span className="absolute top-8 right-2.5 left-2.5 space-y-1.5">
        <span className="block h-0.5 rounded bg-track" />
        <span className="block h-0.5 rounded bg-track" />
        <span className="block h-0.5 w-2/3 rounded bg-track" />
      </span>
      <span className="absolute top-2.5 -left-2 rounded-md bg-linear-to-br from-gradient-from to-gradient-to px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide text-white">
        PDF
      </span>
    </span>
  )
}
