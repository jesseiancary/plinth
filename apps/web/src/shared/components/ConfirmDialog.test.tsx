import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('does not render when closed', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Remove member"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByText('Remove member')).not.toBeInTheDocument()
  })

  it('renders title and message when open', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Remove member"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Remove member')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        isOpen
        title="Remove member"
        message="Are you sure?"
        confirmLabel="Remove"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onClose when the cancel button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        isOpen
        title="Remove member"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('disables both buttons and shows working state while pending', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Remove member"
        message="Are you sure?"
        confirmLabel="Remove"
        isPending
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('surfaces an error message when provided', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Remove member"
        message="Are you sure?"
        errorMessage="This is the only owner."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('This is the only owner.')).toBeInTheDocument()
  })

  it('keeps confirm disabled until the confirmation phrase is typed exactly', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        isOpen
        title="Delete organization"
        message="This cannot be undone."
        confirmLabel="Delete organization"
        confirmationPhrase="acme"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    )

    const confirmButton = screen.getByRole('button', { name: 'Delete organization' })
    expect(confirmButton).toBeDisabled()

    const input = screen.getByLabelText('Type "acme" to confirm')
    await user.type(input, 'acm')
    expect(confirmButton).toBeDisabled()

    await user.type(input, 'e')
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
