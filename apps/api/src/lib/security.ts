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
  authLogin: rateLimit({
    windowMs: RATE_LIMIT.AUTH_LOGIN_WINDOW_MS,
    max: RATE_LIMIT.AUTH_LOGIN_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTestEnv,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many login attempts. Please try again in 1 minute.',
          details: {
            retryAfter: Math.ceil(RATE_LIMIT.AUTH_LOGIN_WINDOW_MS / 1000),
          },
        },
      })
    },
  }),

  authRegister: rateLimit({
    windowMs: RATE_LIMIT.AUTH_REGISTER_WINDOW_MS,
    max: RATE_LIMIT.AUTH_REGISTER_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTestEnv,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many registration attempts. Please try again in 1 hour.',
          details: {
            retryAfter: Math.ceil(RATE_LIMIT.AUTH_REGISTER_WINDOW_MS / 1000),
          },
        },
      })
    },
  }),

  authPassword: rateLimit({
    windowMs: RATE_LIMIT.AUTH_PASSWORD_WINDOW_MS,
    max: RATE_LIMIT.AUTH_PASSWORD_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTestEnv,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many password change attempts. Please try again in 15 minutes.',
          details: {
            retryAfter: Math.ceil(RATE_LIMIT.AUTH_PASSWORD_WINDOW_MS / 1000),
          },
        },
      })
    },
  }),

  authRefresh: rateLimit({
    windowMs: RATE_LIMIT.AUTH_REFRESH_WINDOW_MS,
    max: RATE_LIMIT.AUTH_REFRESH_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTestEnv,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many refresh token requests. Please try again later.',
          details: {
            retryAfter: Math.ceil(RATE_LIMIT.AUTH_REFRESH_WINDOW_MS / 1000),
          },
        },
      })
    },
  }),

  invitationCreate: rateLimit({
    windowMs: RATE_LIMIT.INVITATION_CREATE_WINDOW_MS,
    max: RATE_LIMIT.INVITATION_CREATE_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTestEnv,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Invitation limit reached. Please try again later.',
          details: {
            retryAfter: Math.ceil(RATE_LIMIT.INVITATION_CREATE_WINDOW_MS / 1000),
          },
        },
      })
    },
  }),

  invitationAccept: rateLimit({
    windowMs: RATE_LIMIT.INVITATION_ACCEPT_WINDOW_MS,
    max: RATE_LIMIT.INVITATION_ACCEPT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTestEnv,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many invitation accept attempts. Please try again later.',
          details: {
            retryAfter: Math.ceil(RATE_LIMIT.INVITATION_ACCEPT_WINDOW_MS / 1000),
          },
        },
      })
    },
  }),

  apiKeyCreate: rateLimit({
    windowMs: RATE_LIMIT.API_KEY_CREATE_WINDOW_MS,
    max: RATE_LIMIT.API_KEY_CREATE_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTestEnv,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'API key creation limit reached. Please try again later.',
          details: {
            retryAfter: Math.ceil(RATE_LIMIT.API_KEY_CREATE_WINDOW_MS / 1000),
          },
        },
      })
    },
  }),

  readOperations: rateLimit({
    windowMs: RATE_LIMIT.READ_WINDOW_MS,
    max: RATE_LIMIT.READ_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTestEnv,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down.',
          details: {
            retryAfter: Math.ceil(RATE_LIMIT.READ_WINDOW_MS / 1000),
          },
        },
      })
    },
  }),

  writeOperations: rateLimit({
    windowMs: RATE_LIMIT.WRITE_WINDOW_MS,
    max: RATE_LIMIT.WRITE_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTestEnv,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many write requests. Please slow down.',
          details: {
            retryAfter: Math.ceil(RATE_LIMIT.WRITE_WINDOW_MS / 1000),
          },
        },
      })
    },
  }),

  apiEndpoints: rateLimit({
    windowMs: RATE_LIMIT.API_WINDOW_MS,
    max: RATE_LIMIT.API_MAX_REQUESTS,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTestEnv,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down.',
          details: {
            retryAfter: Math.ceil(RATE_LIMIT.API_WINDOW_MS / 1000),
          },
        },
      })
    },
  }),
}

export const corsConfig = {
  development: ['http://localhost:5173'],
  // TODO: Update with actual production URL(s) when deploying
  production: ['https://app.yourdomain.com'],
}
