import type { Request } from 'express'

import { logger, sanitizeLogData } from './logger.js'

/**
 * Security event types for structured logging
 */
export type SecurityEventType =
  | 'FAILED_LOGIN'
  | 'INVALID_TOKEN'
  | 'TOKEN_VERSION_MISMATCH'
  | 'INVALID_API_KEY'
  | 'REVOKED_API_KEY_USED'
  | 'AUTHORIZATION_FAILURE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CSRF_FAILURE'
  | 'REGISTRATION_FAILED'
  | 'INVALID_INVITATION_TOKEN'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_CHANGED'

/**
 * Log a failed authentication attempt
 *
 * @param params - Authentication failure details
 * @param params.event - Type of security event (e.g., 'FAILED_LOGIN', 'INVALID_TOKEN')
 * @param params.reason - Human-readable reason for failure
 * @param params.email - Email address (if known)
 * @param params.userId - User ID (if authenticated before failure)
 * @param params.ip - Client IP address
 * @param params.userAgent - Client user agent string
 * @param params.endpoint - API endpoint that failed
 *
 * @example
 * ```typescript
 * logAuthFailure({
 *   event: 'FAILED_LOGIN',
 *   reason: 'Invalid password',
 *   email: 'user@example.com',
 *   ip: req.ip,
 *   endpoint: '/api/v1/auth/login',
 * })
 * ```
 */
export const logAuthFailure = (params: {
  event: SecurityEventType
  reason: string
  email?: string | undefined
  userId?: string | undefined
  ip?: string | undefined
  userAgent?: string | undefined
  endpoint?: string | undefined
}) => {
  logger.warn('Authentication failure', {
    event: params.event,
    reason: params.reason,
    email: params.email,
    userId: params.userId,
    ip: params.ip,
    userAgent: params.userAgent,
    endpoint: params.endpoint,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log an authorization failure (403 Forbidden)
 *
 * @param params - Authorization failure details
 * @param params.userId - User ID attempting the action
 * @param params.email - User's email address
 * @param params.endpoint - API endpoint that was accessed
 * @param params.method - HTTP method (GET, POST, DELETE, etc.)
 * @param params.requiredRole - Role required for the action
 * @param params.actualRole - User's actual role in the organization
 * @param params.organizationId - Organization ID
 * @param params.organizationSlug - Organization slug
 * @param params.ip - Client IP address
 * @param params.userAgent - Client user agent string
 * @param params.reason - Additional context for the failure
 *
 * @example
 * ```typescript
 * logAuthorizationFailure({
 *   userId: 'cm1abc123',
 *   endpoint: '/api/v1/orgs/acme/members',
 *   method: 'DELETE',
 *   requiredRole: 'ADMIN',
 *   actualRole: 'MEMBER',
 *   organizationSlug: 'acme',
 * })
 * ```
 */
export const logAuthorizationFailure = (params: {
  userId: string
  email?: string | undefined
  endpoint: string
  method: string
  requiredRole?: string | undefined
  actualRole?: string | undefined
  organizationId?: string | undefined
  organizationSlug?: string | undefined
  ip?: string | undefined
  userAgent?: string | undefined
  reason?: string | undefined
}) => {
  logger.warn('Authorization failure', {
    event: 'AUTHORIZATION_FAILURE',
    userId: params.userId,
    email: params.email,
    endpoint: params.endpoint,
    method: params.method,
    requiredRole: params.requiredRole,
    actualRole: params.actualRole,
    organizationId: params.organizationId,
    organizationSlug: params.organizationSlug,
    ip: params.ip,
    userAgent: params.userAgent,
    reason: params.reason,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log a rate limit exceeded event
 *
 * @param params - Rate limit details
 * @param params.endpoint - API endpoint that was rate limited
 * @param params.limit - Maximum number of requests allowed
 * @param params.window - Time window for rate limit (e.g., '15 minutes')
 * @param params.ip - Client IP address
 * @param params.userId - User ID (if authenticated)
 * @param params.userAgent - Client user agent string
 *
 * @example
 * ```typescript
 * logRateLimitExceeded({
 *   endpoint: '/api/v1/auth/login',
 *   limit: 5,
 *   window: '15 minutes',
 *   ip: req.ip,
 * })
 * ```
 */
export const logRateLimitExceeded = (params: {
  endpoint: string
  limit: number
  window: string
  ip?: string | undefined
  userId?: string | undefined
  userAgent?: string | undefined
}) => {
  logger.warn('Rate limit exceeded', {
    event: 'RATE_LIMIT_EXCEEDED',
    endpoint: params.endpoint,
    limit: params.limit,
    window: params.window,
    ip: params.ip,
    userId: params.userId,
    userAgent: params.userAgent,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log a sensitive operation (password change, email change, etc.)
 *
 * @param params - Sensitive operation details
 * @param params.event - Type of sensitive operation ('PASSWORD_CHANGED', 'EMAIL_CHANGED')
 * @param params.userId - User ID performing the operation
 * @param params.email - User's current email address
 * @param params.oldEmail - Previous email address (for email changes)
 * @param params.newEmail - New email address (for email changes)
 * @param params.ip - Client IP address
 * @param params.userAgent - Client user agent string
 *
 * @example
 * ```typescript
 * logSensitiveOperation({
 *   event: 'PASSWORD_CHANGED',
 *   userId: 'cm1abc123',
 *   email: 'user@example.com',
 *   ip: req.ip,
 * })
 * ```
 */
export const logSensitiveOperation = (params: {
  event: SecurityEventType
  userId: string
  email?: string | undefined
  oldEmail?: string | undefined
  newEmail?: string | undefined
  ip?: string | undefined
  userAgent?: string | undefined
}) => {
  logger.warn('Sensitive operation', {
    event: params.event,
    userId: params.userId,
    email: params.email,
    oldEmail: params.oldEmail,
    newEmail: params.newEmail,
    ip: params.ip,
    userAgent: params.userAgent,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log a CSRF token validation failure
 *
 * @param params - CSRF failure details
 * @param params.endpoint - API endpoint that failed CSRF validation
 * @param params.method - HTTP method (POST, PUT, DELETE, etc.)
 * @param params.ip - Client IP address
 *
 * @example
 * ```typescript
 * logCsrfFailure({
 *   endpoint: '/api/v1/orgs',
 *   method: 'POST',
 *   ip: req.ip,
 * })
 * ```
 */
export const logCsrfFailure = (params: {
  endpoint: string
  method: string
  ip?: string | undefined
}) => {
  logger.warn('CSRF validation failure', {
    event: 'CSRF_FAILURE',
    endpoint: params.endpoint,
    method: params.method,
    ip: params.ip,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Helper to extract security context from Express request
 *
 * @param req - Express request object
 * @returns Security context object with IP, user agent, user info, and request details
 *
 * @example
 * ```typescript
 * const context = getSecurityContext(req)
 * // { ip: '192.168.1.1', userAgent: 'Mozilla/5.0...', userId: 'cm1abc123', ... }
 * ```
 */
export const getSecurityContext = (req: Request) => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  userId: req.user?.id,
  email: req.user?.email,
  organizationId: req.tenantId,
  endpoint: req.originalUrl,
  method: req.method,
})

/**
 * Log a security event with full request context
 *
 * Automatically extracts security context from the Express request and sanitizes
 * any additional data to prevent logging sensitive information.
 *
 * @param event - Type of security event
 * @param req - Express request object
 * @param additionalData - Optional additional data to include (will be sanitized)
 *
 * @example
 * ```typescript
 * logSecurityEvent('INVALID_INVITATION_TOKEN', req, {
 *   token: 'abc123',
 *   status: 'EXPIRED',
 * })
 * ```
 */
export const logSecurityEvent = (
  event: SecurityEventType,
  req: Request,
  additionalData?: Record<string, unknown>,
) => {
  const context = getSecurityContext(req)

  // Sanitize any additional data to prevent logging sensitive info
  const sanitizedData = additionalData ? sanitizeLogData(additionalData) : {}

  logger.warn('Security event', {
    event,
    ...context,
    ...sanitizedData,
    timestamp: new Date().toISOString(),
  })
}
