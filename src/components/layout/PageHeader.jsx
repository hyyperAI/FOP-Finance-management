import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { IconButton } from '../ui/IconButton.jsx'

/**
 * PageHeader — minimal in-page header with back arrow + title + optional right action.
 * Used by Intake / Expense / etc. instead of the full TopBar (which has user menu).
 * Per docs/pages/05-intake-new.md §4.1, docs/pages/06-expense-new.md §4.1.
 */
export function PageHeader({ title, rightAction, fallbackPath = '/' }) {
  const navigate = useNavigate()
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(fallbackPath, { replace: true })
  }

  return (
    <header className="sticky top-0 z-sticky flex h-14 items-center justify-between border-b border-border bg-bg-surface px-2">
      <IconButton aria-label="Back" onClick={handleBack}>
        <ArrowLeft className="h-6 w-6" aria-hidden="true" />
      </IconButton>
      <h1 className="flex-1 text-center text-body-l font-semibold text-text-primary">{title}</h1>
      <div className="min-w-11">{rightAction}</div>
    </header>
  )
}