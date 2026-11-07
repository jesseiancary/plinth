import type { ReactNode } from 'react'

import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  isPending?: boolean
  errorMessage?: string | undefined
  onConfirm: () => void
  onClose: () => void
}

/**
 * Confirmation dialog built on the shared Modal. Used for destructive or
 * irreversible actions (remove member, revoke key, delete org). Surfaces a
 * server error inline so the dialog stays open on failure.
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isPending = false,
  errorMessage,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="text-sm text-gray-600">{message}</div>

        {errorMessage && (
          <div className="rounded-md bg-red-50 p-3">
            <p className="text-sm text-danger">{errorMessage}</p>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={variant} onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
