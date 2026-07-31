// Audit log summary
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const a = await db.auditLog.groupBy({ by: ['action'], _count: { action: true } })
  console.log('AUDIT COUNTS:')
  a.sort((x, y) => y._count.action - x._count.action).forEach((r) => console.log(`  ${r.action.padEnd(35)} ${r._count.action}`))
}
main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
