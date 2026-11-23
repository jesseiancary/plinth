import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { VerifyEmailPage } from './VerifyEmailPage'

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
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/register" element={<div>Register page</div>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VerifyEmailPage', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('auto-verifies and shows success with a sign-in link', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/auth/verify-email`, () =>
        HttpResponse.json({
          message: 'Email verified successfully. You can now log in.',
          status: 'verified',
        }),
      ),
    )
    renderPage('/verify-email?token=good-token')

    expect(await screen.findByText('Email verified')).toBeInTheDocument()
    expect(screen.getByText('Email verified successfully. You can now log in.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('shows the already-verified state for a double-submit', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/auth/verify-email`, () =>
        HttpResponse.json({
          message: 'This email is already verified. You can log in.',
          status: 'already_verified',
        }),
      ),
    )
    renderPage('/verify-email?token=used-token')

    expect(await screen.findByText('Already verified')).toBeInTheDocument()
    expect(screen.getByText('This email is already verified. You can log in.')).toBeInTheDocument()
  })

  it('shows an expired/invalid state with a register-again affordance', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/auth/verify-email`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VERIFICATION_TOKEN_EXPIRED',
              message: 'This verification link has expired. Please request a new one.',
            },
          },
          { status: 400 },
        ),
      ),
    )
    renderPage('/verify-email?token=expired-token')

    expect(await screen.findByText("This link can't be used")).toBeInTheDocument()
    expect(
      screen.getByText('This verification link has expired. Please request a new one.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Register again' })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('shows a missing-token state when no token is present', async () => {
    renderPage('/verify-email')

    expect(await screen.findByText('This link is missing a token')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Register again' })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('shows the rate-limit message when the API returns 429', async () => {
    server.use(
      http.post(
        `${API_URL}/api/v1/auth/verify-email`,
        () =>
          new HttpResponse(
            JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }),
            { status: 429, headers: { 'Retry-After': '60', 'Content-Type': 'application/json' } },
          ),
      ),
    )
    renderPage('/verify-email?token=some-token')

    expect(await screen.findByText('Rate Limit Exceeded')).toBeInTheDocument()
  })
})
