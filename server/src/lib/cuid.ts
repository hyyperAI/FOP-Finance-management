// CUID generator for receipt filenames.
//
// Per docs/backend/features/07-receipts.md § 1.5: "(or use Prisma's built-in)".
// We can't use Prisma's Prisma.cuid here — it's only available inside the DB
// runtime, not from compiled Next.js client code (webpack can't bundle it).
// crypto.randomUUID() returns a UUID v4 string which is sufficient for unique
// filenames. The format key is then {YYYY}/{MM}/{uuid}.jpg.

import { randomUUID } from 'crypto'

export function cuid(): string {
  return randomUUID()
}
