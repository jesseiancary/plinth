import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

import { AppError } from '../lib/errors.js'
import { logger, sanitizeLogData } from '../lib/logger.js'

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const errorContext = {
    error: {
      message: err.message,
      name: err.name,
      stack: err.stack,
      code: err instanceof AppError ? err.code : undefined,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      // DO NOT log: req.body (may contain passwords), req.headers.authorization (tokens)
    },
    user: {
      id: req.user?.id,
      email: req.user?.email,
    },
    organizationId: req.tenantId,
    timestamp: new Date().toISOString(),
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    logger.debug('Validation error', {
      ...errorContext,
      validationErrors: err.errors,
    })

    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors,
      },
    })
  }

  // Application errors
  if (err instanceof AppError) {
    const logLevel = err.statusCode >= 500 ? 'error' : err.statusCode >= 400 ? 'warn' : 'info'

    logger[logLevel]('Application error', sanitizeLogData(errorContext))

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || {},
      },
    })
  }

  // Prisma errors
  if (err.constructor.name.startsWith('Prisma')) {
    logger.error('Database error', sanitizeLogData(errorContext))

    return res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
        details: {},
      },
    })
  }

  logger.error('Unexpected error', sanitizeLogData(errorContext))

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: {},
    },
  })
}
