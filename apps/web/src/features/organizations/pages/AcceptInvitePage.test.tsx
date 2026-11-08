import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AcceptInvitePage } from './AcceptInvitePage'

import { AuthContext } from '@/features/auth/context/AuthContext'
import { OrgProvider } from '@/features/organizations/context/OrgContext'
import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL
const TOKEN = 'the-token'

const authValue = (isAuthenticated: boolean) => ({
  user: isAuthenticated
    ? { id: 'test-user-id', email: 'me@example.com', name: 'Me', createdAt: '2024-01-01T00:00:00Z' }
    : null,
  accessToken: isAuthenticated ? 'test-token' : null,
  isInitializing: false,
  login: vi.fn(),
  logout: vi.fn(),
  isAuthenticated,
})

function LocationProbe() {
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
  return (
    <div>
      path:{location.pathname}
      {from ? ` from:${from}` : ''}
    </div>
  )
}

const renderPage = (isAuthenticated: boolean) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue(isAuthenticated)}>
        <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
          <OrgProvider>
            <Routes>
              <Route path="/invite/:token" element={<AcceptInvitePage />} />
              <Route path="/" element={<div>Dashboard home</div>} />
              <Route path="/login" element={<div>Login page</div>} />
              <Route path="/register" element={<div>Register page</div>} />
            </Routes>
            <LocationProbe />
          </OrgProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('AcceptInvitePage', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('renders the invitation preview from a valid token', async () => {
    renderPage(true)

    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Member')).toBeInTheDocument()
    expect(screen.getByText('invitee@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeInTheDocument()
  })

  it('prompts an unauthenticated visitor to sign in, carrying the return path', async () => {
    const user = userEvent.setup()
    renderPage(false)

    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign in to accept' }))

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(screen.getByText(`path:/login from:/invite/${TOKEN}`)).toBeInTheDocument()
  })

  it('sends the user to register with the return path when creating an account', async () => {
    const user = userEvent.setup()
    renderPage(false)

    await user.click(await screen.findByRole('button', { name: 'Create an account' }))

    expect(await screen.findByText('Register page')).toBeInTheDocument()
    expect(screen.getByText(`path:/register from:/invite/${TOKEN}`)).toBeInTheDocument()
  })

  it('accepts the invitation and navigates into the app', async () => {
    let acceptBody: { token?: string } | undefined
    server.use(
      http.post(`${API_URL}/api/v1/invitations/accept`, async ({ request }) => {
        acceptBody = (await request.json()) as { token?: string }
        return HttpResponse.json(
          {
            membership: { id: 'm1', role: 'MEMBER', userId: 'test-user-id' },
            organization: { id: 'org-id', name: 'Acme', slug: 'acme' },
          },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPage(true)

    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }))

    await waitFor(() => {
      expect(acceptBody).toEqual({ token: TOKEN })
    })
    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
  })

  it('shows a terminal message and no accept button for an expired invitation', async () => {
    server.use(
      http.get(`${API_URL}/api/v1/invitations/validate/:token`, () =>
        HttpResponse.json(
          { error: { code: 'INVITATION_EXPIRED', message: 'Invitation has expired' } },
          { status: 410 },
        ),
      ),
    )
    renderPage(true)

    expect(await screen.findByText('Invitation has expired')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument()
  })

  it('shows an invalid-link state for an unknown token', async () => {
    server.use(
      http.get(`${API_URL}/api/v1/invitations/validate/:token`, () =>
        HttpResponse.json(
          { error: { code: 'INVALID_TOKEN', message: 'Invalid invitation token' } },
          { status: 404 },
        ),
      ),
    )
    renderPage(false)

    expect(await screen.findByText("This invitation can't be used")).toBeInTheDocument()
    expect(screen.getByText('Invalid invitation token')).toBeInTheDocument()
  })

  it('offers a shortcut into the org when the user is already a member', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/invitations/accept`, () =>
        HttpResponse.json(
          { error: { code: 'USER_ALREADY_MEMBER', message: 'User is already a member' } },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage(true)

    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }))

    expect(
      await screen.findByText("You're already a member of this organization."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to organization' }))
    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
  })
})
