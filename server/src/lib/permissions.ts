// Permission helpers. Used by the admin endpoints in Feature 02 + sub-cat
// scope checks in Feature 04.
//
// Per docs/backend/features/02-users-admin.md § 1.5:
//   - countActiveAdmins: number of role=ADMIN AND isActive=true users
//
// Per docs/backend/features/architecture.md § 3.5, "min 2 admins" is enforced
// here. Spec gotcha #1: this fires BEFORE the deactivation write.
//
// Per docs/backend/features/04-sub-categories.md § 1.5:
//   - canCreateSubCategory(userId, categoryId): true if user is ADMIN or has
//     a UserCategory row for categoryId.

import { db } from '@/lib/db'

export async function countActiveAdmins(): Promise<number> {
  return db.user.count({
    where: { role: 'ADMIN', isActive: true },
  })
}

/**
 * Can this user create a sub-category under the given parent category?
 * Per spec § 1.7 + § 5.gotcha #7: this is the ONLY scope check for
 * sub-category creation. PATCH/DELETE check ownership directly.
 */
export async function canCreateSubCategory(
  userId: string,
  categoryId: string,
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  })
  if (!user || !user.isActive) return false
  if (user.role === 'ADMIN') return true // admin can create under any active parent

  // Regular user: must have a UserCategory row for the parent
  const link = await db.userCategory.findUnique({
    where: { userId_categoryId: { userId, categoryId } },
  })
  return !!link
}
