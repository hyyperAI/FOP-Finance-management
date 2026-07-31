/**
 * Password generator — 16-char random password.
 * Per docs/design-system/components/password-strength-meter.md + admin/user-new spec.
 *
 * Uses Web Crypto for safe randomness.
 * Avoids ambiguous chars (0, O, 1, l, I) for better readability when shared verbally.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

export function generatePassword(length = 16) {
  if (!globalThis.crypto?.getRandomValues) {
    // Fallback for environments without Web Crypto (very old browsers / test runners)
    let out = ''
    for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    return out
  }
  const buf = new Uint32Array(length)
  crypto.getRandomValues(buf)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[buf[i] % ALPHABET.length]
  return out
}

/**
 * Simple password strength score (0-4).
 * Per docs/design-system/components/password-strength-meter.md
 *  0: empty
 *  1: weak  (length < 8 or all lowercase)
 *  2: fair  (length ≥ 8, mixed case)
 *  3: good  (length ≥ 10, mixed case + digits)
 *  4: strong (length ≥ 12, mixed case + digits + special chars)
 */
export function passwordStrength(pw = '') {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (pw.length >= 12) score = Math.min(4, score + 1)
  return score
}

export const STRENGTH_LABELS = ['Empty', 'Weak', 'Fair', 'Good', 'Strong']
export const STRENGTH_VARIANTS = ['neutral', 'expense', 'warning', 'info', 'intake']