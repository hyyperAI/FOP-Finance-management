import { AlertTriangle, Info, CheckCircle2, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

const variantClasses = {
  warning: { wrap: 'border-warning-500 bg-warning-50 text-warning-700', Icon: AlertTriangle },
  info:    { wrap: 'border-info-500 bg-info-50 text-info-700',          Icon: Info },
  success: { wrap: 'border-success-500 bg-success-50 text-success-700', Icon: CheckCircle2 },
  danger:  { wrap: 'border-danger-500 bg-danger-50 text-danger-700',   Icon: AlertCircle },
}

/**
 * InlineAlert — page- or form-level alert.
 * Per docs/design-system/components/inline-alert.md
 *
 * Props:
 *  - variant: 'warning' | 'info' | 'success' | 'danger'
 *  - title: string
 *  - children
 *  - action: ReactNode (button row)
 *  - role: 'alert' | 'status' (defaults 'alert')
 */
export function InlineAlert({ variant = 'info', title, children, action, role = 'alert', className }) {
  const { wrap, Icon } = variantClasses[variant]
  return (
    <div
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      className={clsx('flex items-start gap-3 rounded-lg border p-4', wrap, className)}
    >
      <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        {title && <p className="text-body-m font-semibold">{title}</p>}
        {children && <div className="mt-1 text-caption">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  )
}