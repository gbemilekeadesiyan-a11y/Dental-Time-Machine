/**
 * Every call to the backend lives here, nowhere else (CLAUDE.md section 11).
 * One function per section 7 endpoint. Dollar amounts come only from these responses.
 */

import type {
  CalculateRequest,
  CatalogItem,
  DemoResponse,
  DocumentReadResult,
  ErrorResponse,
  ExplainRequest,
  ExplainResponse,
  OptimizeRequest,
  OptimizeResult,
  ParseRequest,
  Procedure,
  Result,
} from './types'

const API_URL: string = (() => {
  const url = import.meta.env.VITE_API_URL
  if (!url) {
    throw new Error('VITE_API_URL is not set. Copy frontend/.env.example to frontend/.env.')
  }
  return url.replace(/\/+$/, '')
})()

const NETWORK_MESSAGE = "We couldn't reach the server. Please check your connection and try again."
const SERVER_MESSAGE = 'Something went wrong on our side. Please try again.'

/** A failed request. `message` is plain English and safe to show to the user. */
export class ApiError extends Error {
  /** HTTP status, or 0 when the server couldn't be reached. */
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** True when a request was cancelled on purpose (a newer one replaced it). */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export interface RequestOptions {
  /** Cancel the request, for example when a newer timeline move replaces it. */
  signal?: AbortSignal
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  return typeof body === 'object' && body !== null && typeof (body as ErrorResponse).detail === 'string'
}

async function request<T>(path: string, init: RequestInit, options: RequestOptions = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, signal: options.signal ?? null })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new ApiError(0, NETWORK_MESSAGE)
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const message = response.status < 500 && isErrorResponse(body) ? body.detail : SERVER_MESSAGE
    throw new ApiError(response.status, message)
  }

  // The backend validates every response against the section 6 models.
  return (await response.json()) as T
}

function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { method: 'GET' }, options)
}

function post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
  return request<T>(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    options,
  )
}

// ---------- section 7 endpoints ----------

/** GET /demo: Maya's procedures and plan. Every procedure starts locked. */
export function getDemo(options?: RequestOptions): Promise<DemoResponse> {
  return get<DemoResponse>('/demo', options)
}

/** GET /catalog: procedures the user can add, with default fees. */
export function getCatalog(options?: RequestOptions): Promise<CatalogItem[]> {
  return get<CatalogItem[]>('/catalog', options)
}

/** POST /calculate: what the plan pays and what you'll likely pay for one schedule. */
export function calculate(body: CalculateRequest, options?: RequestOptions): Promise<Result> {
  return post<Result>('/calculate', body, options)
}

/** POST /optimize: everything now versus the cheapest allowed schedule. */
export function optimize(body: OptimizeRequest, options?: RequestOptions): Promise<OptimizeResult> {
  return post<OptimizeResult>('/optimize', body, options)
}

/** POST /parse: turn a description of recommended care into procedures. FAKE in the MVP. */
export function parse(text: string, options?: RequestOptions): Promise<Procedure[]> {
  return post<Procedure[]>('/parse', { text } satisfies ParseRequest, options)
}

/** POST /explain: a plain-language explanation of an insurance term. FAKE in the MVP. */
export function explain(
  term: string,
  language = 'en',
  style = 'plain',
  options?: RequestOptions,
): Promise<ExplainResponse> {
  return post<ExplainResponse>('/explain', { term, language, style } satisfies ExplainRequest, options)
}

// ---------- documents (Chuks, feature/documents) ----------

const DOCUMENT_NAMES: Record<string, string> = {
  'application/pdf': 'document.pdf',
  'image/jpeg': 'document.jpg',
  'image/png': 'document.png',
}

/**
 * POST /read-document: read plan details and procedures from a pdf, jpg or png.
 * The result always goes to the confirm form, never straight into the estimate.
 * Sends a neutral file name so the user's own file name never leaves the browser.
 */
export function readDocument(file: File, options?: RequestOptions): Promise<DocumentReadResult> {
  const form = new FormData()
  form.append('file', file, DOCUMENT_NAMES[file.type] ?? 'document')
  // No Content-Type header: the browser sets the multipart boundary itself.
  return request<DocumentReadResult>('/read-document', { method: 'POST', body: form }, options)
}
