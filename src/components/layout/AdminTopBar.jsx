import { NavLink, useNavigate } from 'react-router-dom'
import { Shield, ArrowLeft } from 'lucide-react'
import { RoleBadge } from '../ui/RoleBadge.jsx'
import clsx from 'clsx'

const ADMIN_NAV = [
  { to: '/admin/dashboard',    label: 'Dashboard' },
  { to: '/admin/transactions', label: 'Transactions' },
  { to: '/admin/users',        label: 'Users' },
  { to: '/admin/categories',   label: 'Categories' },
  { to: '/admin/audit',        label: 'Audit' },
]

/**
 * AdminTopBar — title bar + admin nav strip + role badge.
 * Per docs/pages/13-admin-dashboard.md §1 + similar across admin pages.
 *
 * Props:
 *  - title: string
 *  - rightAction: ReactNode (slot for page-level actions)
 *  - back: string (path to navigate back to; omit to hide back arrow)
 *  - currentAdmin: { id, name } (shown in role badge)
 */
export function AdminTopBar({ title, rightAction, back, currentAdmin }) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-sticky border-b border-border bg-bg-surface">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          {back && (
            <button
              type="button"
              onClick={() => navigate(back)}
              aria-label="Back"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-secondary hover:bg-bg-sunken focus:outline-none focus:ring-2 focus:ring-border-focus"
            >
              <ArrowLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
          <div>
            <p className="text-caption font-medium uppercase tracking-wide text-text-tertiary">Admin</p>
            <h1 className="text-body-l font-semibold text-text-primary">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {rightAction}
          {currentAdmin && <RoleBadge role="admin" name={currentAdmin.name} />}
          {!currentAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-caption font-semibold text-brand-600">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Admin sub-nav (sticky strip) */}
      <nav
        role="navigation"
        aria-label="Admin sections"
        className="border-t border-border-subtle bg-bg-surface"
      >
        <ul className="mx-auto flex max-w-7xl items-stretch overflow-x-auto">
          {ADMIN_NAV.map((item) => (
            <li key={item.to} className="shrink-0">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'inline-flex h-11 items-center px-4 text-body-m font-medium',
                    'focus:outline-none focus:ring-2 focus:ring-border-focus',
                    isActive
                      ? 'border-b-2 border-brand-600 text-brand-600'
                      : 'border-b-2 border-transparent text-text-secondary hover:text-text-primary',
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}