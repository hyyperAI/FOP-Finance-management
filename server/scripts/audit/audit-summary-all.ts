// Full audit log summary (shows all actions, not just top 10)
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const a = await db.auditLog.groupBy({
    by: ['action'],
    _count: { action: true },
    orderBy: { _count: { action: 'desc' } },
  })
  console.log('FULL AUDIT COUNTS:')
  a.forEach((r) => console.log(`  ${r.action.padEnd(35)} ${r._count.action}`))
}
main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
