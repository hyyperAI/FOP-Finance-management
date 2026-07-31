// /api/categories — GET (list) — user-scoped categories the current user
// has been assigned to. Per docs/backend/features/03-categories-user.md § 1.2.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth-guards'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

// --- GET /api/categories ---
// USER: returns only categories the user is assigned to
// ADMIN: returns all categories
export async function GET(_req: Request) {
  try {
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    let categories

    if (user.role === 'ADMIN') {
      // Admins see all categories
      categories = await db.category.findMany({
        where: { isActive: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
          icon: true,
        },
      })
    } else {
      // Regular users see only their assigned categories
      const assignments = await db.userCategory.findMany({
        where: { userId: user.id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              color: true,
              icon: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ category: { name: 'asc' } }],
      })

      categories = assignments
        .filter((a) => a.category.isActive)
        .map((a) => ({
          id: a.category.id,
          name: a.category.name,
          type: a.category.type,
          color: a.category.color,
          icon: a.category.icon,
        }))
    }

    return withCors(NextResponse.json({ categories }))
  } catch (err) {
    console.error('[GET /api/categories] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}