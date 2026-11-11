import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiKeysPage } from './ApiKeysPage'

import { AuthContext } from '@/features/auth/context/AuthContext'
import { OrgProvider } from '@/features/organizations/context/OrgContext'
import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL

const apiKeys = [
  {
    id: 'key-1',
    name: 'CI deploy key',
    scopes: ['org:read', 'members:read'],
    lastUsedAt: null,
    revokedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'key-2',
    name: 'Reporting key',
    scopes: ['org:read'],
    lastUsedAt: '2024-02-01T00:00:00Z',
    revokedAt: null,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
]

const meAs = (role: 'OWNER' | 'ADMIN' | 'MEMBER', userId: string) => ({
  id: userId,
  email: 'me@acme.test',
  name: 'Me',
  createdAt: '2024-01-01T00:00:00Z',
  memberships: [
    {
      id: `mem-${userId}`,
      role,
      organization: {
        id: 'org-1',
        name: 'Acme',
        slug: 'acme',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
  ],
})

const seedHandlers = (role: 'OWNER' | 'ADMIN' | 'MEMBER', userId: string, data = apiKeys) => {
  server.use(
    http.get(`${API_URL}/api/v1/auth/me`, () => HttpResponse.json(meAs(role, userId))),
    http.get(`${API_URL}/api/v1/orgs/:slug/api-keys`, () =>
      HttpResponse.json({ data, nextCursor: null }),
    ),
  )
}

const authValue = {
  user: {
    id: 'user-admin',
    email: 'me@acme.test',
    name: 'Me',
    createdAt: '2024-01-01T00:00:00Z',
  },
  accessToken: 'test-token',
  isInitializing: false,
  login: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: true,
}

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/orgs/acme/api-keys']}>
          <OrgProvider>
            <Routes>
              <Route path="/orgs/:orgSlug/api-keys" element={<ApiKeysPage />} />
            </Routes>
          </OrgProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('ApiKeysPage', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('renders the API key list', async () => {
    seedHandlers('ADMIN', 'user-admin')
    renderPage()

    expect(await screen.findByText('CI deploy key')).toBeInTheDocument()
    expect(screen.getByText('Reporting key')).toBeInTheDocument()
  })

  it('shows an access-denied state and hides controls from a plain member', async () => {
    seedHandlers('MEMBER', 'user-member')
    renderPage()

    expect(await screen.findByText("You don't have access")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create API key' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
    // The admin-only sidebar link is hidden for members.
    expect(screen.queryByRole('link', { name: 'API Keys' })).not.toBeInTheDocument()
  })

  it('revokes a key after confirmation', async () => {
    seedHandlers('ADMIN', 'user-admin')
    let deletedId: string | undefined
    server.use(
      http.delete(`${API_URL}/api/v1/orgs/:slug/api-keys/:keyId`, ({ params }) => {
        deletedId = params['keyId'] as string
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('CI deploy key')
    const row = screen.getByText('CI deploy key').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Revoke' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(deletedId).toBe('key-1')
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('surfaces a server error in the revoke dialog and keeps it open', async () => {
    seedHandlers('ADMIN', 'user-admin')
    server.use(
      http.delete(`${API_URL}/api/v1/orgs/:slug/api-keys/:keyId`, () =>
        HttpResponse.json(
          { error: { code: 'API_KEY_NOT_FOUND', message: 'API key not found.' } },
          { status: 404 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('CI deploy key')
    const row = screen.getByText('CI deploy key').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Revoke' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    expect(await screen.findByText('API key not found.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows an empty state with a create action for an admin', async () => {
    seedHandlers('ADMIN', 'user-admin', [])
    renderPage()

    expect(await screen.findByText('No API keys')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Create API key' }).length).toBeGreaterThan(0)
  })

  it('loads more keys when "Load more" is clicked', async () => {
    server.use(
      http.get(`${API_URL}/api/v1/auth/me`, () => HttpResponse.json(meAs('ADMIN', 'user-admin'))),
      http.get(`${API_URL}/api/v1/orgs/:slug/api-keys`, ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('cursor') === 'cursor-1') {
          return HttpResponse.json({ data: [apiKeys[1]], nextCursor: null })
        }
        return HttpResponse.json({ data: [apiKeys[0]], nextCursor: 'cursor-1' })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('CI deploy key')
    expect(screen.queryByText('Reporting key')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('Reporting key')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('shows a newly created key in the list', async () => {
    let createdName: string | null = null
    server.use(
      http.get(`${API_URL}/api/v1/auth/me`, () => HttpResponse.json(meAs('ADMIN', 'user-admin'))),
      http.get(`${API_URL}/api/v1/orgs/:slug/api-keys`, () =>
        HttpResponse.json({
          data: createdName
            ? [
                {
                  id: 'key-new',
                  name: createdName,
                  scopes: ['org:read'],
                  lastUsedAt: null,
                  revokedAt: null,
                  createdAt: '2024-01-05T00:00:00Z',
                  updatedAt: '2024-01-05T00:00:00Z',
                },
              ]
            : [],
          nextCursor: null,
        }),
      ),
      http.post(`${API_URL}/api/v1/orgs/:slug/api-keys`, async ({ request }) => {
        const body = (await request.json()) as { name: string; scopes: string[] }
        createdName = body.name
        return HttpResponse.json(
          {
            id: 'key-new',
            name: body.name,
            key: 'mock-plaintext-api-key',
            scopes: body.scopes,
            createdAt: '2024-01-05T00:00:00Z',
          },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('No API keys')
    const [createButton] = await screen.findAllByRole('button', { name: 'Create API key' })
    if (!createButton) {
      throw new Error('expected a create button')
    }
    await user.click(createButton)

    await user.type(screen.getByLabelText('Name'), 'Fresh key')
    await user.click(screen.getByRole('button', { name: 'Create key' }))

    // Success reveals the key; the list underneath refetches via invalidation.
    expect(await screen.findByText('Fresh key')).toBeInTheDocument()
  })
})
