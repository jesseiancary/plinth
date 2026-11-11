import type { NextFunction, Request, Response } from 'express'

import { hashApiKey } from '../lib/api-key.js'
import { prisma } from '../lib/db.js'
import { AppError } from '../lib/errors.js'
import { verifyAccessToken } from '../lib/jwt.js'
import { logSecurityEvent } from '../lib/security-logger.js'
import type { Scope } from '../lib/validation/api-keys.js'
import { orgSlugParamSchema } from '../lib/validation/orgs.js'

/**
 * Authenticated API-key context attached to the request by
 * authenticateApiKeyOptional and consumed by requireRoleOrScope.
 */
export interface ApiKeyContext {
  id: string
  organizationId: string
  scopes: string[]
}

// Extend Express Request type to include user, API key, and tenantId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
      }
      apiKey?: ApiKeyContext
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

    // Verify token version matches (invalidates access tokens on password change)
    if (user.tokenVersion !== payload.tokenVersion) {
      return next()
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
    }

    next()
  } catch {
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
 * Resolve the JWT caller's membership for the `:slug` org, enforce the role
 * requirement, and set req.tenantId. Shared by requireRole and the JWT branch
 * of requireRoleOrScope so both follow the same 404-vs-403 isolation rules.
 */
async function resolveMembershipRole(req: Request, allowedRoles: string[]): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHENTICATED')
  }

  // Extract organization slug from params
  const { slug: orgSlug } = orgSlugParamSchema.parse(req.params)

  if (!orgSlug || typeof orgSlug !== 'string') {
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
}

/**
 * Middleware to require a specific role within an organization
 * Must be used after authenticateJWT and requires organizationId in params
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await resolveMembershipRole(req, allowedRoles)
      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware allowing EITHER a JWT member with a sufficient role OR an API key
 * (populated by authenticateApiKeyOptional) that is scoped to the `:slug` org
 * and carries the required scope.
 *
 * API-key branch:
 *   - org missing OR key belongs to a different org -> 404 (no-leak, matches requireRole)
 *   - required scope not granted                     -> 403 INSUFFICIENT_SCOPE
 * Otherwise falls back to the JWT role check. Must run after both
 * authenticateJWT and authenticateApiKeyOptional.
 */
export function requireRoleOrScope(allowedRoles: string[], scope: Scope) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.apiKey) {
        const { slug: orgSlug } = orgSlugParamSchema.parse(req.params)

        const organization = await prisma.organization.findUnique({
          where: { slug: orgSlug },
        })

        // Scope the key to its own org only; anything else is indistinguishable
        // from a non-existent org (don't leak existence across tenants).
        if (!organization || req.apiKey.organizationId !== organization.id) {
          logSecurityEvent('AUTHORIZATION_FAILURE', req, {
            reason: 'api_key_org_mismatch',
            keyId: req.apiKey.id,
            keyOrganizationId: req.apiKey.organizationId,
          })
          throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
        }

        if (!req.apiKey.scopes.includes(scope)) {
          logSecurityEvent('AUTHORIZATION_FAILURE', req, {
            reason: 'insufficient_scope',
            requiredScope: scope,
            keyId: req.apiKey.id,
          })
          throw new AppError('Insufficient scope for this operation', 403, 'INSUFFICIENT_SCOPE')
        }

        req.tenantId = organization.id
        next()
        return
      }

      await resolveMembershipRole(req, allowedRoles)
      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Validate a plaintext API key: hash it, look up the record, and reject
 * unknown or revoked keys. Bumps lastUsedAt (fire-and-forget).
 */
async function verifyApiKey(key: string): Promise<ApiKeyContext> {
  const keyHash = hashApiKey(key)

  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { keyHash },
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

  return {
    id: apiKeyRecord.id,
    organizationId: apiKeyRecord.organizationId,
    scopes: apiKeyRecord.scopes,
  }
}

/**
 * Non-throwing API-key populator (mirrors authenticateJWT): if the Bearer token
 * is an `sk_live_` key, validate it and attach req.apiKey; a missing header or a
 * non-`sk_live_` token (i.e. a JWT) passes through untouched so the JWT path can
 * run. Only an invalid/revoked key rejects the request.
 */
export async function authenticateApiKeyOptional(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next()
    }

    const key = authHeader.substring(7)

    // Not an API key (e.g. a JWT access token) - leave for the JWT path
    if (!key.startsWith('sk_live_')) {
      return next()
    }

    req.apiKey = await verifyApiKey(key)

    next()
  } catch (error) {
    // Surface the new API-key failure modes as WARN-level security events.
    if (error instanceof AppError) {
      if (error.code === 'INVALID_API_KEY') {
        logSecurityEvent('INVALID_API_KEY', req, { reason: 'unknown_api_key' })
      } else if (error.code === 'API_KEY_REVOKED') {
        logSecurityEvent('REVOKED_API_KEY_USED', req)
      }
    }
    next(error)
  }
}
