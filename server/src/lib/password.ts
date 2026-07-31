// Password hashing. bcrypt cost 12 (non-negotiable per spec § 1.1 gotcha #9).
// We use bcryptjs (pure JS) so it works without native build tools on Windows.
import bcrypt from 'bcryptjs'

const COST = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export const BCRYPT_COST = COST
