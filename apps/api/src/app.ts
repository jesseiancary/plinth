import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { apiReference } from '@scalar/express-api-reference'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import { TIME } from './lib/constants.js'
import { corsConfig, getHelmetConfig, rateLimitConfig } from './lib/security.js'
import { authenticateJWT } from './middleware/auth.js'
import { csrfProtection } from './middleware/csrf.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFound } from './middleware/not-found.js'
import apiKeysRouter from './routes/api-keys.js'
import { authRouter } from './routes/auth.js'
import { healthRouter } from './routes/health.js'
import invitationsRouter from './routes/invitations.js'
import membersRouter from './routes/members.js'
import orgInvitationsRouter from './routes/org-invitations.js'
import orgsRouter from './routes/orgs.js'

// ESM __dirname/__filename equivalents
const filename = fileURLToPath(import.meta.url)
const currentDir = dirname(filename)

const app = express()

// Security middleware
app.use(helmet(getHelmetConfig()))

const allowedOrigins: string[] =
  process.env.NODE_ENV === 'production' ? corsConfig.production : corsConfig.development

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) {
        return callback(null, true)
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true, // Allow cookies
    exposedHeaders: ['X-Total-Count', 'X-Next-Cursor'], // Expose pagination headers
    maxAge: TIME.ONE_DAY_SEC,
  }),
)

// Rate limiting
const limiter = rateLimitConfig.apiEndpoints
app.use('/api', limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

// API Documentation
const openapiSpec = readFileSync(
  join(currentDir, '../../../packages/openapi/openapi.yaml'),
  'utf-8',
)

app.use(
  '/docs',
  apiReference({
    spec: {
      content: openapiSpec,
    },
  }),
)

// Global JWT authentication middleware (does not enforce auth, just parses token)
app.use(authenticateJWT)

// Global CSRF protection middleware
// Sets CSRF token cookie on GET requests, validates on state-changing requests
app.use(csrfProtection)

// Routes
app.use('/health', healthRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/orgs', orgsRouter)
app.use('/api/v1/orgs', membersRouter)
app.use('/api/v1/orgs', apiKeysRouter)
app.use('/api/v1/orgs', orgInvitationsRouter)
app.use('/api/v1/invitations', invitationsRouter)

// 404 handler
app.use(notFound)

// Error handler (must be last)
app.use(errorHandler)

export { app }
