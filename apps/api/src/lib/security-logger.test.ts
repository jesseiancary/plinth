import type { Request } from 'express'
import { describe, expect, it, vi } from 'vitest'

import { logger } from './logger.js'
import {
  getSecurityContext,
  logAuthFailure,
  logAuthorizationFailure,
  logCsrfFailure,
  logRateLimitExceeded,
  logSecurityEvent,
  logSensitiveOperation,
} from './security-logger.js'

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  sanitizeLogData: (data: Record<string, unknown>) => data, // Pass through for testing
}))

describe('security-logger', () => {
  describe('logAuthFailure', () => {
    it('should log failed login with all context', () => {
      logAuthFailure({
        event: 'FAILED_LOGIN',
        reason: 'Invalid password',
        email: 'user@example.com',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        endpoint: '/api/v1/auth/login',
      })

      expect(logger.warn).toHaveBeenCalledWith('Authentication failure', {
        event: 'FAILED_LOGIN',
        reason: 'Invalid password',
        email: 'user@example.com',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        endpoint: '/api/v1/auth/login',
        userId: undefined,
        timestamp: expect.any(String),
      })
    })

    it('should handle minimal context', () => {
      logAuthFailure({
        event: 'INVALID_TOKEN',
        reason: 'Token expired',
      })

      expect(logger.warn).toHaveBeenCalledWith('Authentication failure', {
        event: 'INVALID_TOKEN',
        reason: 'Token expired',
        email: undefined,
        userId: undefined,
        ip: undefined,
        userAgent: undefined,
        endpoint: undefined,
        timestamp: expect.any(String),
      })
    })
  })

  describe('logAuthorizationFailure', () => {
    it('should log 403 error with full context', () => {
      logAuthorizationFailure({
        userId: 'user-123',
        email: 'user@example.com',
        endpoint: '/api/v1/orgs/acme/members',
        method: 'DELETE',
        requiredRole: 'ADMIN',
        actualRole: 'MEMBER',
        organizationId: 'org-456',
        organizationSlug: 'acme',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        reason: 'Insufficient permissions',
      })

      expect(logger.warn).toHaveBeenCalledWith('Authorization failure', {
        event: 'AUTHORIZATION_FAILURE',
        userId: 'user-123',
        email: 'user@example.com',
        endpoint: '/api/v1/orgs/acme/members',
        method: 'DELETE',
        requiredRole: 'ADMIN',
        actualRole: 'MEMBER',
        organizationId: 'org-456',
        organizationSlug: 'acme',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        reason: 'Insufficient permissions',
        timestamp: expect.any(String),
      })
    })

    it('should work with minimal params', () => {
      logAuthorizationFailure({
        userId: 'user-123',
        endpoint: '/api/v1/resource',
        method: 'POST',
      })

      expect(logger.warn).toHaveBeenCalledWith('Authorization failure', {
        event: 'AUTHORIZATION_FAILURE',
        userId: 'user-123',
        endpoint: '/api/v1/resource',
        method: 'POST',
        email: undefined,
        requiredRole: undefined,
        actualRole: undefined,
        organizationId: undefined,
        organizationSlug: undefined,
        ip: undefined,
        userAgent: undefined,
        reason: undefined,
        timestamp: expect.any(String),
      })
    })
  })

  describe('logRateLimitExceeded', () => {
    it('should log rate limit exceeded', () => {
      logRateLimitExceeded({
        endpoint: '/api/v1/auth/login',
        limit: 5,
        window: '15 minutes',
        ip: '192.168.1.1',
        userId: 'user-123',
        userAgent: 'Mozilla/5.0',
      })

      expect(logger.warn).toHaveBeenCalledWith('Rate limit exceeded', {
        event: 'RATE_LIMIT_EXCEEDED',
        endpoint: '/api/v1/auth/login',
        limit: 5,
        window: '15 minutes',
        ip: '192.168.1.1',
        userId: 'user-123',
        userAgent: 'Mozilla/5.0',
        timestamp: expect.any(String),
      })
    })
  })

  describe('logSensitiveOperation', () => {
    it('should log password change', () => {
      logSensitiveOperation({
        event: 'PASSWORD_CHANGED',
        userId: 'user-123',
        email: 'user@example.com',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      })

      expect(logger.warn).toHaveBeenCalledWith('Sensitive operation', {
        event: 'PASSWORD_CHANGED',
        userId: 'user-123',
        email: 'user@example.com',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        oldEmail: undefined,
        newEmail: undefined,
        timestamp: expect.any(String),
      })
    })

    it('should log email change with old and new emails', () => {
      logSensitiveOperation({
        event: 'EMAIL_CHANGED',
        userId: 'user-123',
        oldEmail: 'old@example.com',
        newEmail: 'new@example.com',
        ip: '192.168.1.1',
      })

      expect(logger.warn).toHaveBeenCalledWith('Sensitive operation', {
        event: 'EMAIL_CHANGED',
        userId: 'user-123',
        oldEmail: 'old@example.com',
        newEmail: 'new@example.com',
        ip: '192.168.1.1',
        email: undefined,
        userAgent: undefined,
        timestamp: expect.any(String),
      })
    })
  })

  describe('logCsrfFailure', () => {
    it('should log CSRF validation failure', () => {
      logCsrfFailure({
        endpoint: '/api/v1/orgs',
        method: 'POST',
        ip: '192.168.1.1',
      })

      expect(logger.warn).toHaveBeenCalledWith('CSRF validation failure', {
        event: 'CSRF_FAILURE',
        endpoint: '/api/v1/orgs',
        method: 'POST',
        ip: '192.168.1.1',
        timestamp: expect.any(String),
      })
    })
  })

  describe('getSecurityContext', () => {
    it('should extract context from request', () => {
      const req = {
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        user: {
          id: 'user-123',
          email: 'user@example.com',
        },
        tenantId: 'org-456',
        originalUrl: '/api/v1/orgs/acme/members',
        method: 'GET',
      } as unknown as Request

      const context = getSecurityContext(req)

      expect(context).toEqual({
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        userId: 'user-123',
        email: 'user@example.com',
        organizationId: 'org-456',
        endpoint: '/api/v1/orgs/acme/members',
        method: 'GET',
      })
    })

    it('should handle missing user context', () => {
      const req = {
        ip: '192.168.1.1',
        headers: {},
        originalUrl: '/api/v1/auth/login',
        method: 'POST',
      } as unknown as Request

      const context = getSecurityContext(req)

      expect(context).toEqual({
        ip: '192.168.1.1',
        userAgent: undefined,
        userId: undefined,
        email: undefined,
        organizationId: undefined,
        endpoint: '/api/v1/auth/login',
        method: 'POST',
      })
    })
  })

  describe('logSecurityEvent', () => {
    it('should log security event with request context', () => {
      const req = {
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        user: {
          id: 'user-123',
          email: 'user@example.com',
        },
        tenantId: 'org-456',
        originalUrl: '/api/v1/invitations/validate/abc',
        method: 'GET',
      } as unknown as Request

      logSecurityEvent('INVALID_INVITATION_TOKEN', req, {
        token: 'abc123',
        status: 'EXPIRED',
      })

      expect(logger.warn).toHaveBeenCalledWith('Security event', {
        event: 'INVALID_INVITATION_TOKEN',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        userId: 'user-123',
        email: 'user@example.com',
        organizationId: 'org-456',
        endpoint: '/api/v1/invitations/validate/abc',
        method: 'GET',
        token: 'abc123',
        status: 'EXPIRED',
        timestamp: expect.any(String),
      })
    })

    it('should work without additional data', () => {
      const req = {
        ip: '192.168.1.1',
        headers: {},
        originalUrl: '/api/v1/resource',
        method: 'POST',
      } as unknown as Request

      logSecurityEvent('REGISTRATION_FAILED', req)

      expect(logger.warn).toHaveBeenCalledWith('Security event', {
        event: 'REGISTRATION_FAILED',
        ip: '192.168.1.1',
        userAgent: undefined,
        userId: undefined,
        email: undefined,
        organizationId: undefined,
        endpoint: '/api/v1/resource',
        method: 'POST',
        timestamp: expect.any(String),
      })
    })
  })
})
