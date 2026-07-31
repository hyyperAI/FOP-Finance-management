import { Modal } from './Modal.jsx'
import { PrimaryButton } from './PrimaryButton.jsx'
import { GhostButton } from './GhostButton.jsx'
import { InlineAlert } from './InlineAlert.jsx'

/**
 * ConfirmDialog — yes/no confirmation modal.
 * Per docs/design-system/components/08-components-feedback.md
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onConfirm: () => void
 *  - title, message
 *  - confirmLabel, cancelLabel
 *  - variant: 'danger' | 'primary' (color of confirm button)
 *  - warning: ReactNode (extra warning shown above the buttons)
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  warning,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4">
        {typeof message === 'string'
          ? <p className="text-body-m text-text-primary">{message}</p>
          : message}
        {warning}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <GhostButton onClick={onClose} fullWidth>{cancelLabel}</GhostButton>
          <PrimaryButton
            onClick={() => { onConfirm?.(); onClose?.() }}
            variant={variant === 'danger' ? 'expense' : 'primary'}
            fullWidth
          >
            {confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  )
}