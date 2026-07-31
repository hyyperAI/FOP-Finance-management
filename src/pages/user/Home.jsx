// Home page (route `/`).
// Per docs/pages/04-home.md. Two large action buttons: Intake (green) + Expense (red).
// Wired to live session via AuthProvider; bell badge uses unread notifications count.

import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'

import { TopBar } from '../../components/layout/TopBar.jsx'
import { BottomTabBar } from '../../components/layout/BottomTabBar.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'

import { useAuth } from '../../lib/auth.jsx'
import { logout as logoutQuery } from '../../lib/api/auth.js'
import { useNotifications } from '../../lib/hooks/useNotifications.js'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { unreadCount } = useNotifications()

  const displayName =
    user?.name?.split(' ')[0] || user?.username || user?.email || ''

  const handleLogout = async () => {
    await logoutQuery()
  }

  const handleSwitchToAdmin = () => {
    navigate('/admin/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <TopBar
        appName="FOP"
        userName={displayName}
        isAdmin={user?.role === 'ADMIN'}
        unreadCount={unreadCount}
        onLogout={handleLogout}
        onSwitchToAdmin={handleSwitchToAdmin}
      />

      <main
        aria-label="Quick actions"
        className="flex flex-1 flex-col items-stretch justify-center gap-4 px-4 py-4 sm:items-center sm:px-6"
      >
        <div className="flex w-full max-w-2xl flex-1 flex-col gap-4">
          <PrimaryButton
            variant="intake"
            fullWidth
            type="button"
            aria-label="Log intake"
            onClick={() => navigate('/intake/new')}
            className="min-h-20 w-full flex-col gap-1 rounded-lg py-8 text-text-inverse shadow-card transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none"
          >
            <ArrowDownToLine className="h-8 w-8" aria-hidden="true" />
            <span className="text-h2 font-semibold tracking-wide">INTAKE</span>
            <span className="text-caption font-medium opacity-90">Money received</span>
          </PrimaryButton>

          <PrimaryButton
            variant="expense"
            fullWidth
            type="button"
            aria-label="Log expense"
            onClick={() => navigate('/expense/new')}
            className="min-h-20 w-full flex-col gap-1 rounded-lg py-8 text-text-inverse shadow-card transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none"
          >
            <ArrowUpFromLine className="h-8 w-8" aria-hidden="true" />
            <span className="text-h2 font-semibold tracking-wide">EXPENSE</span>
            <span className="text-caption font-medium opacity-90">Money paid</span>
          </PrimaryButton>
        </div>
      </main>

      <BottomTabBar />
    </div>
  )
}
