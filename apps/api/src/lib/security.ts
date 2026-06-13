import { rateLimit } from 'express-rate-limit'
import type { HelmetOptions } from 'helmet'

import { RATE_LIMIT, TIME } from './constants'

const helmetConfig = {
  development: {
    // Relaxed CSP for development (allows hot reload)
    contentSecurityPolicy: false,
    // No HSTS in development (HTTP is fine locally)
    hsts: false,
  },

  production: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: TIME.ONE_YEAR_SEC,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: {
      policy: 'no-referrer',
    },
  },
} as const satisfies Record<'development' | 'production', HelmetOptions>

export const getHelmetConfig = (): HelmetOptions =>
  process.env.NODE_ENV === 'production' ? helmetConfig.production : helmetConfig.development

// Disable rate limiting in test environment to avoid interference with integration tests
const isTestEnv = process.env.NODE_ENV === 'test'

export const rateLimitConfig = {
  authEndpoints: rateLimit({
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
    max: RATE_LIMIT.AUTH_MAX_REQUESTS,
    message: 'Too many login attempts, please try again later',
    standardHeaders: 'draft-7', // Use draft-7 to include Retry-After header
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
  }),
  apiEndpoints: rateLimit({
    windowMs: RATE_LIMIT.API_WINDOW_MS,
    max: RATE_LIMIT.API_MAX_REQUESTS,
    standardHeaders: 'draft-7', // Use draft-7 to include Retry-After header
    legacyHeaders: false,
    skip: () => isTestEnv, // Skip rate limiting in tests
  }),
}

export const corsConfig = {
  development: ['http://localhost:5173'],
  // TODO: Update with actual production URL(s) when deploying
  production: ['https://app.yourdomain.com'],
}
