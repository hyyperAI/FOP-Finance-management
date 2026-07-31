// In-memory rate limiter. Per docs/backend/features/01-auth.md gotcha #6
// (limit by IP, not by user — attackers don't have accounts yet).
//
// Production note: swap the Map for Redis (Upstash free tier) by replacing
// `store` with a Redis adapter. The interface (`isRateLimited`, `recordFailedAttempt`,
// `clearRateLimit`) is the only surface the rest of the code uses.

const FAILED_LOGIN_LIMIT = 5
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

interface Bucket {
  count: number
  firstAt: number
}

// Single-process map. Sufficient for a single Node process / dev.
// Not shared across multiple Next.js instances — upgrade to Redis for prod.
const store = new Map<string, Bucket>()

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

function isExpired(bucket: Bucket, now: number): boolean {
  return now - bucket.firstAt > FAILED_LOGIN_WINDOW_MS
}

export function isRateLimited(key: string): boolean {
  if (process.env.RATE_LIMIT_DISABLED === '1') return false
  const now = Date.now()
  const bucket = store.get(key)
  if (!bucket) return false
  if (isExpired(bucket, now)) {
    store.delete(key)
    return false
  }
  return bucket.count >= FAILED_LOGIN_LIMIT
}

export function recordFailedAttempt(key: string): void {
  if (process.env.RATE_LIMIT_DISABLED === '1') return
  const now = Date.now()
  const bucket = store.get(key)
  if (!bucket || isExpired(bucket, now)) {
    store.set(key, { count: 1, firstAt: now })
    return
  }
  bucket.count += 1
  store.set(key, bucket)
}

export function clearRateLimit(key: string): void {
  store.delete(key)
}

// Convenience: build the standard key from a Request.
export function loginKey(req: Request): string {
  return `login:${getClientIp(req)}`
}

export function forgotPasswordKey(req: Request): string {
  return `forgot-password:${getClientIp(req)}`
}

export const RATE_LIMITS = {
  FAILED_LOGIN_LIMIT,
  FAILED_LOGIN_WINDOW_MS,
} as const
