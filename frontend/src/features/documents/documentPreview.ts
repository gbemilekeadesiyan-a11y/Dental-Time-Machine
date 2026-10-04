/**
 * A picture of the uploaded document for the reading and reveal animation.
 * Photos are shown as they are. PDFs get page 1 drawn with pdf.js (loaded only
 * when someone uploads a PDF). Everything stays in the browser: nothing is
 * uploaded or saved. Call URL.revokeObjectURL on the result when done.
 */

/** Wide enough to stay sharp in the stage, small enough to draw fast. */
const PDF_RENDER_WIDTH = 1000

export async function makePreviewUrl(file: File): Promise<string | null> {
  try {
    if (file.type === 'image/jpeg' || file.type === 'image/png') return URL.createObjectURL(file)
    if (file.type === 'application/pdf') return await renderFirstPdfPage(file)
  } catch {
    // A preview is a nice-to-have: the reveal shows a plain card instead.
  }
  return null
}

/** Start loading pdf.js early (when the upload box shows) so the first PDF preview is quick. */
export function warmUpPdf(): void {
  void loadPdfjs().catch(() => undefined)
}

async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

async function renderFirstPdfPage(file: File): Promise<string | null> {
  const pdfjs = await loadPdfjs()

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: PDF_RENDER_WIDTH / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, viewport }).promise
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    return blob ? URL.createObjectURL(blob) : null
  } finally {
    await task.destroy()
  }
}
