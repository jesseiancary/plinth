import type { Request, Response } from 'express'
import { Router } from 'express'

import { generateApiKey, hashApiKey } from '../lib/api-key.js'
import { asyncHandler } from '../lib/async-handler.js'
import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { rateLimitConfig } from '../lib/security.js'
import {
  apiKeyIdParamSchema,
  createApiKeySchema,
  listApiKeysQuerySchema,
} from '../lib/validation/api-keys.js'
import { authenticateJWT, requireRole } from '../middleware/auth.js'

const router = Router()

// Apply JWT authentication to all API key routes
router.use(authenticateJWT)

/**
 * POST /api/v1/orgs/:slug/api-keys
 * Generate a new API key for the organization
 */
router.post(
  '/:slug/api-keys',
  rateLimitConfig.apiKeyCreate,
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = createApiKeySchema.parse(req.body)

    if (!req.tenantId) {
      throw new AppError('Tenant context required', 500, 'INTERNAL_ERROR')
    }

    // Generate API key
    const key = generateApiKey()
    const keyHash = hashApiKey(key)

    // Create API key record
    const apiKey = await prisma.apiKey.create({
      data: {
        name: body.name,
        keyHash,
        scopes: body.scopes,
        organizationId: req.tenantId,
      },
    })

    res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      key, // Only returned once
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
    })
  }),
)

/**
 * GET /api/v1/orgs/:slug/api-keys
 * List all API keys for the organization
 */
router.get(
  '/:slug/api-keys',
  rateLimitConfig.readOperations,
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listApiKeysQuerySchema.parse(req.query)

    if (!req.tenantId) {
      throw new AppError('Tenant context required', 500, 'INTERNAL_ERROR')
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        organizationId: req.tenantId,
        ...(query.active ? { revokedAt: null } : {}),
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      orderBy: {
        id: 'asc',
      },
      take: query.limit + 1,
    })

    const hasMore = apiKeys.length > query.limit
    const data = hasMore ? apiKeys.slice(0, -1) : apiKeys
    const lastItem = data[data.length - 1]
    const nextCursor = hasMore && lastItem ? lastItem.id : null

    res.json({
      data: data.map((key) => ({
        id: key.id,
        name: key.name,
        scopes: key.scopes,
        lastUsedAt: key.lastUsedAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
      })),
      nextCursor,
    })
  }),
)

/**
 * DELETE /api/v1/orgs/:slug/api-keys/:keyId
 * Revoke an API key (soft delete)
 */
router.delete(
  '/:slug/api-keys/:keyId',
  rateLimitConfig.writeOperations,
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { keyId } = apiKeyIdParamSchema.parse(req.params)

    if (!req.tenantId) {
      throw new AppError('Tenant context required', 500, 'INTERNAL_ERROR')
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    })

    if (!apiKey || apiKey.organizationId !== req.tenantId) {
      throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND')
    }

    if (apiKey.revokedAt) {
      throw new AppError('API key already revoked', 404, 'API_KEY_NOT_FOUND')
    }

    // Soft delete - set revokedAt timestamp
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    })

    res.status(204).send()
  }),
)

export default router
