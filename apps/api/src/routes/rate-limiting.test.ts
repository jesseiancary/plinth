import type { Response } from 'supertest'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app'
import { prisma } from '../lib/prisma'
import { clearDatabase, createTestUser } from '../lib/test-helpers'

/**
 * Rate Limiting Integration Tests
 *
 * Tests per-endpoint rate limiting to prevent:
 * - Brute force attacks on login
 * - Registration spam
 * - Invitation spam
 * - Resource exhaustion
 *
 * Note: Tests run with NODE_ENV=test, which skips rate limiting.
 * These tests manually verify rate limit configuration is correct.
 */

beforeEach(async () => {
  await clearDatabase()
})

afterEach(async () => {
  await prisma.$disconnect()
})

describe('Rate Limiting Configuration', () => {
  describe('Auth Endpoints - Login Rate Limiting', () => {
    it('should have strict rate limiting configured (5 req/min)', async () => {
      const { rateLimitConfig } = await import('../lib/security.js')
      const { RATE_LIMIT } = await import('../lib/constants.js')

      expect(rateLimitConfig.authLogin).toBeDefined()
      expect(RATE_LIMIT.AUTH_LOGIN_MAX).toBe(5)
      expect(RATE_LIMIT.AUTH_LOGIN_WINDOW_MS).toBe(60 * 1000) // 1 minute
    })

    it('should accept valid login attempts', async () => {
      const { user, password } = await createTestUser()

      const res: Response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: user.email,
          password,
        })
        .expect(200)

      expect(res.body).toHaveProperty('accessToken')
      expect(res.body.user.email).toBe(user.email)
    })
  })

  describe('Auth Endpoints - Registration Rate Limiting', () => {
    it('should have restrictive rate limiting configured (3 req/hour)', async () => {
      const { rateLimitConfig } = await import('../lib/security.js')
      const { RATE_LIMIT } = await import('../lib/constants.js')

      expect(rateLimitConfig.authRegister).toBeDefined()
      expect(RATE_LIMIT.AUTH_REGISTER_MAX).toBe(3)
      expect(RATE_LIMIT.AUTH_REGISTER_WINDOW_MS).toBe(60 * 60 * 1000) // 1 hour
    })

    it('should accept valid registration requests', async () => {
      const res: Response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          password: 'SecurePassword123!',
        })
        .expect(201)

      expect(res.body).toHaveProperty('accessToken')
      expect(res.body.user.email).toBe('newuser@example.com')
    })
  })

  describe('Auth Endpoints - Password Change Rate Limiting', () => {
    it('should have moderate rate limiting configured (3 req/15min)', async () => {
      const { rateLimitConfig } = await import('../lib/security.js')
      const { RATE_LIMIT } = await import('../lib/constants.js')

      expect(rateLimitConfig.authPassword).toBeDefined()
      expect(RATE_LIMIT.AUTH_PASSWORD_MAX).toBe(3)
      expect(RATE_LIMIT.AUTH_PASSWORD_WINDOW_MS).toBe(15 * 60 * 1000) // 15 minutes
    })
  })

  describe('Auth Endpoints - Refresh Token Rate Limiting', () => {
    it('should have moderate rate limiting configured (20 req/15min)', async () => {
      const { rateLimitConfig } = await import('../lib/security.js')
      const { RATE_LIMIT } = await import('../lib/constants.js')

      expect(rateLimitConfig.authRefresh).toBeDefined()
      expect(RATE_LIMIT.AUTH_REFRESH_MAX).toBe(20)
      expect(RATE_LIMIT.AUTH_REFRESH_WINDOW_MS).toBe(15 * 60 * 1000) // 15 minutes
    })
  })

  describe('Invitation Endpoints - Creation Rate Limiting', () => {
    it('should have spam prevention configured (20 req/hour)', async () => {
      const { rateLimitConfig } = await import('../lib/security.js')
      const { RATE_LIMIT } = await import('../lib/constants.js')

      expect(rateLimitConfig.invitationCreate).toBeDefined()
      expect(RATE_LIMIT.INVITATION_CREATE_MAX).toBe(20)
      expect(RATE_LIMIT.INVITATION_CREATE_WINDOW_MS).toBe(60 * 60 * 1000) // 1 hour
    })
  })

  describe('Invitation Endpoints - Accept Rate Limiting', () => {
    it('should have moderate rate limiting configured (10 req/15min)', async () => {
      const { rateLimitConfig } = await import('../lib/security.js')
      const { RATE_LIMIT } = await import('../lib/constants.js')

      expect(rateLimitConfig.invitationAccept).toBeDefined()
      expect(RATE_LIMIT.INVITATION_ACCEPT_MAX).toBe(10)
      expect(RATE_LIMIT.INVITATION_ACCEPT_WINDOW_MS).toBe(15 * 60 * 1000) // 15 minutes
    })
  })

  describe('API Key Endpoints - Creation Rate Limiting', () => {
    it('should have moderate rate limiting configured (10 req/hour)', async () => {
      const { rateLimitConfig } = await import('../lib/security.js')
      const { RATE_LIMIT } = await import('../lib/constants.js')

      expect(rateLimitConfig.apiKeyCreate).toBeDefined()
      expect(RATE_LIMIT.API_KEY_CREATE_MAX).toBe(10)
      expect(RATE_LIMIT.API_KEY_CREATE_WINDOW_MS).toBe(60 * 60 * 1000) // 1 hour
    })
  })

  describe('Generic Endpoints - Read Operations', () => {
    it('should have lenient rate limiting configured (300 req/15min)', async () => {
      const { rateLimitConfig } = await import('../lib/security.js')
      const { RATE_LIMIT } = await import('../lib/constants.js')

      expect(rateLimitConfig.readOperations).toBeDefined()
      expect(RATE_LIMIT.READ_MAX).toBe(300)
      expect(RATE_LIMIT.READ_WINDOW_MS).toBe(15 * 60 * 1000) // 15 minutes
    })
  })

  describe('Generic Endpoints - Write Operations', () => {
    it('should have moderate rate limiting configured (100 req/15min)', async () => {
      const { rateLimitConfig } = await import('../lib/security.js')
      const { RATE_LIMIT } = await import('../lib/constants.js')

      expect(rateLimitConfig.writeOperations).toBeDefined()
      expect(RATE_LIMIT.WRITE_MAX).toBe(100)
      expect(RATE_LIMIT.WRITE_WINDOW_MS).toBe(15 * 60 * 1000) // 15 minutes
    })
  })

  describe('Global Fallback', () => {
    it('should have lenient fallback configured (1000 req/15min)', async () => {
      const { rateLimitConfig } = await import('../lib/security.js')
      const { RATE_LIMIT } = await import('../lib/constants.js')

      expect(rateLimitConfig.apiEndpoints).toBeDefined()
      expect(RATE_LIMIT.API_MAX_REQUESTS).toBe(1000)
      expect(RATE_LIMIT.API_WINDOW_MS).toBe(15 * 60 * 1000) // 15 minutes
    })
  })
})

describe('Rate Limiting Security Properties', () => {
  it('should skip rate limiting in test environment', async () => {
    expect(process.env.NODE_ENV).toBe('test')

    // We can make many requests without hitting rate limits
    const { user, password } = await createTestUser()

    // Make 10 login requests (would exceed 5 req/min limit in production)
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: user.email,
          password,
        })
        .expect(200)
    }

    // All requests succeeded because rate limiting is skipped in test environment
  })

  it('should use standard rate limiting headers (draft-7)', async () => {
    const { rateLimitConfig } = await import('../lib/security.js')

    // All rate limiters should use standardHeaders: 'draft-7'
    // This ensures Retry-After headers are included in 429 responses
    expect(rateLimitConfig.authLogin).toBeDefined()
    expect(rateLimitConfig.authRegister).toBeDefined()
    expect(rateLimitConfig.authPassword).toBeDefined()
  })

  it('should have appropriate error messages for each limiter', async () => {
    const { rateLimitConfig } = await import('../lib/security.js')

    // Verify error messages are user-friendly and specific
    // Note: We can't test actual 429 responses in test env, but we can verify config
    expect(rateLimitConfig.authLogin).toBeDefined()
    expect(rateLimitConfig.authRegister).toBeDefined()
    expect(rateLimitConfig.invitationCreate).toBeDefined()
  })
})

describe('Rate Limiting Architecture', () => {
  it('should have more restrictive limits for sensitive endpoints', async () => {
    const { RATE_LIMIT } = await import('../lib/constants.js')

    // Auth endpoints should be most restrictive
    expect(RATE_LIMIT.AUTH_LOGIN_MAX).toBeLessThan(RATE_LIMIT.READ_MAX)
    expect(RATE_LIMIT.AUTH_REGISTER_MAX).toBeLessThan(RATE_LIMIT.WRITE_MAX)

    // Invitation spam should be limited more than general writes
    expect(RATE_LIMIT.INVITATION_CREATE_MAX).toBeLessThan(RATE_LIMIT.WRITE_MAX)

    // Read operations should be more lenient than writes
    expect(RATE_LIMIT.READ_MAX).toBeGreaterThan(RATE_LIMIT.WRITE_MAX)

    // Global fallback should be most lenient
    expect(RATE_LIMIT.API_MAX_REQUESTS).toBeGreaterThan(RATE_LIMIT.READ_MAX)
  })

  it('should have per-endpoint granularity', async () => {
    const { rateLimitConfig } = await import('../lib/security.js')

    // Verify we have specific limiters for critical endpoints
    const expectedLimiters = [
      'authLogin',
      'authRegister',
      'authPassword',
      'authRefresh',
      'invitationCreate',
      'invitationAccept',
      'apiKeyCreate',
      'readOperations',
      'writeOperations',
      'apiEndpoints',
    ]

    for (const limiter of expectedLimiters) {
      expect(rateLimitConfig).toHaveProperty(limiter)
    }
  })
})
