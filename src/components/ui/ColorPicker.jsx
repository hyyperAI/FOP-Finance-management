import clsx from 'clsx'

const COLOR_TOKENS = [
  { name: 'Brand',   bg: 'bg-brand-500',   text: 'text-brand-700',   border: 'border-brand-500' },
  { name: 'Success', bg: 'bg-success-500', text: 'text-success-700', border: 'border-success-500' },
  { name: 'Danger',  bg: 'bg-danger-500',  text: 'text-danger-700',  border: 'border-danger-500' },
  { name: 'Warning', bg: 'bg-warning-500', text: 'text-warning-700', border: 'border-warning-500' },
  { name: 'Info',    bg: 'bg-info-500',    text: 'text-info-700',    border: 'border-info-500' },
  { name: 'Neutral', bg: 'bg-neutral-500', text: 'text-neutral-700', border: 'border-neutral-500' },
]

/**
 * ColorPicker — design-system color token grid.
 * Per docs/design-system/components/color-picker.md (simplified).
 *
 * Props:
 *  - value: string (token name, e.g. 'Brand')
 *  - onChange: (name) => void
 *  - label: string (optional)
 */
export function ColorPicker({ value, onChange, label }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-body-m font-semibold text-text-primary">{label}</p>}
      <div role="radiogroup" aria-label={label ?? 'Color'} className="flex flex-wrap gap-2">
        {COLOR_TOKENS.map((c) => (
          <button
            key={c.name}
            type="button"
            role="radio"
            aria-checked={value === c.name}
            aria-label={c.name}
            onClick={() => onChange?.(c.name)}
            className={clsx(
              'h-11 w-11 rounded-full border-2',
              c.bg,
              value === c.name ? 'ring-2 ring-offset-2 ring-border-focus' : 'border-transparent',
            )}
          />
        ))}
      </div>
    </div>
  )
}

export { COLOR_TOKENS }