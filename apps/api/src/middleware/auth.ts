import type { NextFunction, Request, Response } from 'express'

import { hashApiKey } from '../lib/api-key.js'
import { AppError } from '../lib/errors.js'
import { verifyAccessToken } from '../lib/jwt.js'
import { prisma } from '../lib/prisma.js'

// Extend Express Request type to include user and tenantId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
      }
      tenantId?: string
    }
  }
}

/**
 * Middleware to verify JWT access token and attach user to request
 * Does NOT enforce authentication - use requireAuth for that
 */
export async function authenticateJWT(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next()
    }

    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return next()
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
    }

    next()
  } catch (error) {
    // Invalid token - just continue without setting req.user
    next()
  }
}

/**
 * Middleware to require authentication
 * Must be used after authenticateJWT
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHENTICATED')
  }
  next()
}

/**
 * Middleware to require a specific role within an organization
 * Must be used after authenticateJWT and requires organizationId in params
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED')
      }

      // Extract organization slug from params
      const orgSlug = req.params.slug

      if (!orgSlug) {
        throw new AppError('Organization slug required', 400, 'ORG_SLUG_REQUIRED')
      }

      // Find organization and membership
      const organization = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        include: {
          memberships: {
            where: {
              userId: req.user.id,
            },
          },
        },
      })

      if (!organization) {
        throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
      }

      const membership = organization.memberships[0]

      // 404 vs 403 decision: Non-members get 404 (don't leak org existence)
      if (!membership) {
        throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
      }

      if (!allowedRoles.includes(membership.role)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
      }

      // Attach tenant ID to request for query scoping
      req.tenantId = organization.id

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware to authenticate requests using API keys
 * API keys are provided via Authorization: Bearer sk_live_...
 * Sets req.tenantId to the organization ID associated with the key
 */
export async function authenticateApiKey(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('API key required', 401, 'API_KEY_REQUIRED')
    }

    const apiKey = authHeader.substring(7)

    // Verify API key format
    if (!apiKey.startsWith('sk_live_')) {
      throw new AppError('Invalid API key format', 401, 'INVALID_API_KEY')
    }

    // Hash the key and look it up
    const keyHash = hashApiKey(apiKey)

    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        organization: true,
      },
    })

    if (!apiKeyRecord) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY')
    }

    // Check if key is revoked
    if (apiKeyRecord.revokedAt) {
      throw new AppError('API key has been revoked', 401, 'API_KEY_REVOKED')
    }

    // Update last used timestamp (fire and forget)
    prisma.apiKey
      .update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // Ignore errors - this is not critical
      })

    // Set tenant context
    req.tenantId = apiKeyRecord.organizationId

    next()
  } catch (error) {
    next(error)
  }
}
