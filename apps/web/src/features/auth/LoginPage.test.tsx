import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from './context/AuthContext'
import { LoginPage } from './LoginPage'

import { pendingInviteStorage } from '@/lib/pending-invite'
import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL

const login = vi.fn()

const authValue = {
  user: null,
  accessToken: null,
  isInitializing: false,
  login,
  logout: vi.fn(),
  isAuthenticated: false,
}

function LocationProbe() {
  const location = useLocation()
  return <div>path:{location.pathname}</div>
}

type InitialEntry = { pathname: string; state?: unknown }

const renderPage = (entry: InitialEntry) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/invite/:token" element={<div>Invite page</div>} />
            <Route path="/register" element={<div>Register page</div>} />
            <Route path="/" element={<div>Dashboard home</div>} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

const loginSucceeds = () =>
  server.use(
    http.post(`${API_URL}/api/v1/auth/login`, () =>
      HttpResponse.json({
        accessToken: 'test-token',
        user: {
          id: 'user-1',
          email: 'me@example.com',
          name: 'Me',
          createdAt: '2024-01-01T00:00:00Z',
        },
      }),
    ),
  )

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Email'), 'me@example.com')
  await user.type(screen.getByLabelText('Password'), 'P@ssword123')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('LoginPage', () => {
  afterEach(() => {
    server.resetHandlers()
    login.mockClear()
    pendingInviteStorage.remove()
  })

  it('resumes a stashed invite after login and clears the stash', async () => {
    pendingInviteStorage.set('tok-123')
    loginSucceeds()
    const user = userEvent.setup()
    renderPage({ pathname: '/login' })

    await fillAndSubmit(user)

    expect(await screen.findByText('Invite page')).toBeInTheDocument()
    expect(screen.getByText('path:/invite/tok-123')).toBeInTheDocument()
    expect(pendingInviteStorage.get()).toBeNull()
  })

  it('redirects to the dashboard when there is no stashed invite or return path', async () => {
    loginSucceeds()
    const user = userEvent.setup()
    renderPage({ pathname: '/login' })

    await fillAndSubmit(user)

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
  })

  it('shows the password-reset banner only when navigated with that state', () => {
    renderPage({ pathname: '/login', state: { passwordReset: true } })

    expect(
      screen.getByText('Your password has been reset. Sign in with your new password.'),
    ).toBeInTheDocument()
  })

  it('does not show the password-reset banner on a normal visit', () => {
    renderPage({ pathname: '/login' })

    expect(
      screen.queryByText('Your password has been reset. Sign in with your new password.'),
    ).not.toBeInTheDocument()
  })

  it('shows the rate-limit message when the API returns 429', async () => {
    server.use(
      http.post(
        `${API_URL}/api/v1/auth/login`,
        () =>
          new HttpResponse(
            JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }),
            { status: 429, headers: { 'Retry-After': '60', 'Content-Type': 'application/json' } },
          ),
      ),
    )
    const user = userEvent.setup()
    renderPage({ pathname: '/login' })

    await fillAndSubmit(user)

    expect(await screen.findByText('Rate Limit Exceeded')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })
})
