import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InviteMemberModal } from './InviteMemberModal'

import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL

const renderModal = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <InviteMemberModal isOpen orgSlug="acme" onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose }
}

describe('InviteMemberModal', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('offers only Admin and Member roles', () => {
    renderModal()

    const optionLabels = screen.getAllByRole('option').map((option) => option.textContent)
    expect(optionLabels).toEqual(['Member', 'Admin'])
  })

  it('rejects an empty email before submitting', async () => {
    const user = userEvent.setup()
    renderModal()

    // Empty is valid to the browser (the field is not required), so the form
    // submits and the component's own validation rejects it.
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
  })

  it('reveals a copyable invite link on success', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText('Email address'), 'new@acme.test')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    expect(await screen.findByDisplayValue(/\/invite\/inv_test_token/)).toBeInTheDocument()

    // userEvent.setup() provides a clipboard stub; copy writes the link into it.
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toContain('/invite/inv_test_token')
  })

  it('falls back to manual copy when the clipboard write fails', async () => {
    const user = userEvent.setup()
    // Force the copy to reject (e.g. insecure context / denied permission).
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    renderModal()

    await user.type(screen.getByLabelText('Email address'), 'new@acme.test')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    await screen.findByDisplayValue(/\/invite\/inv_test_token/)

    await user.click(screen.getByRole('button', { name: 'Copy link' }))

    expect(
      await screen.findByText(/select the link above and copy it manually/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument()
  })

  it('surfaces a server error when the invitee is already a member', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/orgs/:slug/invitations`, () =>
        HttpResponse.json(
          { error: { code: 'USER_ALREADY_MEMBER', message: 'This user is already a member.' } },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText('Email address'), 'existing@acme.test')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('This user is already a member.')).toBeInTheDocument()
  })

  it('sends the selected role in the request body', async () => {
    let body: { email: string; role: string } | null = null
    server.use(
      http.post(`${API_URL}/api/v1/orgs/:slug/invitations`, async ({ request }) => {
        body = (await request.json()) as { email: string; role: string }
        return HttpResponse.json(
          {
            invitation: {
              id: 'inv-x',
              email: body.email,
              role: body.role,
              status: 'PENDING',
              expiresAt: '2099-01-01T00:00:00Z',
              createdAt: '2024-01-01T00:00:00Z',
            },
            token: 'inv_test_token',
          },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText('Email address'), 'new@acme.test')
    await user.selectOptions(screen.getByLabelText('Role'), 'ADMIN')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    await waitFor(() => {
      expect(body).toEqual({ email: 'new@acme.test', role: 'ADMIN' })
    })
  })
})
