import { NavLink } from 'react-router-dom'
import { Home, ListTree, FolderTree, BarChart3, Coins, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'

import { useAuth } from '../../lib/auth.jsx'
import { useNotifications } from '../../lib/hooks/useNotifications.js'

const USER_TABS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/transactions', label: 'Transactions', Icon: ListTree },
  { to: '/categories', label: 'Categories', Icon: FolderTree },
  { to: '/dashboard', label: 'Dashboard', Icon: BarChart3 },
  { to: '/close-day', label: 'Close', Icon: Coins },
]

const ADMIN_TAB = { to: '/admin/dashboard', label: 'Admin', Icon: ShieldCheck }

/**
 * BottomTabBar — persistent mobile navigation.
 * Per docs/pages/04-home.md §4.4.
 *
 * - 5 user tabs always visible
 * - 1 admin tab conditionally appended when session.user.role === 'ADMIN'
 * - Home tab icon shows a small unread-count badge when > 0 (live from
 *   useNotifications hook, polled every 60s)
 */
export function BottomTabBar() {
  const { user } = useAuth()
  const { unreadCount } = useNotifications()

  const tabs = [...USER_TABS]
  if (user?.role === 'ADMIN') tabs.push(ADMIN_TAB)

  return (
    <nav
      role="tablist"
      aria-label="Primary"
      className="sticky bottom-0 z-sticky border-t border-border bg-bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex h-16 max-w-7xl items-stretch justify-around">
        {tabs.map(({ to, label, Icon, end }) => {
          const isHome = to === '/'
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                role="tab"
                className={({ isActive }) =>
                  clsx(
                    'flex h-full min-h-16 flex-col items-center justify-center gap-1',
                    'text-caption font-medium',
                    'focus:outline-none focus:ring-2 focus:ring-border-focus',
                    isActive ? 'text-brand-600' : 'text-text-tertiary hover:text-text-primary',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative inline-flex">
                      <Icon
                        className={clsx('h-6 w-6', isActive && 'text-brand-600')}
                        aria-hidden="true"
                      />
                      {isHome && unreadCount > 0 && (
                        <span
                          className="absolute -right-2 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold leading-none text-text-inverse"
                          aria-label={`${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </span>
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}