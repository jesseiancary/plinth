import type { Request, Response } from 'express'
import { Router } from 'express'

import { asyncHandler } from '../lib/async-handler.js'
import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { rateLimitConfig } from '../lib/security.js'
import { createOrgSchema, orgSlugParamSchema, updateOrgSchema } from '../lib/validation/orgs.js'
import { authenticateJWT, requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// Apply JWT authentication to all organization routes
router.use(authenticateJWT)

/**
 * POST /api/v1/orgs
 * Create a new organization and assign the creator as OWNER
 */
router.post(
  '/',
  rateLimitConfig.writeOperations,
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const body = createOrgSchema.parse(req.body)

    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED')
    }

    // Check if slug already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: body.slug },
    })

    if (existingOrg) {
      throw new AppError('Organization slug already exists', 409, 'ORG_SLUG_EXISTS')
    }

    // Create organization and membership in a transaction
    const organization = await prisma.organization.create({
      data: {
        name: body.name,
        slug: body.slug,
        memberships: {
          create: {
            role: 'OWNER',
            userId: req.user.id,
          },
        },
      },
      include: {
        memberships: {
          where: {
            userId: req.user.id,
          },
        },
      },
    })

    const membership = organization.memberships[0]
    if (!membership) {
      throw new AppError('Failed to create membership', 500, 'INTERNAL_ERROR')
    }

    res.status(201).json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      membership: {
        id: membership.id,
        role: membership.role,
        createdAt: membership.createdAt,
      },
    })
  }),
)

/**
 * GET /api/v1/orgs/:slug
 * Get organization details (requires membership)
 */
router.get(
  '/:slug',
  rateLimitConfig.readOperations,
  requireRole('OWNER', 'ADMIN', 'MEMBER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { slug } = orgSlugParamSchema.parse(req.params)

    const organization = await prisma.organization.findUnique({
      where: { slug },
    })

    if (!organization) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
    }

    res.json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    })
  }),
)

/**
 * PATCH /api/v1/orgs/:slug
 * Update organization name and/or slug (requires ADMIN role)
 */
router.patch(
  '/:slug',
  rateLimitConfig.writeOperations,
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { slug } = orgSlugParamSchema.parse(req.params)
    const body = updateOrgSchema.parse(req.body)

    if (!req.tenantId) {
      throw new AppError('Tenant context required', 500, 'INTERNAL_ERROR')
    }

    // If changing slug, check if new slug is already taken
    if (body.slug && body.slug !== slug) {
      const existingOrg = await prisma.organization.findUnique({
        where: { slug: body.slug },
      })

      if (existingOrg) {
        throw new AppError('Organization slug already exists', 409, 'ORG_SLUG_EXISTS')
      }
    }

    // Build update data object with only defined fields
    const updateData: { name?: string; slug?: string } = {}
    if (body.name !== undefined) {
      updateData.name = body.name
    }
    if (body.slug !== undefined) {
      updateData.slug = body.slug
    }

    const organization = await prisma.organization.update({
      where: { id: req.tenantId },
      data: updateData,
    })

    res.json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    })
  }),
)

/**
 * DELETE /api/v1/orgs/:slug
 * Delete organization and all associated data (requires OWNER role)
 */
router.delete(
  '/:slug',
  rateLimitConfig.writeOperations,
  requireRole('OWNER'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.tenantId) {
      throw new AppError('Tenant context required', 500, 'INTERNAL_ERROR')
    }

    // Delete organization (cascades to memberships, invitations, API keys)
    await prisma.organization.delete({
      where: { id: req.tenantId },
    })

    res.status(204).send()
  }),
)

export default router
