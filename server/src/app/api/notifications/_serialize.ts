// Shared serializer for the notifications endpoints (Feature 18).
// Maps DB row → user-facing shape (id, type, title, message, link, ...).
// Pure functions so they can be tested in isolation (per spec § 6 unit tests).

interface RawAlert {
  id: string
  type: string
  payload: string // JSON-serialized
  isRead: boolean
  createdAt: Date
  readAt: Date | null
}

interface Payload {
  categoryId?: string
  categoryName?: string
  periodKey?: string
  percentUsed?: number
  amount?: string
  limit?: string
  transactionId?: string
  date?: string
  [key: string]: unknown
}

function parsePayload(raw: string): Payload {
  try {
    return JSON.parse(raw) as Payload
  } catch {
    return {}
  }
}

/** Map Alert.type + payload → user-facing title. */
export function deriveTitle(type: string, payload: Payload): string {
  switch (type) {
    case 'BUDGET_THRESHOLD_80':
      return `${payload.categoryName ?? 'Category'} budget at ${payload.percentUsed ?? 0}%`
    case 'BUDGET_EXCEEDED_100':
      return `${payload.categoryName ?? 'Category'} budget exceeded`
    case 'ANOMALY_AMOUNT':
      return 'Unusual transaction detected'
    case 'MISSING_DAILY_CLOSE':
      return 'Daily close pending'
    case 'PERIOD_NOT_CLOSED':
      return `Period ${payload.periodKey ?? ''} not closed`
    default:
      return 'Notification'
  }
}

/** Map Alert.type + payload → user-facing message. */
export function deriveMessage(type: string, payload: Payload): string {
  switch (type) {
    case 'BUDGET_THRESHOLD_80':
      return `${payload.categoryName ?? 'Category'} expenses for ${payload.periodKey ?? ''} reached ${payload.percentUsed ?? 0}% of the ${payload.limit ?? '0'} ${payload.currency ?? 'PKR'} budget.`
    case 'BUDGET_EXCEEDED_100':
      return `${payload.categoryName ?? 'Category'} expenses for ${payload.periodKey ?? ''} reached ${payload.percentUsed ?? 0}% of the ${payload.limit ?? '0'} ${payload.currency ?? 'PKR'} budget (${payload.amount ?? '0'} spent).`
    case 'ANOMALY_AMOUNT':
      return `A transaction of ${payload.amount ?? '?'} PKR is more than 3× your typical amount for ${payload.categoryName ?? 'this category'}.`
    case 'MISSING_DAILY_CLOSE':
      return `You have not closed the day for ${payload.date ?? 'today'}.`
    case 'PERIOD_NOT_CLOSED':
      return `Period ${payload.periodKey ?? ''} has transactions but was not closed.`
    default:
      return ''
  }
}

/** Map Alert.type + payload → app navigation link. */
export function deriveLink(type: string, payload: Payload): string {
  switch (type) {
    case 'BUDGET_THRESHOLD_80':
    case 'BUDGET_EXCEEDED_100':
      return `/dashboard?category=${payload.categoryId ?? ''}&period=${payload.periodKey ?? ''}`
    case 'ANOMALY_AMOUNT':
      return `/transactions/${payload.transactionId ?? ''}`
    case 'MISSING_DAILY_CLOSE':
      return `/close-day?date=${payload.date ?? ''}`
    case 'PERIOD_NOT_CLOSED':
      return `/admin/period-lock?period=${payload.periodKey ?? ''}`
    default:
      return '/dashboard'
  }
}

/** Serialize a DB alert row → API response shape. */
export function serializeAlert(a: RawAlert) {
  const payload = parsePayload(a.payload)
  return {
    id: a.id,
    type: a.type,
    title: deriveTitle(a.type, payload),
    message: deriveMessage(a.type, payload),
    payload,
    link: deriveLink(a.type, payload),
    isRead: a.isRead,
    createdAt: a.createdAt.toISOString(),
    readAt: a.readAt?.toISOString() ?? null,
  }
}
