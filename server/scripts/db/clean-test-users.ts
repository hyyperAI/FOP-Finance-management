// Clean up all non-bootstrap test data (FK-aware).
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  // Wipe transactions, edits, sub-cats posted by non-bootstrap actors
  const a0 = await db.transactionEdit.deleteMany({ where: { editedBy: { email: { not: 'aisha@example.com' } } } })
  const a1 = await db.transaction.deleteMany({ where: { postedBy: { email: { not: 'aisha@example.com' } } } })
  const a2 = await db.dailyClose.deleteMany({ where: { closedBy: { email: { not: 'aisha@example.com' } } } })
  const a3 = await db.subCategory.deleteMany({ where: { owner: { email: { not: 'aisha@example.com' } } } })
  const a4 = await db.userCategory.deleteMany({ where: { user: { email: { not: 'aisha@example.com' } } } })
  const a5 = await db.passwordResetToken.deleteMany({ where: { user: { email: { not: 'aisha@example.com' } } } })
  const a6 = await db.auditLog.deleteMany({ where: { actor: { email: { not: 'aisha@example.com' } } } })
  const a7 = await db.user.deleteMany({ where: { email: { not: 'aisha@example.com' } } })
  console.log(`cleaned: txEdit=${a0.count} tx=${a1.count} dailyClose=${a2.count} subCategory=${a3.count} userCategory=${a4.count} tokens=${a5.count} audit=${a6.count} users=${a7.count}`)
}
main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
