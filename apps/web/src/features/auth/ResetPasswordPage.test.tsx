import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { ResetPasswordPage } from './ResetPasswordPage'

import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL

const renderPage = (entry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/forgot-password" element={<div>Forgot password page</div>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ResetPasswordPage', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('resets the password and redirects to login', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/auth/reset-password`, () =>
        HttpResponse.json({ message: 'Your password has been reset. You can now log in.' }),
      ),
    )
    const user = userEvent.setup()
    renderPage('/reset-password?token=good-token')

    await user.type(screen.getByLabelText('New password'), 'P@ssword123')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })

  it('shows a validation error for a weak password', async () => {
    const user = userEvent.setup()
    renderPage('/reset-password?token=good-token')

    await user.type(screen.getByLabelText('New password'), 'weak')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('shows an error for an expired/invalid token', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/auth/reset-password`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'RESET_TOKEN_EXPIRED',
              message: 'This password reset link has expired. Please request a new one.',
            },
          },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage('/reset-password?token=expired-token')

    await user.type(screen.getByLabelText('New password'), 'P@ssword123')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(
      await screen.findByText('This password reset link has expired. Please request a new one.'),
    ).toBeInTheDocument()
  })

  it('shows a missing-token state when no token is present', () => {
    renderPage('/reset-password')

    expect(screen.getByText('This link is missing a token')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('shows the rate-limit message when the API returns 429', async () => {
    server.use(
      http.post(
        `${API_URL}/api/v1/auth/reset-password`,
        () =>
          new HttpResponse(
            JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }),
            { status: 429, headers: { 'Retry-After': '60', 'Content-Type': 'application/json' } },
          ),
      ),
    )
    const user = userEvent.setup()
    renderPage('/reset-password?token=good-token')

    await user.type(screen.getByLabelText('New password'), 'P@ssword123')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Rate Limit Exceeded')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })
})
