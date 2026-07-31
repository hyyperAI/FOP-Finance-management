import { forwardRef, useId, useState } from 'react'
import { Camera, X, Check } from 'lucide-react'
import clsx from 'clsx'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

function formatBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

/**
 * FileUpload — gallery-only receipt picker.
 * Per docs/design-system/components/file-upload.md
 * Client-side validation (JPG/PNG, ≤ 5 MB). Gallery only (no `capture` attr).
 *
 * Props:
 *  - label, helperText, error, required
 *  - value: { name, size, previewUrl } | null  (controlled)
 *  - onChange: ({ name, size, previewUrl } | null) => void
 *
 * For static UI: simulates upload (instant) and stores previewUrl = object URL.
 * Production: would replace `URL.createObjectURL` with a real signed-URL upload.
 */
export const FileUpload = forwardRef(function FileUpload(
  {
    label,
    helperText,
    error,
    required,
    value,
    onChange,
    id: idProp,
    className,
  },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [internalError, setInternalError] = useState('')
  const err = error || internalError

  const handleChange = (e) => {
    setInternalError('')
    const file = e.target.files?.[0]
    if (!file) {
      onChange?.(null)
      return
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setInternalError('Only JPG and PNG accepted.')
      return
    }
    if (file.size > MAX_BYTES) {
      setInternalError('File exceeds 5 MB limit.')
      return
    }
    const previewUrl = URL.createObjectURL(file)
    onChange?.({ name: file.name, size: file.size, previewUrl })
  }

  const clear = () => {
    setInternalError('')
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl)
    onChange?.(null)
  }

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {label && (
        <label htmlFor={id} className="text-body-m font-semibold text-text-primary">
          {label}
          {required && <span className="ml-1 text-danger-500" aria-hidden="true">*</span>}
        </label>
      )}

      {value ? (
        <div
          className={clsx(
            'flex items-center gap-3 rounded-lg border border-border bg-bg-surface p-3',
          )}
        >
          <img
            src={value.previewUrl}
            alt=""
            className="h-12 w-12 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-m font-medium text-text-primary">{value.name}</p>
            <p className="flex items-center gap-1 text-caption text-success-700">
              <Check className="h-4 w-4" aria-hidden="true" /> Uploaded · {formatBytes(value.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove receipt"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-sunken focus:outline-none focus:ring-2 focus:ring-border-focus"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={clsx(
            'flex h-28 cursor-pointer flex-col items-center justify-center gap-2',
            'rounded-lg border-2 border-dashed bg-bg-sunken text-text-secondary',
            'hover:border-brand-500 hover:text-brand-600',
            'focus-within:ring-2 focus-within:ring-border-focus',
            err ? 'border-danger-500' : 'border-border-strong',
          )}
        >
          <Camera className="h-7 w-7" aria-hidden="true" />
          <span className="text-body-m font-medium">Tap to attach a receipt</span>
          <span className="text-caption text-text-tertiary">JPG or PNG · max 5 MB</span>
          <input
            ref={ref}
            id={id}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={handleChange}
          />
        </label>
      )}

      {err && <p className="text-caption text-danger-700" role="alert">{err}</p>}
      {!err && helperText && (
        <p className="text-caption text-text-tertiary">{helperText}</p>
      )}
    </div>
  )
})