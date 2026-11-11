import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CreateApiKeyModal } from './CreateApiKeyModal'

import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL

const renderModal = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <CreateApiKeyModal isOpen orgSlug="acme" onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose }
}

describe('CreateApiKeyModal', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('renders scope checkboxes with org:read pre-selected', () => {
    renderModal()

    const readOrg = screen.getByRole('checkbox', { name: /Read organization/ })
    expect(readOrg).toBeChecked()

    // All 9 scopes are offered.
    expect(screen.getAllByRole('checkbox')).toHaveLength(9)
  })

  it('rejects an empty name before submitting', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('button', { name: 'Create key' }))

    expect(await screen.findByText('API key name is required')).toBeInTheDocument()
  })

  it('rejects submitting with no scopes selected', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText('Name'), 'CI key')
    // Uncheck the only selected scope.
    await user.click(screen.getByRole('checkbox', { name: /Read organization/ }))
    await user.click(screen.getByRole('button', { name: 'Create key' }))

    expect(await screen.findByText('Select at least one scope')).toBeInTheDocument()
  })

  it('reveals the raw key on success and copies it', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText('Name'), 'CI key')
    await user.click(screen.getByRole('button', { name: 'Create key' }))

    expect(await screen.findByDisplayValue('mock-plaintext-api-key')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy key' }))
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe('mock-plaintext-api-key')
  })

  it('falls back to manual copy when the clipboard write fails', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    renderModal()

    await user.type(screen.getByLabelText('Name'), 'CI key')
    await user.click(screen.getByRole('button', { name: 'Create key' }))
    await screen.findByDisplayValue('mock-plaintext-api-key')

    await user.click(screen.getByRole('button', { name: 'Copy key' }))

    expect(
      await screen.findByText(/select the key above and copy it manually/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument()
  })

  it('surfaces a server error when creation fails', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/orgs/:slug/api-keys`, () =>
        HttpResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'That name is already taken.' } },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText('Name'), 'CI key')
    await user.click(screen.getByRole('button', { name: 'Create key' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('That name is already taken.')).toBeInTheDocument()
  })

  it('sends the selected name and scopes in the request body', async () => {
    let body: { name: string; scopes: string[] } | null = null
    server.use(
      http.post(`${API_URL}/api/v1/orgs/:slug/api-keys`, async ({ request }) => {
        body = (await request.json()) as { name: string; scopes: string[] }
        return HttpResponse.json(
          {
            id: 'k1',
            name: body.name,
            key: 'mock-plaintext-api-key',
            scopes: body.scopes,
            createdAt: '2024-01-01T00:00:00Z',
          },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText('Name'), 'CI key')
    await user.click(screen.getByRole('checkbox', { name: /Manage members/ }))
    await user.click(screen.getByRole('button', { name: 'Create key' }))

    await waitFor(() => {
      expect(body).toEqual({ name: 'CI key', scopes: ['org:read', 'members:write'] })
    })
  })
})
