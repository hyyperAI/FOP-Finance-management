// User response serializers. Centralized so /api/admin/users GET and
// /api/admin/users/[id] GET return the same shape.
//
// Per spec gotcha § 5.1: `passwordHash` is NEVER exposed.

export interface SerializedUser {
  id: string
  username: string
  email: string
  name: string
  phone: string | null
  role: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  categoryIds?: string[]
  categories?: Array<{ id: string; name: string; type: string }>
}

export type UserWithRelations = {
  id: string
  username: string
  email: string
  name: string
  phone: string | null
  role: string
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  passwordHash?: string
  // For GET /users (list) — just ids
  categories?: Array<{ categoryId: string }>
  // For GET /users/[id] (detail) — full objects
  // (Prisma returns them when included with `select: { category: { select: { id, name, type }}}`)
}

export function serializeUserListItem(u: UserWithRelations): SerializedUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    categoryIds: u.categories ? u.categories.map((c) => c.categoryId) : [],
  }
}

// Used by GET /api/admin/users/[id] — categories are joined objects, not ids.
export type UserWithCategoryJoins = UserWithRelations & {
  categories: Array<{ category: { id: string; name: string; type: string } }>
}

export function serializeUserDetail(u: UserWithCategoryJoins): SerializedUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    categories: u.categories.map((c) => c.category),
  }
}
