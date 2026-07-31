import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, User as UserIcon, Shield } from 'lucide-react'
import { IconButton } from '../ui/IconButton.jsx'

/**
 * TopBar — global nav + identity.
 * Per docs/pages/04-home.md §4.1.
 * Props:
 *  - appName: string (default 'FOP')
 *  - userName: string
 *  - isAdmin: boolean
 *  - unreadCount: number (bell badge)
 *  - onLogout: () => void
 *  - onSwitchToAdmin: () => void
 */
export function TopBar({
  appName = 'FOP',
  userName = 'Usman',
  isAdmin = false,
  unreadCount = 0,
  onLogout,
  onSwitchToAdmin,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-sticky h-14 border-b border-border bg-bg-surface">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        <Link to="/" className="text-body-l font-semibold text-text-primary">
          {appName}
        </Link>

        <div className="flex items-center gap-2">
          <IconButton aria-label="Notifications">
            <span className="relative">
              <Bell className="h-6 w-6" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger-500 px-1 text-caption font-semibold text-text-inverse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
          </IconButton>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-body-m font-medium text-text-primary hover:bg-bg-sunken focus:outline-none focus:ring-2 focus:ring-border-focus"
            >
              <span>{userName}</span>
              <ChevronDown className="h-5 w-5" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-12 z-modal w-48 overflow-hidden rounded-lg border border-border bg-bg-surface shadow-raised"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-body-m text-text-primary hover:bg-bg-sunken focus:outline-none focus:bg-bg-sunken"
                >
                  <UserIcon className="h-5 w-5" aria-hidden="true" />
                  Profile
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onSwitchToAdmin?.() }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-body-m text-text-primary hover:bg-bg-sunken focus:outline-none focus:bg-bg-sunken"
                  >
                    <Shield className="h-5 w-5" aria-hidden="true" />
                    Switch to admin
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onLogout?.() }}
                  className="flex w-full items-center gap-3 border-t border-border-subtle px-4 py-3 text-left text-body-m text-danger-700 hover:bg-danger-50 focus:outline-none focus:bg-danger-50"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}