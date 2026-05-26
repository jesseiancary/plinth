import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { apiReference } from '@scalar/express-api-reference'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import morgan from 'morgan'

import { errorHandler } from './middleware/error-handler.js'
import { notFound } from './middleware/not-found.js'
import { healthRouter } from './routes/health.js'

// ESM __dirname/__filename equivalents
const filename = fileURLToPath(import.meta.url)
const currentDir = dirname(filename)

const app = express()

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for Scalar docs
  }),
)
app.use(
  cors({
    origin: process.env.APP_URL || 'http://localhost:5173',
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
})
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

// Routes
app.use('/health', healthRouter)

// 404 handler
app.use(notFound)

// Error handler (must be last)
app.use(errorHandler)

export { app }
