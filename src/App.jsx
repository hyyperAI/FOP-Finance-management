import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { RequireAuth, RedirectIfAuthed } from './lib/auth.jsx'
import { RequireAdmin } from './components/auth/RequireAdmin.jsx'
import Login from './pages/auth/Login.jsx'
import Home from './pages/user/Home.jsx'
import ForgotPassword from './pages/auth/ForgotPassword.jsx'
import ResetPassword from './pages/auth/ResetPassword.jsx'
import Intake from './pages/user/Intake.jsx'
import Expense from './pages/user/Expense.jsx'
import Transactions from './pages/user/Transactions.jsx'
import TransactionDetail from './pages/user/TransactionDetail.jsx'
import TransactionEdit from './pages/user/TransactionEdit.jsx'
import Categories from './pages/user/Categories.jsx'
import CloseDay from './pages/user/CloseDay.jsx'
import Dashboard from './pages/user/Dashboard.jsx'
import Notifications from './pages/user/Notifications.jsx'

// Lazy-load admin pages to keep the main bundle small (Recharts is heavy).
const AdminDashboard         = lazy(() => import('./pages/admin/AdminDashboard.jsx'))
const AdminUsers             = lazy(() => import('./pages/admin/AdminUsers.jsx'))
const AdminUserNew           = lazy(() => import('./pages/admin/AdminUserNew.jsx'))
const AdminUserDetail        = lazy(() => import('./pages/admin/AdminUserDetail.jsx'))
const AdminUserCloseDay      = lazy(() => import('./pages/admin/AdminUserCloseDay.jsx'))
const AdminCategories        = lazy(() => import('./pages/admin/AdminCategories.jsx'))
const AdminTransactions      = lazy(() => import('./pages/admin/AdminTransactions.jsx'))
const AdminTransactionDetail = lazy(() => import('./pages/admin/AdminTransactionDetail.jsx'))
const AdminSearch            = lazy(() => import('./pages/admin/AdminSearch.jsx'))
const AdminReports           = lazy(() => import('./pages/admin/AdminReports.jsx'))
const AdminExports           = lazy(() => import('./pages/admin/AdminExports.jsx'))
const AdminStorage           = lazy(() => import('./pages/admin/AdminStorage.jsx'))
const AdminCron              = lazy(() => import('./pages/admin/AdminCron.jsx'))
const AdminBudgets           = lazy(() => import('./pages/admin/AdminBudgets.jsx'))
const AdminRecurring         = lazy(() => import('./pages/admin/AdminRecurring.jsx'))
const AdminAudit             = lazy(() => import('./pages/admin/AdminAudit.jsx'))

function AdminLoader() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-page p-8">
      <div className="rounded-lg border border-border bg-bg-surface p-8 text-center shadow-card">
        <p className="text-body-m text-text-tertiary">Loading admin…</p>
      </div>
    </main>
  )
}

const Wrap = (Comp) => (
  <Suspense fallback={<AdminLoader />}>
    <Comp />
  </Suspense>
)

export default function App() {
  return (
    <Routes>
      {/* Public routes - redirect to home if authenticated */}
      <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
      <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPassword /></RedirectIfAuthed>} />
      <Route path="/reset-password/:token" element={<RedirectIfAuthed><ResetPassword /></RedirectIfAuthed>} />

      {/* Protected routes - require authentication */}
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/intake/new" element={<RequireAuth><Intake /></RequireAuth>} />
      <Route path="/expense/new" element={<RequireAuth><Expense /></RequireAuth>} />
      <Route path="/transactions" element={<RequireAuth><Transactions /></RequireAuth>} />
      <Route path="/transactions/:id" element={<RequireAuth><TransactionDetail /></RequireAuth>} />
      <Route path="/transactions/:id/edit" element={<RequireAuth><TransactionEdit /></RequireAuth>} />
      <Route path="/categories" element={<RequireAuth><Categories /></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/close-day" element={<RequireAuth><CloseDay /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />

      {/* Admin routes - require authentication + ADMIN role */}
      <Route path="/admin/dashboard" element={<RequireAuth><RequireAdmin>{Wrap(AdminDashboard)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth><RequireAdmin>{Wrap(AdminUsers)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/users/new" element={<RequireAuth><RequireAdmin>{Wrap(AdminUserNew)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/users/:id" element={<RequireAuth><RequireAdmin>{Wrap(AdminUserDetail)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/users/:id/close-day" element={<RequireAuth><RequireAdmin>{Wrap(AdminUserCloseDay)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/categories" element={<RequireAuth><RequireAdmin>{Wrap(AdminCategories)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/transactions" element={<RequireAuth><RequireAdmin>{Wrap(AdminTransactions)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/transactions/:id" element={<RequireAuth><RequireAdmin>{Wrap(AdminTransactionDetail)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/search" element={<RequireAuth><RequireAdmin>{Wrap(AdminSearch)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/reports" element={<RequireAuth><RequireAdmin>{Wrap(AdminReports)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/exports" element={<RequireAuth><RequireAdmin>{Wrap(AdminExports)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/storage" element={<RequireAuth><RequireAdmin>{Wrap(AdminStorage)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/cron" element={<RequireAuth><RequireAdmin>{Wrap(AdminCron)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/budgets" element={<RequireAuth><RequireAdmin>{Wrap(AdminBudgets)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/recurring" element={<RequireAuth><RequireAdmin>{Wrap(AdminRecurring)}</RequireAdmin></RequireAuth>} />
      <Route path="/admin/audit" element={<RequireAuth><RequireAdmin>{Wrap(AdminAudit)}</RequireAdmin></RequireAuth>} />

      <Route path="*" element={<Login />} />
    </Routes>
  )
}
