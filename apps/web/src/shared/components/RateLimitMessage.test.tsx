/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RateLimitError } from '../../lib/api-client'

import { RateLimitMessage } from './RateLimitMessage'

describe('RateLimitMessage', () => {
  it('displays rate limit error message', () => {
    const error = new RateLimitError(60)
    render(<RateLimitMessage error={error} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Rate Limit Exceeded')).toBeInTheDocument()
    expect(screen.getByText(/You have made too many requests/)).toBeInTheDocument()
  })

  it('formats time in seconds correctly', () => {
    const error = new RateLimitError(30)
    render(<RateLimitMessage error={error} />)

    expect(screen.getByText(/30 seconds/)).toBeInTheDocument()
  })

  it('formats time in minutes correctly', () => {
    const error = new RateLimitError(120)
    render(<RateLimitMessage error={error} />)

    expect(screen.getByText(/2 minutes/)).toBeInTheDocument()
  })

  it('formats time in minutes and seconds correctly', () => {
    const error = new RateLimitError(90)
    render(<RateLimitMessage error={error} />)

    expect(screen.getByText(/1m 30s/)).toBeInTheDocument()
  })

  it('handles singular time units correctly', () => {
    const error = new RateLimitError(1)
    render(<RateLimitMessage error={error} />)

    expect(screen.getByText(/1 second/)).toBeInTheDocument()
    expect(screen.queryByText(/1 seconds/)).not.toBeInTheDocument()
  })

  it('does not show retry button initially', () => {
    const error = new RateLimitError(60)
    render(<RateLimitMessage error={error} />)

    expect(screen.queryByRole('button', { name: /retry now/i })).not.toBeInTheDocument()
  })

  it('shows retry button when countdown reaches zero', async () => {
    const error = new RateLimitError(1)
    const onRetry = vi.fn()
    render(<RateLimitMessage error={error} onRetry={onRetry} />)

    // Wait for countdown to reach 0
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /retry now/i })).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup()
    const error = new RateLimitError(1)
    const onRetry = vi.fn()
    render(<RateLimitMessage error={error} onRetry={onRetry} />)

    // Wait for retry button to appear
    const retryButton = await screen.findByRole('button', { name: /retry now/i }, { timeout: 2000 })

    // Click the retry button
    await user.click(retryButton)

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('does not show retry button if onRetry is not provided', async () => {
    const error = new RateLimitError(1)
    render(<RateLimitMessage error={error} />)

    // Wait for countdown to reach 0
    await waitFor(
      () => {
        expect(screen.getByText(/0 seconds/)).toBeInTheDocument()
      },
      { timeout: 2000 },
    )

    // Retry button should not appear
    expect(screen.queryByRole('button', { name: /retry now/i })).not.toBeInTheDocument()
  })

  it('decrements time remaining every second', async () => {
    const error = new RateLimitError(3)
    render(<RateLimitMessage error={error} />)

    expect(screen.getByText(/3 seconds/)).toBeInTheDocument()

    await waitFor(
      () => {
        expect(screen.getByText(/2 seconds/)).toBeInTheDocument()
      },
      { timeout: 1500 },
    )

    await waitFor(
      () => {
        expect(screen.getByText(/1 second/)).toBeInTheDocument()
      },
      { timeout: 1500 },
    )

    await waitFor(
      () => {
        expect(screen.getByText(/0 seconds/)).toBeInTheDocument()
      },
      { timeout: 1500 },
    )
  })

  it('has proper accessibility attributes', () => {
    const error = new RateLimitError(60)
    render(<RateLimitMessage error={error} />)

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()

    // Warning icon should be hidden from screen readers
    const svg = alert.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('displays warning icon', () => {
    const error = new RateLimitError(60)
    const { container } = render(<RateLimitMessage error={error} />)

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass('text-warning-600')
  })
})
