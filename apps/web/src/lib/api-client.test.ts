import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { api, RateLimitError } from './api-client'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('api-client - Rate Limit Handling', () => {
  it('throws RateLimitError on 429 response', async () => {
    server.use(
      http.get(`${import.meta.env.VITE_API_URL}/test`, () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
          { status: 429, headers: { 'Retry-After': '60' } },
        ),
      ),
    )

    await expect(api.get('/test')).rejects.toThrow(RateLimitError)
  })

  it('parses Retry-After header in seconds', async () => {
    server.use(
      http.get(`${import.meta.env.VITE_API_URL}/test`, () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
          { status: 429, headers: { 'Retry-After': '120' } },
        ),
      ),
    )

    try {
      await api.get('/test')
      expect.fail('Should have thrown RateLimitError')
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError)
      expect((error as RateLimitError).retryAfter).toBe(120)
      expect((error as RateLimitError).message).toBe('Rate limit exceeded. Please try again later.')
    }
  })

  it('parses Retry-After header as HTTP date', async () => {
    const futureDate = new Date(Date.now() + 90 * 1000) // 90 seconds from now
    server.use(
      http.get(`${import.meta.env.VITE_API_URL}/test`, () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
          { status: 429, headers: { 'Retry-After': futureDate.toUTCString() } },
        ),
      ),
    )

    try {
      await api.get('/test')
      expect.fail('Should have thrown RateLimitError')
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError)
      // Should be approximately 90 seconds (allow 2 second variance for test execution)
      expect((error as RateLimitError).retryAfter).toBeGreaterThanOrEqual(88)
      expect((error as RateLimitError).retryAfter).toBeLessThanOrEqual(92)
    }
  })

  it('defaults to 60 seconds when Retry-After header is missing', async () => {
    server.use(
      http.get(`${import.meta.env.VITE_API_URL}/test`, () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
          { status: 429 }, // No Retry-After header
        ),
      ),
    )

    try {
      await api.get('/test')
      expect.fail('Should have thrown RateLimitError')
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError)
      expect((error as RateLimitError).retryAfter).toBe(60)
    }
  })

  it('handles Retry-After with value of 0', async () => {
    server.use(
      http.get(`${import.meta.env.VITE_API_URL}/test`, () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
          { status: 429, headers: { 'Retry-After': '0' } },
        ),
      ),
    )

    try {
      await api.get('/test')
      expect.fail('Should have thrown RateLimitError')
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError)
      expect((error as RateLimitError).retryAfter).toBe(0)
    }
  })

  it('handles past HTTP date in Retry-After header', async () => {
    const pastDate = new Date(Date.now() - 10 * 1000) // 10 seconds in the past
    server.use(
      http.get(`${import.meta.env.VITE_API_URL}/test`, () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
          { status: 429, headers: { 'Retry-After': pastDate.toUTCString() } },
        ),
      ),
    )

    try {
      await api.get('/test')
      expect.fail('Should have thrown RateLimitError')
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError)
      // Should be 0 (clamped to minimum)
      expect((error as RateLimitError).retryAfter).toBe(0)
    }
  })

  it('RateLimitError has correct name property', () => {
    const error = new RateLimitError(60)
    expect(error.name).toBe('RateLimitError')
    expect(error).toBeInstanceOf(Error)
  })

  it('does not throw RateLimitError for other status codes', async () => {
    server.use(
      http.get(`${import.meta.env.VITE_API_URL}/test`, () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 }),
      ),
    )

    await expect(api.get('/test')).rejects.toThrow()
    try {
      await api.get('/test')
    } catch (error) {
      expect(error).not.toBeInstanceOf(RateLimitError)
    }
  })
})
