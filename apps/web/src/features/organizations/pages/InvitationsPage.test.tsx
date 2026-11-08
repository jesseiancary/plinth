import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvitationsPage } from './InvitationsPage'

import { AuthContext } from '@/features/auth/context/AuthContext'
import { OrgProvider } from '@/features/organizations/context/OrgContext'
import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL

const invitations = [
  {
    id: 'inv-1',
    email: 'pending-admin@acme.test',
    role: 'ADMIN',
    status: 'PENDING',
    expiresAt: '2099-01-01T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'inv-2',
    email: 'pending-member@acme.test',
    role: 'MEMBER',
    status: 'PENDING',
    expiresAt: '2099-01-01T00:00:00Z',
    createdAt: '2024-01-02T00:00:00Z',
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

const seedHandlers = (role: 'OWNER' | 'ADMIN' | 'MEMBER', userId: string, data = invitations) => {
  server.use(
    http.get(`${API_URL}/api/v1/auth/me`, () => HttpResponse.json(meAs(role, userId))),
    http.get(`${API_URL}/api/v1/orgs/:slug/invitations`, () =>
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
        <MemoryRouter initialEntries={['/orgs/acme/invitations']}>
          <OrgProvider>
            <Routes>
              <Route path="/orgs/:orgSlug/invitations" element={<InvitationsPage />} />
            </Routes>
          </OrgProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('InvitationsPage', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('renders the pending invitations list', async () => {
    seedHandlers('ADMIN', 'user-admin')
    renderPage()

    expect(await screen.findByText('pending-admin@acme.test')).toBeInTheDocument()
    expect(screen.getByText('pending-member@acme.test')).toBeInTheDocument()
  })

  it('hides invite and revoke controls from a plain member', async () => {
    seedHandlers('MEMBER', 'user-member')
    renderPage()

    await screen.findByText('pending-admin@acme.test')

    expect(screen.queryByRole('button', { name: 'Invite member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
  })

  it('revokes an invitation after confirmation', async () => {
    seedHandlers('ADMIN', 'user-admin')
    let deletedId: string | undefined
    server.use(
      http.delete(`${API_URL}/api/v1/orgs/:slug/invitations/:invitationId`, ({ params }) => {
        deletedId = params['invitationId'] as string
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('pending-admin@acme.test')
    const row = screen.getByText('pending-admin@acme.test').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Revoke' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(deletedId).toBe('inv-1')
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('surfaces a server error in the revoke dialog and keeps it open', async () => {
    seedHandlers('ADMIN', 'user-admin')
    server.use(
      http.delete(`${API_URL}/api/v1/orgs/:slug/invitations/:invitationId`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'INVITATION_ALREADY_ACCEPTED',
              message: 'This invitation was already accepted.',
            },
          },
          { status: 410 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('pending-admin@acme.test')
    const row = screen.getByText('pending-admin@acme.test').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Revoke' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    expect(await screen.findByText('This invitation was already accepted.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows an empty state with an invite action for an admin', async () => {
    seedHandlers('ADMIN', 'user-admin', [])
    renderPage()

    expect(await screen.findByText('No pending invitations')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Invite member' }).length).toBeGreaterThan(0)
  })

  it('loads more invitations when "Load more" is clicked', async () => {
    server.use(
      http.get(`${API_URL}/api/v1/auth/me`, () => HttpResponse.json(meAs('ADMIN', 'user-admin'))),
      http.get(`${API_URL}/api/v1/orgs/:slug/invitations`, ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('cursor') === 'cursor-1') {
          return HttpResponse.json({ data: [invitations[1]], nextCursor: null })
        }
        return HttpResponse.json({ data: [invitations[0]], nextCursor: 'cursor-1' })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('pending-admin@acme.test')
    expect(screen.queryByText('pending-member@acme.test')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('pending-member@acme.test')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('shows a newly created invitation in the pending list', async () => {
    let createdEmail: string | null = null
    server.use(
      http.get(`${API_URL}/api/v1/auth/me`, () => HttpResponse.json(meAs('ADMIN', 'user-admin'))),
      http.get(`${API_URL}/api/v1/orgs/:slug/invitations`, () =>
        HttpResponse.json({
          data: createdEmail
            ? [
                {
                  id: 'inv-new',
                  email: createdEmail,
                  role: 'MEMBER',
                  status: 'PENDING',
                  expiresAt: '2099-01-01T00:00:00Z',
                  createdAt: '2024-01-05T00:00:00Z',
                },
              ]
            : [],
          nextCursor: null,
        }),
      ),
      http.post(`${API_URL}/api/v1/orgs/:slug/invitations`, async ({ request }) => {
        const body = (await request.json()) as { email: string; role: string }
        createdEmail = body.email
        return HttpResponse.json(
          {
            invitation: {
              id: 'inv-new',
              email: body.email,
              role: body.role,
              status: 'PENDING',
              expiresAt: '2099-01-01T00:00:00Z',
              createdAt: '2024-01-05T00:00:00Z',
            },
            token: 'inv_test_token',
          },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('No pending invitations')
    await user.click((await screen.findAllByRole('button', { name: 'Invite member' }))[0])

    await user.type(screen.getByLabelText('Email address'), 'fresh@acme.test')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    // Success state reveals the link, and the list underneath refetches via
    // invalidation to include the new pending invite.
    expect(await screen.findByText('fresh@acme.test')).toBeInTheDocument()
  })
})
