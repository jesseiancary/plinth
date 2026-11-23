import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { ForgotPasswordPage } from './ForgotPasswordPage'

import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('shows a generic confirmation after submitting an email', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/auth/forgot-password`, () =>
        HttpResponse.json({
          message: 'If an account exists for that email, a reset link has been sent.',
        }),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(
      screen.getByText('If an account exists for that email, a reset link has been sent.'),
    ).toBeInTheDocument()
  })

  it('validates the email before submitting', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Invalid email address')).toBeInTheDocument()
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument()
  })

  it('shows the rate-limit message when the API returns 429', async () => {
    server.use(
      http.post(
        `${API_URL}/api/v1/auth/forgot-password`,
        () =>
          new HttpResponse(
            JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }),
            { status: 429, headers: { 'Retry-After': '60', 'Content-Type': 'application/json' } },
          ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Rate Limit Exceeded')).toBeInTheDocument()
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument()
  })
})
