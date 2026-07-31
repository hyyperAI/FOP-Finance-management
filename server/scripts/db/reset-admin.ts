// Reset the bootstrap admin's password to a known value. Used by the test scripts.
// Run with: pnpm db:reset-admin
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const email = 'aisha@example.com'
  const newPassword = 'ChangeMe123'
  const passwordHash = await bcrypt.hash(newPassword, 12)
  const u = await db.user.update({
    where: { email },
    data: { passwordHash, isActive: true, role: 'ADMIN' },
  })
  console.log(`[reset-admin] ${u.email} → password="${newPassword}"`)
}
main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
