import { describe, expect, it } from 'vitest'

import { getConfiguredLogLevel, logger, sanitizeLogData } from './logger.js'

describe('logger', () => {
  it('should be defined', () => {
    expect(logger).toBeDefined()
  })

  it('should have all standard log levels', () => {
    expect(logger.error).toBeDefined()
    expect(logger.warn).toBeDefined()
    expect(logger.info).toBeDefined()
    expect(logger.http).toBeDefined()
    expect(logger.debug).toBeDefined()
  })

  it('should return silent log level in test environment', () => {
    expect(getConfiguredLogLevel()).toBe('silent')
  })
})

describe('sanitizeLogData', () => {
  it('should redact password fields', () => {
    const data = {
      email: 'user@example.com',
      password: 'secret123',
      name: 'John Doe',
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.email).toBe('user@example.com')
    expect(sanitized.password).toBe('[REDACTED]')
    expect(sanitized.name).toBe('John Doe')
  })

  it('should redact passwordHash fields', () => {
    const data = {
      userId: '123',
      passwordHash: '$2b$10$abcdefg',
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.userId).toBe('123')
    expect(sanitized.passwordHash).toBe('[REDACTED]')
  })

  it('should redact token fields', () => {
    const data = {
      userId: '123',
      token: 'abc123xyz',
      accessToken: 'jwt.abc.xyz',
      refreshToken: 'refresh.abc.xyz',
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.userId).toBe('123')
    expect(sanitized.token).toBe('[REDACTED]')
    expect(sanitized.accessToken).toBe('[REDACTED]')
    expect(sanitized.refreshToken).toBe('[REDACTED]')
  })

  it('should redact API key fields', () => {
    const data = {
      organizationId: 'org-123',
      apiKey: 'sk_live_abcdefg',
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.organizationId).toBe('org-123')
    expect(sanitized.apiKey).toBe('[REDACTED]')
  })

  it('should redact authorization headers', () => {
    const data = {
      headers: {
        'user-agent': 'Mozilla/5.0',
        authorization: 'Bearer token123',
      },
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.headers).toEqual({
      'user-agent': 'Mozilla/5.0',
      authorization: '[REDACTED]',
    })
  })

  it('should redact cookie headers', () => {
    const data = {
      headers: {
        cookie: 'refreshToken=abc123; sessionId=xyz789',
      },
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.headers).toEqual({
      cookie: '[REDACTED]',
    })
  })

  it('should redact secret fields', () => {
    const data = {
      config: {
        jwtSecret: 'super-secret-key',
        dbPassword: 'db-password-123',
      },
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.config).toEqual({
      jwtSecret: '[REDACTED]',
      dbPassword: '[REDACTED]',
    })
  })

  it('should redact CSRF tokens', () => {
    const data = {
      csrfToken: 'csrf-abc-123',
      userId: '456',
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.csrfToken).toBe('[REDACTED]')
    expect(sanitized.userId).toBe('456')
  })

  it('should handle nested objects recursively', () => {
    const data = {
      user: {
        id: '123',
        email: 'user@example.com',
        password: 'secret',
        profile: {
          name: 'John',
          apiKey: 'sk_live_xyz',
        },
      },
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.user).toEqual({
      id: '123',
      email: 'user@example.com',
      password: '[REDACTED]',
      profile: {
        name: 'John',
        apiKey: '[REDACTED]',
      },
    })
  })

  it('should preserve arrays', () => {
    const data = {
      users: ['user1', 'user2'],
      ids: [1, 2, 3],
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.users).toEqual(['user1', 'user2'])
    expect(sanitized.ids).toEqual([1, 2, 3])
  })

  it('should handle empty objects', () => {
    const data = {}

    const sanitized = sanitizeLogData(data)

    expect(sanitized).toEqual({})
  })

  it('should be case-insensitive for sensitive keys', () => {
    const data = {
      PASSWORD: 'secret',
      AccessToken: 'token123',
      ApiKey: 'sk_live_xyz',
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.PASSWORD).toBe('[REDACTED]')
    expect(sanitized.AccessToken).toBe('[REDACTED]')
    expect(sanitized.ApiKey).toBe('[REDACTED]')
  })

  it('should redact fields containing sensitive keywords', () => {
    const data = {
      userPassword: 'secret123',
      refreshTokenValue: 'abc-xyz',
      apiKeyHash: 'hash-value',
    }

    const sanitized = sanitizeLogData(data)

    expect(sanitized.userPassword).toBe('[REDACTED]')
    expect(sanitized.refreshTokenValue).toBe('[REDACTED]')
    expect(sanitized.apiKeyHash).toBe('[REDACTED]')
  })
})
