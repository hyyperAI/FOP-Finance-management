// Quick DB inspection. Not part of the spec — only used during dev to verify
// rows were written. Run with: pnpm db:check
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const u = await db.user.findUnique({ where: { email: 'aisha@example.com' } })
  console.log('USER:', u ? `${u.id} ${u.email} active=${u.isActive} role=${u.role}` : 'NOT FOUND')

  const t = await db.passwordResetToken.findMany({ orderBy: { createdAt: 'desc' }, take: 3 })
  console.log(`TOKENS (${t.length}):`)
  t.forEach((row) => console.log(`  ${row.token}  expires=${row.expiresAt.toISOString()}  usedAt=${row.usedAt ?? '-'}  userId=${row.userId}`))

  const a = await db.auditLog.findMany({ orderBy: { occurredAt: 'desc' }, take: 10 })
  console.log(`AUDIT (${a.length}):`)
  a.forEach((r) => console.log(`  ${r.action.padEnd(30)} ${r.entityType}:${r.entityId}  ip=${r.ip ?? '-'}`))
}
main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1) })
