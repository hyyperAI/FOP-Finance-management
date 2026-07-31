// Seed script. Creates the 5 spec-defined departments + a bootstrap admin.
// Run with: pnpm --filter fop-server db:seed
//
// Per docs/flows/admin-flow.md §1, the bootstrap admin logs in and then
// immediately creates a 2nd admin via /admin/users/new. The "minimum 2 admins"
// rule (Feature 14) is enforced at the app layer (Feature 02), not here.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// Per docs/backend/features/03-categories-admin.md § 1.3, the 5 departments
// are seeded at install time. Spec didn't define descriptions, so we provide
// reasonable defaults.
const DEPARTMENTS = [
  { name: 'PRIVATE', description: 'Personal / household expenses' },
  { name: 'FINANCIAL', description: 'Financial instruments, fees, interest' },
  { name: 'EATING', description: 'Meals, groceries, dining out' },
  { name: 'KITCHEN', description: 'Kitchen supplies, equipment' },
  { name: 'CAFE', description: 'Cafe / coffee shop expenses' },
]

async function seedDepartments() {
  for (const d of DEPARTMENTS) {
    await db.department.upsert({
      where: { name: d.name },
      update: { description: d.description, isActive: true },
      create: { name: d.name, description: d.description, isActive: true },
    })
  }
  console.log(`[seed] Upserted ${DEPARTMENTS.length} departments.`)
}

async function seedBootstrapAdmin() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'aisha'
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'aisha@example.com'
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeMe123'
  const name = process.env.BOOTSTRAP_ADMIN_NAME ?? 'Aisha Admin'

  const existing = await db.user.findFirst({
    where: { OR: [{ email }, { username }] },
  })

  if (existing) {
    console.log(`[seed] Admin already exists: ${existing.email} — skipping.`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const admin = await db.user.create({
    data: {
      email,
      username,
      name,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log(`[seed] Created bootstrap admin:`)
  console.log(`       id:       ${admin.id}`)
  console.log(`       email:    ${admin.email}`)
  console.log(`       username: ${admin.username}`)
  console.log(`       password: ${password}  (CHANGE THIS IMMEDIATELY)`)
}

async function main() {
  await seedDepartments()
  await seedBootstrapAdmin()
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err)
    await db.$disconnect()
    process.exit(1)
  })
