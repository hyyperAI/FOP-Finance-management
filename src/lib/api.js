/**
 * Generic REST fetch wrapper for the FOP Next.js API server.
 *
 * All methods:
 *   - Use credentials: 'include' so the NextAuth httpOnly cookie is sent
 *   - Set Content-Type: application/json by default (overridden for multipart)
 *   - Use relative /api/... paths so they work in both dev (via Vite proxy)
 *     and prod (same-origin)
 *   - Parse JSON on 2xx, throw ApiError on non-2xx
 *   - Throw ApiError(status, code, fields?) so callers can surface per-field errors
 *
 * Auth-specific helpers (login, logout, getSession, forgotPassword,
 * resetPassword) live in src/lib/queries/auth.js instead of here to keep
 * this file focused on generic REST only.
 *
 * The Vite dev server proxies /api/* → backend, so all calls resolve to
 * the same origin in dev and the NextAuth cookie behaves identically to prod.
 */

const BASE_URL = '' // empty = relative; Vite proxy rewrites to the backend in dev

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

/**
 * Standard FOP error thrown by all api methods on non-2xx responses.
 *
 * status    — raw HTTP status code
 * code      — machine-readable error code string (e.g. 'validation_error')
 * fields    — optional per-field Zod errors { fieldName: string[] }
 * message   — optional human-readable fallback message
 */
export class ApiError extends Error {
  constructor(status, code, fields, message) {
    super(message || code)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    /** @type {Record<string, string[]>|undefined} */
    this.fields = fields
  }
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/** JSON-decode a response, returning null on empty-body 204. */
async function parseJson(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

/**
 * Build the final ApiError from a non-ok response, pulling fields from the
 * standard { error, fields? } envelope whenever possible.
 */
function toApiError(res, body) {
  const status = res.status
  if (body && typeof body === 'object') {
    const code = body.error || `HTTP_${status}`
    const fields = body.fields
    const message = body.message
    return new ApiError(status, code, fields, message)
  }
  return new ApiError(status, `HTTP_${status}`, undefined, `HTTP ${status}`)
}

// ---------------------------------------------------------------------------
// Generic REST methods
// ---------------------------------------------------------------------------

/** GET — returns parsed JSON */
export async function get(path) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status === 204) return null
  const body = await parseJson(res)
  if (!res.ok) throw toApiError(res, body)
  return body
}

/** POST — sends JSON body, returns parsed JSON */
export async function post(path, body) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 204) return null
  const parsed = await parseJson(res)
  if (!res.ok) throw toApiError(res, parsed)
  return parsed
}

/** PATCH — sends JSON body, returns parsed JSON */
export async function patch(path, body) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 204) return null
  const parsed = await parseJson(res)
  if (!res.ok) throw toApiError(res, parsed)
  return parsed
}

/** PUT — sends JSON body, returns parsed JSON */
export async function put(path, body) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 204) return null
  const parsed = await parseJson(res)
  if (!res.ok) throw toApiError(res, parsed)
  return parsed
}

/** DELETE — optionally sends JSON body, returns parsed JSON */
export async function del(path, body) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (res.status === 204) return null
  const parsed = await parseJson(res)
  if (!res.ok) throw toApiError(res, parsed)
  return parsed
}

// ---------------------------------------------------------------------------
// Blob methods — for PDF / CSV downloads
// ---------------------------------------------------------------------------

/** GET — returns raw Blob. Use when the response is binary (pdf, csv, image). */
export async function getBlob(path) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await parseJson(res)
    throw toApiError(res, body)
  }
  return res.blob()
}

/** POST — sends JSON body, returns raw Blob. */
export async function postBlob(path, body) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const parsed = await parseJson(res)
    throw toApiError(res, parsed)
  }
  return res.blob()
}

// ---------------------------------------------------------------------------
// Multipart upload helper
// ---------------------------------------------------------------------------

/**
 * Upload a file via multipart/form-data.
 * The file must be a File/Blob attached to the field name 'receipt'.
 * Returns the parsed JSON response body (typically { key: "uploads/..." }).
 */
export async function uploadReceipt(file) {
  const fd = new FormData()
  fd.append('receipt', file)

  const res = await fetch(`${BASE_URL}/api/upload/receipt`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
    // Do NOT set Content-Type — the browser sets the multipart boundary
  })

  const body = await parseJson(res)
  if (!res.ok) throw toApiError(res, body)
  return body
}

// ---------------------------------------------------------------------------
// Named convenience object (backward-compatible alias)
// ---------------------------------------------------------------------------

/**
 * api — convenience object mirroring the original serverApi shape
 * so callers can migrate incrementally.
 *
 * auth-specific methods (signIn, signOut, getSession, etc.) have been
 * moved to src/lib/queries/auth.js. Import from there instead:
 *
 *   import { login, logout, getSession, forgotPassword, resetPassword } from './queries/auth.js'
 */
export const api = { get, post, patch, put, del, getBlob, postBlob, uploadReceipt, BASE_URL }
