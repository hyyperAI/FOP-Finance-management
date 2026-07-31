/**
 * Centralised formatting utilities for the FOP SPA.
 *
 * All money values arrive from the API as decimal strings (e.g. "1234.56").
 * Use parseMoney() to validate and convert for math.
 * Use formatPKR() to format for display only.
 *
 * All dates arrive as ISO strings. Parse with new Date(iso) then use the
 * helpers below to format for display.
 */

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** PKR formatter — rounds to 2 decimal places, no currency symbol */
const PKR = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/**
 * Format a money value (string or number) for display in PKR.
 * Pass the raw API value (e.g. "1234.56" or 1234.56).
 *
 * Usage:
 *   formatPKR(tx.amount)       // "1,234.56"
 *   formatPKR("0")            // "0"
 *   formatPKR(0)              // "0"
 *
 * NEVER use this for math — use parseMoney() instead.
 */
export function formatPKR(amount) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (!Number.isFinite(n)) return '—'
  return PKR.format(n)
}

/**
 * Validate and parse a decimal-string for math.
 * Returns { value: number, decimals: int, error: string|null }
 *
 * Usage:
 *   const { value, error } = parseMoney(raw)
 *   if (error) return showError(error)
 */
export function parseMoney(raw) {
  if (raw == null || raw === '') {
    return { value: null, decimals: 0, error: 'Amount is required' }
  }
  const cleaned = String(raw).replace(/,/g, '').trim()
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return { value: null, decimals: 0, error: 'Must be a positive number' }
  }
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n)) {
    return { value: null, decimals: 0, error: 'Must be a positive number' }
  }
  if (n <= 0) {
    return { value: null, decimals: 0, error: 'Must be greater than zero' }
  }
  const dot = cleaned.indexOf('.')
  const decimals = dot === -1 ? 0 : cleaned.length - dot - 1
  if (decimals > 2) {
    return { value: null, decimals, error: 'Max 2 decimal places' }
  }
  return { value: n, decimals, error: null }
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Parse an ISO datetime string to a local Date for display helpers. */
function toLocalDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d
}

/** "30 Jul 2026" — used in tables, list rows, close-day date chips */
export function formatDateMedium(iso) {
  const d = toLocalDate(iso)
  if (!d) return iso ?? '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "30/07/2026 14:23" — used in audit rows, edit history */
export function formatDateTime(iso) {
  const d = toLocalDate(iso)
  if (!d) return iso ?? '—'
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "30/07/2026" — used in close-day, admin filters */
export function formatDate(iso) {
  const d = toLocalDate(iso)
  if (!d) return iso ?? '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Relative / human-readable time (for notifications, audit timestamps).
 * "just now" | "5m ago" | "3h ago" | "yesterday" | "3d ago" | "15 Jun 2026"
 *
 * Usage:
 *   relativeTime(tx.createdAt)  // "2h ago"
 */
export function relativeTime(iso, now = Date.now()) {
  const d = toLocalDate(iso)
  if (!d) return '—'

  const diffMs = now - d.getTime()

  if (diffMs < 0) return formatDate(iso)
  if (diffMs < 60_000) return 'just now'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 24) return `${hours}h ago`

  const ONE_DAY = 86_400_000
  const days = Math.floor(diffMs / ONE_DAY)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`

  return formatDate(iso)
}
