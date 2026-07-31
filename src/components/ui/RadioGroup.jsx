import clsx from 'clsx'

/**
 * RadioGroup — accessible radio button group.
 * Per docs/design-system/components/radio-group.md
 *
 * Props:
 *  - name: string (auto-generated if omitted)
 *  - label: string (group label)
 *  - value: current selected value
 *  - onChange: (value) => void
 *  - options: [{ value, label, description? }]
 *  - orientation: 'horizontal' | 'vertical' (default horizontal)
 */
export function RadioGroup({
  name,
  label,
  value,
  onChange,
  options = [],
  orientation = 'horizontal',
  className,
}) {
  const groupName = name || `radio-${Math.random().toString(36).slice(2, 9)}`

  return (
    <fieldset className={clsx('flex flex-col gap-2', className)}>
      {label && (
        <legend className="text-body-m font-semibold text-text-primary">{label}</legend>
      )}
      <div
        role="radiogroup"
        aria-label={label}
        className={clsx(
          'flex gap-2',
          orientation === 'horizontal' ? 'flex-col sm:flex-row' : 'flex-col',
        )}
      >
        {options.map((opt) => {
          const checked = opt.value === value
          return (
            <label
              key={opt.value}
              className={clsx(
                'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
                'min-h-11 transition-colors duration-150',
                checked
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-border-strong bg-bg-surface hover:border-brand-500',
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={opt.value}
                checked={checked}
                onChange={() => onChange?.(opt.value)}
                className="mt-0.5 h-4 w-4 cursor-pointer border-border-strong text-brand-600 focus:ring-2 focus:ring-border-focus"
              />
              <div className="flex flex-col">
                <span className="text-body-m font-medium text-text-primary">{opt.label}</span>
                {opt.description && (
                  <span className="text-caption text-text-tertiary">{opt.description}</span>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}