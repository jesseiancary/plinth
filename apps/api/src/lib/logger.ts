import path from 'node:path'

import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

import { env } from './env.js'

const getLogLevel = (): string => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL
  }

  if (env.NODE_ENV === 'test') {
    return 'silent' // Disable logging in tests
  }
  if (env.NODE_ENV === 'production') {
    return 'info'
  }
  return 'debug' // Development
}

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
    return `${String(timestamp)} ${String(level)}: ${String(message)} ${metaStr}`
  }),
)

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
)

const logDir = path.join(process.cwd(), 'logs')

const transports: winston.transport[] = []

if (env.NODE_ENV !== 'test') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '20m',
      format: prodFormat,
    }),
  )

  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      format: prodFormat,
    }),
  )

  if (env.NODE_ENV === 'development') {
    transports.push(
      new winston.transports.Console({
        format: devFormat,
      }),
    )
  }
}

export const logger = winston.createLogger({
  level: getLogLevel(),
  format: prodFormat,
  transports,
  // Prevent unhandled exceptions from crashing the logger
  exitOnError: false,
})

export const getConfiguredLogLevel = (): string => getLogLevel()

/**
 * Sanitize sensitive data from objects before logging
 * Removes passwords, tokens, API keys, and authorization headers
 */
export const sanitizeLogData = (data: Record<string, unknown>): Record<string, unknown> => {
  const sensitiveKeys = [
    'password',
    'token',
    'apikey', // Matches apiKey, apiKeyHash, etc. (lowercase)
    'authorization',
    'cookie',
    'secret',
    'csrf',
  ]

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()

    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]'
      continue
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogData(value as Record<string, unknown>)
      continue
    }

    sanitized[key] = value
  }

  return sanitized
}
