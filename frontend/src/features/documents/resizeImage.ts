/**
 * Shrink photos in the browser before upload (CLAUDE.md section 10: "resized in browser").
 * PDFs and images that are already small pass through unchanged.
 * Everything happens in memory: nothing is stored.
 */

/** Longest side, in pixels, that still keeps small print on a benefits page readable. */
const MAX_SIDE = 2000

export async function resizeImage(file: File): Promise<File> {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Unreadable in this browser: send the original and let the server decide.
    return file
  }

  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    // Photos of paper compress far better as JPEG than PNG.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], 'document.jpg', { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}
