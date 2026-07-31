// Tail audit log
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const all = await db.auditLog.findMany({ orderBy: { occurredAt: 'desc' }, take: 10 })
  console.log('LAST 10 AUDIT ROWS:')
  all.forEach((r) => console.log(`  ${r.action.padEnd(35)} ${r.entityType.padEnd(15)} ${r.entityId.slice(0, 12)}...`))
}
main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
