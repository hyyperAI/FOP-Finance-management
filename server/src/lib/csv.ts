// RFC 4180 CSV stringifier.
// Per docs/backend/features/11-exports-csv.md § 1.3.
//
// - Wraps fields in double quotes if they contain commas, quotes, or newlines
// - Escapes internal quotes by doubling them
// - Uses CRLF line endings (Excel-compatible)
//
// Designed to work both as a streaming helper (push row-by-row) and as a
// batched helper (concat many rows into one string for small exports).

const MUST_QUOTE = /[",\r\n]/

/**
 * Convert an array of rows into a CSV string.
 * Each row is an array of values (strings, numbers, booleans, Dates, or null/undefined).
 * Returns a single string with trailing CRLF.
 */
export function csvStringify(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  if (rows.length === 0) return ''
  return (
    rows
      .map((row) => row.map(escapeField).join(','))
      .join('\r\n') + '\r\n'
  )
}

/**
 * Convert a single row to a CSV line (with trailing CRLF).
 */
export function csvRow(row: ReadonlyArray<unknown>): string {
  return row.map(escapeField).join(',') + '\r\n'
}

/** Header row constant for the standard transactions export.
 *  Note: spec §1.2 omits `vendor`, but admin exports without it would be
 *  incomplete for reconciliation work. Added here as a deviation —
 *  recorded in docs/backend/features/M2.md. */
export const TRANSACTION_CSV_HEADERS = [
  'id',
  'type',
  'occurredAt',
  'postedAt',
  'postedByUsername',
  'postedByName',
  'categoryName',
  'subCategoryName',
  'amount',
  'currency',
  'paymentMethod',
  'vendor',
  'title',
  'description',
  'personName',
  'receiptUrl',
  'status',
  'version',
] as const

// --- internals ---

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s: string
  if (value instanceof Date) s = value.toISOString()
  else if (typeof value === 'object') {
    // Prisma Decimal etc. — use toString if available
    if (typeof (value as { toString?: () => string }).toString === 'function') {
      s = (value as { toString: () => string }).toString()
    } else {
      s = JSON.stringify(value)
    }
  } else {
    s = String(value)
  }
  if (MUST_QUOTE.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}