import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from './context/AuthContext'
import { RegisterPage } from './RegisterPage'

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
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/invite/abc" element={<div>Invite page</div>} />
            <Route path="/" element={<div>Dashboard home</div>} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Full name'), 'New User')
  await user.type(screen.getByLabelText('Email'), 'new@example.com')
  await user.type(screen.getByLabelText('Password'), 'P@ssword123')
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('RegisterPage', () => {
  afterEach(() => {
    server.resetHandlers()
    login.mockClear()
  })

  const registerSucceeds = () =>
    server.use(
      http.post(`${API_URL}/api/v1/auth/register`, () =>
        HttpResponse.json({
          accessToken: 'test-token',
          user: {
            id: 'user-1',
            email: 'new@example.com',
            name: 'New User',
            createdAt: '2024-01-01T00:00:00Z',
          },
        }),
      ),
    )

  it('returns to the page the user came from after registering', async () => {
    registerSucceeds()
    const user = userEvent.setup()
    renderPage({ pathname: '/register', state: { from: { pathname: '/invite/abc' } } })

    await fillAndSubmit(user)

    expect(await screen.findByText('Invite page')).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith('test-token', expect.objectContaining({ id: 'user-1' }))
  })

  it('redirects to the dashboard when there is no return path', async () => {
    registerSucceeds()
    const user = userEvent.setup()
    renderPage({ pathname: '/register' })

    await fillAndSubmit(user)

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
  })
})
