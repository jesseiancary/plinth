import type { NextFunction, Request, Response } from 'express'

import { constantTimeCompare } from '../lib/csrf.js'
import { env } from '../lib/env.js'
import { AppError } from '../lib/errors.js'

/**
 * Options for configuring the health-check token guard
 */
export interface HealthTokenGuardOptions {
  /**
   * The expected bearer token. Defaults to env.HEALTH_CHECK_TOKEN.
   * When undefined, the guarded endpoint is treated as disabled (404).
   */
  token?: string | undefined
}

/**
 * Health-check token guard factory.
 *
 * Protects the detailed health endpoint, which exposes internal state (memory,
 * uptime, versions). It uses a dedicated shared secret rather than JWT/API-key
 * auth so infrastructure monitoring tools need no user session.
 *
 * Behavior:
 * - Token not configured         -> 404 NOT_FOUND (no-leak: don't advertise the endpoint)
 * - Missing/invalid bearer token -> 401 UNAUTHENTICATED
 * - Matching token               -> next()
 *
 * @example
 * // Default usage (production app)
 * router.get('/detailed', requireHealthToken, handler)
 *
 * @example
 * // Testing the disabled branch
 * createHealthTokenGuard({ token: undefined })
 */
export const createHealthTokenGuard = (options: HealthTokenGuardOptions = {}) => {
  // Use an `in` check (not a destructuring default) so an explicit
  // `{ token: undefined }` means "disabled", not "fall back to env".
  const token = 'token' in options ? options.token : env.HEALTH_CHECK_TOKEN

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!token) {
      throw new AppError('Not found', 404, 'NOT_FOUND')
    }

    const authHeader = req.headers.authorization
    const provided = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined

    if (!provided || !constantTimeCompare(provided, token)) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED')
    }

    next()
  }
}

/**
 * Default health-check token guard instance.
 * Uses env.HEALTH_CHECK_TOKEN (endpoint disabled when unset).
 */
export const requireHealthToken = createHealthTokenGuard()
