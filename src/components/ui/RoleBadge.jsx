import { Shield, User as UserIcon } from 'lucide-react'
import clsx from 'clsx'

const variantClasses = {
  admin: { wrap: 'bg-brand-50 text-brand-600',     Icon: Shield },
  user:  { wrap: 'bg-neutral-100 text-text-secondary', Icon: UserIcon },
}

/**
 * RoleBadge — shows whether a user is admin or regular user.
 * Used in admin tables, audit log actor column, etc.
 */
export function RoleBadge({ role = 'user', name, className }) {
  const v = variantClasses[role] ?? variantClasses.user
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
        'text-caption font-semibold',
        v.wrap,
        className,
      )}
    >
      <v.Icon className="h-4 w-4" aria-hidden="true" />
      <span>{name ? `${name} · ${role}` : role}</span>
    </span>
  )
}