import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import { AppError } from '../lib/errors.js'

import { createHealthTokenGuard } from './health-auth.js'

const TOKEN = 'unit-test-health-token-0123456789'

const makeReq = (authorization?: string): Request =>
  ({ headers: authorization === undefined ? {} : { authorization } }) as Request

const run = (guard: ReturnType<typeof createHealthTokenGuard>, req: Request) => {
  const next = vi.fn() as unknown as NextFunction
  let thrown: unknown
  try {
    guard(req, {} as Response, next)
  } catch (error) {
    thrown = error
  }
  return { next, thrown }
}

describe('createHealthTokenGuard', () => {
  it('throws 404 NOT_FOUND when no token is configured (disabled)', () => {
    const guard = createHealthTokenGuard({ token: undefined })

    const { next, thrown } = run(guard, makeReq(`Bearer ${TOKEN}`))

    expect(next).not.toHaveBeenCalled()
    expect(thrown).toBeInstanceOf(AppError)
    expect(thrown).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' })
  })

  describe('when a token is configured', () => {
    const guard = createHealthTokenGuard({ token: TOKEN })

    it('calls next() when the bearer token matches', () => {
      const { next, thrown } = run(guard, makeReq(`Bearer ${TOKEN}`))

      expect(thrown).toBeUndefined()
      expect(next).toHaveBeenCalledOnce()
    })

    it('throws 401 when the Authorization header is absent', () => {
      const { next, thrown } = run(guard, makeReq())

      expect(next).not.toHaveBeenCalled()
      expect(thrown).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' })
    })

    it('throws 401 for a non-Bearer scheme', () => {
      const { next, thrown } = run(guard, makeReq(`Basic ${TOKEN}`))

      expect(next).not.toHaveBeenCalled()
      expect(thrown).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' })
    })

    it('throws 401 for an empty bearer token', () => {
      const { next, thrown } = run(guard, makeReq('Bearer '))

      expect(next).not.toHaveBeenCalled()
      expect(thrown).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' })
    })

    it('throws 401 when the token does not match', () => {
      const { next, thrown } = run(guard, makeReq('Bearer wrong-token-0123456789abc'))

      expect(next).not.toHaveBeenCalled()
      expect(thrown).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' })
    })
  })
})
