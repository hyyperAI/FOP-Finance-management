import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import clsx from 'clsx'

/**
 * Modal — accessible dialog with focus trap.
 * Per docs/design-system/components/08-components-feedback.md
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - title: string
 *  - children
 *  - size: 'sm' | 'md' | 'lg' | 'fullscreen'
 *  - hideCloseButton: boolean
 */
export function Modal({ open, onClose, title, children, size = 'md', hideCloseButton = false }) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'

    // Focus the first focusable
    setTimeout(() => {
      const first = dialogRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
    }, 0)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previousFocusRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    fullscreen: 'max-w-none m-0 sm:m-4 w-full sm:max-w-4xl',
  }

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close overlay"
        onClick={onClose}
        className="absolute inset-0 bg-bg-overlay"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={clsx(
          'relative z-modal w-full rounded-lg bg-bg-surface shadow-overlay',
          sizeClasses[size],
        )}
      >
        {(title || !hideCloseButton) && (
          <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-6 py-4">
            {title && <h2 id="modal-title" className="text-h4 font-semibold text-text-primary">{title}</h2>}
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-sunken focus:outline-none focus:ring-2 focus:ring-border-focus"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}