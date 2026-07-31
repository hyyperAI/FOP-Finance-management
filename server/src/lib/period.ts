/**
 * Period resolution helpers.
 *
 * The API accepts either a named period ("month", "year", etc.) plus optional
 * custom start/end dates. These helpers normalize that into a concrete
 * `[startDate, endDate]` Date range — always normalised to UTC midnight to
 * avoid timezone drift.
 *
 * All other period helpers (`currentPeriodKey`, `periodKey`, `periodKeyFor`)
 * are also defined here so server route files can import from a single
 * location.
 */

/**
 * Convert a YYYY-MM-DD string into a UTC Date at midnight.
 * Throws if invalid.
 */
function toUtcMidnight(yyyyMmDd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd)
  if (!m) throw new Error(`Invalid date string: ${yyyyMmDd}`)
  const [, y, mo, d] = m
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
}

/**
 * Format a Date as YYYY-MM-DD in UTC.
 */
function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

/**
 * Add `days` days to a UTC date, returning a new Date.
 */
function addDaysUtc(date, days) {
  const d = new Date(date.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

/**
 * Resolve a named period (or custom range) to a [startDate, endDate] pair.
 *
 * @param {'day'|'week'|'month'|'quarter'|'year'|'custom'} period
 * @param {string|null} startDateStr  YYYY-MM-DD (required when period=custom)
 * @param {string|null} endDateStr    YYYY-MM-DD (required when period=custom)
 * @returns {{ startDate: Date, endDate: Date }}
 */
export function resolvePeriod(period, startDateStr, endDateStr) {
  // Always anchored to "today" at UTC midnight.
  const now = new Date()
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )

  switch (period) {
    case 'day':
      return { startDate: todayUtc, endDate: todayUtc }

    case 'week': {
      // 7-day window ending today.
      const start = addDaysUtc(todayUtc, -6)
      return { startDate: start, endDate: todayUtc }
    }

    case 'month': {
      const start = new Date(
        Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1),
      )
      return { startDate: start, endDate: todayUtc }
    }

    case 'quarter': {
      const qStartMonth = Math.floor(todayUtc.getUTCMonth() / 3) * 3
      const start = new Date(
        Date.UTC(todayUtc.getUTCFullYear(), qStartMonth, 1),
      )
      return { startDate: start, endDate: todayUtc }
    }

    case 'year': {
      const start = new Date(Date.UTC(todayUtc.getUTCFullYear(), 0, 1))
      return { startDate: start, endDate: todayUtc }
    }

    case 'custom': {
      if (!startDateStr || !endDateStr) {
        throw new Error('Custom period requires startDate and endDate')
      }
      const start = toUtcMidnight(startDateStr)
      const end = toUtcMidnight(endDateStr)
      if (end < start) {
        throw new Error('endDate must be >= startDate')
      }
      return { startDate: start, endDate: end }
    }

    default:
      throw new Error(`Unsupported period: ${period}`)
  }
}

/**
 * Format a Date as the YYYY-MM month key used by budgets and periods.
 *   e.g. 2026-07-30 → "2026-07"
 */
export function periodKeyFor(date) {
  return toIsoDate(date).slice(0, 7)
}

/**
 * Current month's period key (YYYY-MM).
 */
export function currentPeriodKey() {
  return periodKeyFor(new Date())
}

/**
 * Same as periodKeyFor, but default export name.
 * Some callers import this with the alias `periodKey`.
 */
export const periodKey = periodKeyFor