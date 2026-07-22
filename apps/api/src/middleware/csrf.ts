import type { NextFunction, Request, Response } from 'express'

import { TIME } from '../lib/constants.js'
import { generateCsrfToken, validateCsrfToken } from '../lib/csrf.js'
import { env, shouldSkipCsrf } from '../lib/env.js'
import { AppError } from '../lib/errors.js'

/**
 * Options for configuring CSRF protection middleware
 */
export interface CsrfProtectionOptions {
  /**
   * If true, CSRF protection will be completely disabled
   * Useful for testing or specific environments
   */
  skipCsrf?: boolean

  /**
   * Override the NODE_ENV detection for secure cookie flag
   * By default, uses env.NODE_ENV
   */
  isProduction?: boolean
}

/**
 * CSRF Protection Middleware Factory using Double Submit Cookie Pattern
 *
 * How it works:
 * 1. On safe methods (GET, HEAD, OPTIONS), generate a new CSRF token and set it as a cookie
 * 2. On state-changing methods (POST, PATCH, DELETE, PUT), validate the token from:
 *    - Cookie: csrf-token (httpOnly=false so frontend can read it)
 *    - Header: X-CSRF-Token (sent by frontend with each request)
 * 3. Skip validation for:
 *    - Test environment (NODE_ENV=test) - CSRF has dedicated test suite
 *    - API key authentication (uses Bearer tokens, not cookies)
 *    - Public endpoints (login, register, refresh, invitation acceptance)
 *
 * Security properties:
 * - Token is cryptographically random (32 bytes)
 * - Constant-time comparison prevents timing attacks
 * - Cookie + header requirement prevents CSRF (attacker can't read cookie or set header)
 * - Works alongside SameSite=strict for defense-in-depth
 *
 * @param options - Configuration options for CSRF protection
 * @returns Express middleware function
 *
 * @example
 * // Default usage (production app)
 * app.use(csrfProtection)
 *
 * @example
 * // Testing with CSRF enabled
 * const testApp = express()
 * testApp.use(createCsrfProtection({ skipCsrf: false, isProduction: false }))
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie
 */
export const createCsrfProtection = (options: CsrfProtectionOptions = {}) => {
  const { skipCsrf = shouldSkipCsrf(), isProduction = env.NODE_ENV === 'production' } = options

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip CSRF if configured (e.g., test environment or explicit override)
    if (skipCsrf) {
      next()
      return
    }

    const method = req.method.toUpperCase()

    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      const token = generateCsrfToken()
      res.cookie('csrf-token', token, {
        httpOnly: false, // Frontend needs to read this to send in header
        secure: isProduction,
        sameSite: 'strict',
        maxAge: TIME.ONE_HOUR_MS,
        path: '/',
      })
      next()
      return
    }

    if (method === 'POST' || method === 'PATCH' || method === 'DELETE' || method === 'PUT') {
      // Skip CSRF validation for public endpoints that don't require existing session
      const publicEndpoints = [
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/api/v1/auth/refresh',
        '/api/v1/invitations/accept',
      ]

      // Normalize path to handle trailing slashes (Express routes accept both /path and /path/)
      // This prevents false positive CSRF errors when URLs have trailing slashes
      const normalizedPath = req.path.replace(/\/+$/, '')
      if (publicEndpoints.includes(normalizedPath)) {
        next()
        return
      }

      // API keys use Bearer tokens, not cookies, so CSRF doesn't apply
      const authHeader = req.headers.authorization
      if (authHeader?.startsWith('Bearer sk_')) {
        next()
        return
      }

      const cookieToken = req.cookies['csrf-token'] as string | undefined
      const headerToken = req.headers['x-csrf-token'] as string | undefined

      if (!validateCsrfToken(cookieToken, headerToken)) {
        if (!cookieToken || !headerToken) {
          throw new AppError(
            'CSRF token missing. Please refresh the page and try again.',
            403,
            'CSRF_TOKEN_MISSING',
          )
        }
        throw new AppError(
          'CSRF token validation failed. Please refresh the page and try again.',
          403,
          'CSRF_TOKEN_INVALID',
        )
      }

      next()
      return
    }

    // Allow other methods (unlikely but defensive)
    next()
  }
}

/**
 * Default CSRF protection middleware instance
 * Uses environment-based defaults (skips in test, enables in dev/prod)
 */
export const csrfProtection = createCsrfProtection()

/**
 * CSRF protection for routes that should skip validation
 * This is used for public endpoints like login, register, invitation acceptance
 * where there's no existing session to protect
 */
export const skipCsrfProtection = (_req: Request, _res: Response, next: NextFunction): void => {
  // No-op middleware - just pass through
  // This exists for documentation purposes to make it clear when CSRF is intentionally skipped
  next()
}
