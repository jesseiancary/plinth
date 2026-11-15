import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import { asyncHandler } from './async-handler.js'

const req = {} as Request
const res = { json: vi.fn() } as unknown as Response

// Drain the microtask queue so the wrapper's .catch(next) has a chance to run.
const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve))

describe('asyncHandler', () => {
  it('forwards a synchronous throw to next()', () => {
    const error = new Error('sync boom')
    const next = vi.fn() as unknown as NextFunction

    asyncHandler(() => {
      throw error
    })(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(error)
  })

  it('forwards an async rejection to next()', async () => {
    const error = new Error('async boom')
    const next = vi.fn() as unknown as NextFunction

    asyncHandler(() => Promise.reject(error))(req, res, next)

    await flushMicrotasks()

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(error)
  })

  it('does not call next() when the handler succeeds', async () => {
    const next = vi.fn() as unknown as NextFunction

    asyncHandler((_req, resArg) => {
      resArg.json({ ok: true })
    })(req, res, next)

    await flushMicrotasks()

    expect(next).not.toHaveBeenCalled()
  })
})
