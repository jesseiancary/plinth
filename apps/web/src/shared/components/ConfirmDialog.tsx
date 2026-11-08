import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { Button } from './Button'
import { Input } from './Input'
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
  /**
   * When provided, requires the user to type this exact phrase before the
   * confirm button is enabled — a guard for high-stakes actions (e.g. deleting
   * an organization by typing its slug).
   */
  confirmationPhrase?: string | undefined
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
  confirmationPhrase,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [confirmationInput, setConfirmationInput] = useState('')

  // Reset the typed confirmation whenever the dialog closes so it does not
  // leak into the next open.
  useEffect(() => {
    if (!isOpen) {
      setConfirmationInput('')
    }
  }, [isOpen])

  const phraseMatched = !confirmationPhrase || confirmationInput.trim() === confirmationPhrase
  const confirmDisabled = isPending || !phraseMatched

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="text-sm text-gray-600">{message}</div>

        {confirmationPhrase && (
          <Input
            label={`Type "${confirmationPhrase}" to confirm`}
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.currentTarget.value)}
            disabled={isPending}
            autoComplete="off"
          />
        )}

        {errorMessage && (
          <div className="rounded-md bg-red-50 p-3">
            <p className="text-sm text-danger">{errorMessage}</p>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={variant} onClick={onConfirm} disabled={confirmDisabled}>
            {isPending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
