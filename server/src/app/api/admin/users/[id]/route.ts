// /api/admin/users/[id] — GET (detail) + PATCH (update/deactivate)
// Per docs/backend/features/02-users-admin.md § 1.2.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth-guards'
import { countActiveAdmins } from '@/lib/permissions'
import { UpdateUserSchema } from '@/lib/validators/user'
import { serializeUserDetail } from '@/lib/serializers/user'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

// --- GET /api/admin/users/[id] ---
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const user = await db.user.findUnique({
      where: { id: params.id },
      include: {
        categories: {
          select: { category: { select: { id: true, name: true, type: true } } },
        },
      },
    })

    if (!user) {
      return withCors(NextResponse.json({ error: 'user_not_found' }, { status: 404 }))
    }

    return withCors(NextResponse.json(serializeUserDetail(user)))
  } catch (err) {
    console.error('[GET /api/admin/users/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

// --- PATCH /api/admin/users/[id] ---
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return withCors(NextResponse.json({ error: 'invalid_json' }, { status: 400 }))
    }
    const parsed = UpdateUserSchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    const target = await db.user.findUnique({
      where: { id: params.id },
      include: { categories: true },
    })
    if (!target) {
      return withCors(NextResponse.json({ error: 'user_not_found' }, { status: 404 }))
    }

    // Self-demotion guard (spec § 1.2 + gotcha #2)
    if (
      target.id === admin.id &&
      parsed.data.role !== undefined &&
      parsed.data.role !== 'ADMIN'
    ) {
      return withCors(NextResponse.json({ error: 'cannot_demote_self' }, { status: 403 }))
    }

    // Min-2-admin guard — fires BEFORE the deactivation write (gotcha #1)
    if (
      parsed.data.isActive === false &&
      target.role === 'ADMIN' &&
      target.isActive
    ) {
      const active = await countActiveAdmins()
      if (active <= 2) {
        return withCors(
          NextResponse.json(
            { error: 'last_admin_guard', message: 'At least 2 admins must remain active.' },
            { status: 409 },
          ),
        )
      }
    }

    // Duplicate check (gotcha #5: separate query, not inside a tx)
    if (parsed.data.email && parsed.data.email !== target.email) {
      const dupe = await db.user.findUnique({ where: { email: parsed.data.email } })
      if (dupe) {
        return withCors(NextResponse.json({ error: 'duplicate_email' }, { status: 409 }))
      }
    }
    if (parsed.data.username && parsed.data.username !== target.username) {
      const dupe = await db.user.findUnique({ where: { username: parsed.data.username } })
      if (dupe) {
        return withCors(NextResponse.json({ error: 'duplicate_username' }, { status: 409 }))
      }
    }

    // Category validation
    if (parsed.data.categoryIds && parsed.data.categoryIds.length > 0) {
      const found = await db.category.count({
        where: { id: { in: parsed.data.categoryIds } },
      })
      if (found !== parsed.data.categoryIds.length) {
        return withCors(NextResponse.json({ error: 'invalid_category_ids' }, { status: 400 }))
      }
    }

    const oldCategoryIds = target.categories.map((c) => c.categoryId)
    const newCategoryIds = parsed.data.categoryIds ?? oldCategoryIds
    const addedCategoryIds = newCategoryIds.filter((c) => !oldCategoryIds.includes(c))
    const removedCategoryIds = oldCategoryIds.filter((c) => !newCategoryIds.includes(c))

    const updated = await db.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: target.id },
        data: {
          email: parsed.data.email,
          username: parsed.data.username,
          name: parsed.data.name,
          phone: parsed.data.phone,
          role: parsed.data.role,
          isActive: parsed.data.isActive,
        },
      })

      if (parsed.data.categoryIds !== undefined) {
        // Gotcha #3: atomic sync — DELETE + INSERT in the same tx
        await tx.userCategory.deleteMany({ where: { userId: target.id } })
        if (newCategoryIds.length > 0) {
          await tx.userCategory.createMany({
            data: newCategoryIds.map((categoryId) => ({ userId: target.id, categoryId })),
          })
        }
      }

      // user.update OR user.deactivate audit
      const action =
        parsed.data.isActive === false && target.isActive
          ? 'user.deactivate'
          : 'user.update'

      await recordAudit(tx, {
        actorId: admin.id,
        action,
        entityType: 'User',
        entityId: target.id,
        before: { ...target, passwordHash: undefined, categories: undefined },
        after: { ...u, passwordHash: undefined },
        reason: action === 'user.deactivate' ? 'Deactivated by admin' : undefined,
      })

      // Separate category.assign audit (gotcha #4)
      if (addedCategoryIds.length > 0 || removedCategoryIds.length > 0) {
        await recordAudit(tx, {
          actorId: admin.id,
          action: 'category.assign',
          entityType: 'User',
          entityId: target.id,
          after: { addedCategoryIds, removedCategoryIds },
        })
      }

      return u
    })

    return withCors(NextResponse.json({ ...updated, passwordHash: undefined }))
  } catch (err) {
    console.error('[PATCH /api/admin/users/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
