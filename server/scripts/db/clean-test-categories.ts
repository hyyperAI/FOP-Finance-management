// Clean up all test categories (keeps the 5 departments + aisha).
// FK-aware order: transactions → userCategory → subCategory → category
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const tx = await db.transaction.deleteMany({ where: { postedBy: { email: { not: 'aisha@example.com' } } } })
  const te = await db.transactionEdit.deleteMany({ where: { editedBy: { email: { not: 'aisha@example.com' } } } })
  const uc = await db.userCategory.deleteMany({})
  const sc = await db.subCategory.deleteMany({ where: { owner: { email: { not: 'aisha@example.com' } } } })
  const c = await db.category.deleteMany({})
  console.log(`cleaned: tx=${tx.count} txEdit=${te.count} userCategory=${uc.count} subCategory=${sc.count} category=${c.count}`)
}
main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
