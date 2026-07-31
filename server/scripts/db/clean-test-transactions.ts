// Clean up test transactions, edits, daily closes (FK-aware).
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const e = await db.transactionEdit.deleteMany({})
  const t = await db.transaction.deleteMany({})
  const c = await db.dailyClose.deleteMany({})
  console.log(`cleaned: edits=${e.count} transactions=${t.count} dailyCloses=${c.count}`)
}
main().then(() => db.$disconnect()).catch((err) => { console.error(err); process.exit(1) })
