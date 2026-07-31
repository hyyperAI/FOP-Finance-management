import clsx from 'clsx'

const pkr = new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 2 })

const variantClasses = {
  intake: 'text-success-700',
  expense: 'text-danger-700',
  neutral: 'text-text-primary',
}

/**
 * AmountDisplay — money amount with locked colors.
 * Per docs/design-system/foundations/color.md + components/12-components-domain.md
 *
 * Props:
 *  - amountPaisa: integer (in paisa — divide by 100 for PKR)
 *  - amountPkr: number (PKR decimal; pass one of these two)
 *  - signed: boolean (show + / - prefix)
 *  - variant: 'intake' | 'expense' | 'neutral'
 *  - size: 'sm' | 'md' | 'lg'
 */
export function AmountDisplay({
  amountPaisa,
  amountPkr,
  signed = false,
  variant = 'neutral',
  size = 'md',
  className,
}) {
  const value = amountPkr ?? (amountPaisa != null ? amountPaisa / 100 : 0)
  const formatted = pkr.format(Math.abs(value))
  const display = signed
    ? `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatted}`
    : formatted

  const sizeClass = {
    sm: 'text-body-m',
    md: 'text-body-l',
    lg: 'text-h3',
  }[size]

  return (
    <span className={clsx('tabular-nums font-semibold', sizeClass, variantClasses[variant], className)}>
      {display}
    </span>
  )
}