import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { RegisterPage } from './RegisterPage'

import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
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
  })

  it('shows a check-your-email confirmation after registering (no auto-login)', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/auth/register`, () =>
        HttpResponse.json(
          {
            message: 'Account created. Check your email to verify your address before logging in.',
          },
          { status: 201 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user)

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    // The submitted email is echoed back in the confirmation copy.
    expect(screen.getByText('new@example.com')).toBeInTheDocument()
  })

  it('shows an error message when registration fails', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/auth/register`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'REGISTRATION_FAILED',
              message: 'Registration failed. Please try again.',
            },
          },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user)

    expect(await screen.findByText('Registration failed. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument()
  })

  it('shows the rate-limit message when the API returns 429', async () => {
    server.use(
      http.post(
        `${API_URL}/api/v1/auth/register`,
        () =>
          new HttpResponse(
            JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }),
            { status: 429, headers: { 'Retry-After': '60', 'Content-Type': 'application/json' } },
          ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user)

    expect(await screen.findByText('Rate Limit Exceeded')).toBeInTheDocument()
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument()
  })
})
