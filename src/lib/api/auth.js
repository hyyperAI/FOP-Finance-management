/**
 * Auth query helpers.
 *
 * These functions hit NextAuth's REST callbacks directly via fetch — no
 * `next-auth/react` SDK dependency, so the SPA stays framework-agnostic and
 * no React-only SDK needs to ship in the bundle.
 *
 * Endpoints used:
 *   - GET  /api/auth/csrf               → CSRF token for POST /signin
 *   - POST /api/auth/signin/credentials → credentials sign-in
 *   - POST /api/auth/signout            → sign-out
 *   - GET  /api/auth/session            → current session
 */

import { get, post } from '../api.js'

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

/**
 * Shape returned by getSession() and by the session from AuthProvider.
 * @typedef {Object} Session
 * @property {string} id
 * @property {'ADMIN'|'USER'} role
 * @property {boolean} isActive
 * @property {string} [email]
 * @property {string} [name]
 * @property {string} [username]
 */

// ---------------------------------------------------------------------------
// CSRF + NextAuth base URL
// ---------------------------------------------------------------------------

/**
 * NextAuth callbacks live under this prefix.  We use a relative path so it
 * works in dev (Vite proxy) and in prod (same-origin).
 */
const NEXTAUTH_PREFIX = '/api/auth'

/**
 * Credentials sign-in POST endpoint.
 *
 * NextAuth v4 quirks:
 *   - /api/auth/signin/credentials exists but only renders the form — it
 *     does NOT actually run the credentials provider.
 *   - The real credentials POST goes to /api/auth/callback/credentials
 *     which NextAuth internally dispatches to the credentials authorize().
 *   - The React SDK (`signIn('credentials', …)`) POSTs to /callback.
 */
const CREDENTIALS_PATH = `${NEXTAUTH_PREFIX}/callback/credentials`

async function getCsrfToken() {
  const res = await fetch(`${NEXTAUTH_PREFIX}/csrf`, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`Could not fetch CSRF token (HTTP ${res.status})`)
  }
  const data = await res.json()
  return data.csrfToken
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Sign in with username + password via NextAuth's credentials callback.
 *
 * The NextAuth POST /signin/credentials endpoint returns:
 *   - 200 with a Set-Cookie if credentials are valid (then 302 → /api/auth/callback)
 *   - 200 with a ?error=CredentialsSignin query param on failure
 *   - 401 on missing CSRF token
 *
 * We use a regular form-encoded POST (NOT JSON) because that's the only
 * shape NextAuth's credentials provider accepts.
 *
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function login({ username, password }) {
  let csrfToken
  try {
    csrfToken = await getCsrfToken()
  } catch (err) {
    return { ok: false, error: 'Could not reach the auth server.' }
  }

  const body = new URLSearchParams()
  body.set('csrfToken', csrfToken)
  body.set('username', username)
  body.set('password', password)
  body.set('callbackUrl', '/')
  body.set('json', 'true')

  let res
  try {
    res = await fetch(CREDENTIALS_PATH, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      redirect: 'manual',
    })
  } catch (err) {
    return { ok: false, error: 'Network error during sign-in.' }
  }

  // NextAuth returns 200 (with body) for any credentials attempt — even
  // failures. The response body contains `{"url": "...?error=CredentialsSignin"}`.
  // We try to parse that. If the URL contains ?error=… we treat as failure.
  let payload = {}
  try {
    const text = await res.text()
    payload = text ? JSON.parse(text) : {}
  } catch {
    // Non-JSON body — treat as best-effort based on URL
  }

  const errorParam = new URL(payload.url ?? '', 'http://placeholder').searchParams.get('error')
  if (errorParam) {
    return {
      ok: false,
      error:
        errorParam === 'CredentialsSignin'
          ? 'Invalid username or password.'
          : errorParam === 'UserInactiveError'
            ? 'Account is deactivated.'
            : 'Login failed. Please try again.',
    }
  }

  if (!res.ok) {
    return { ok: false, error: `Sign-in failed (HTTP ${res.status})` }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

/**
 * Sign out and redirect to /login.
 * NextAuth requires a CSRF token + form-encoded POST + redirect.
 */
export async function logout() {
  let csrfToken
  try {
    csrfToken = await getCsrfToken()
  } catch (err) {
    // Fall back to a plain redirect if we can't reach the server
    window.location.href = '/login'
    return
  }

  const body = new URLSearchParams()
  body.set('csrfToken', csrfToken)
  body.set('callbackUrl', '/login')
  body.set('json', 'true')

  try {
    await fetch(`${NEXTAUTH_PREFIX}/signout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
    })
  } catch {
    // ignore — we redirect anyway
  }
  window.location.href = '/login'
}

// ---------------------------------------------------------------------------
// Fetch session (used by AuthProvider)
// ---------------------------------------------------------------------------

/** GET /api/auth/session — returns {} when unauthed, { user } when authed */
export async function getSession() {
  try {
    const res = await fetch(`${NEXTAUTH_PREFIX}/session`, {
      credentials: 'include',
    })
    if (!res.ok) return {}
    const data = await res.json()
    return data?.user ? data : {}
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/** POST /api/auth/forgot-password */
export async function forgotPassword(email) {
  return post('/api/auth/forgot-password', { email })
  // Backend always returns 200 (anti-enumeration).
}

/** GET /api/auth/reset-password/:token */
export async function verifyResetToken(token) {
  const url = `/api/auth/reset-password/${encodeURIComponent(token)}`
  try {
    const data = await get(url)
    return { valid: true }
  } catch (err) {
    return { valid: false, error: err?.code ?? `HTTP ${err?.status}` }
  }
}

/** POST /api/auth/reset-password */
export async function resetPassword(token, newPassword) {
  return post('/api/auth/reset-password', { token, newPassword })
}