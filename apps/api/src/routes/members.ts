import type { Request, Response } from 'express'
import { Router } from 'express'

import { asyncHandler } from '../lib/async-handler.js'
import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { rateLimitConfig } from '../lib/security.js'
import {
  listMembersQuerySchema,
  memberIdParamSchema,
  transferOwnershipSchema,
  updateMemberRoleSchema,
} from '../lib/validation/members.js'
import { authenticateJWT, requireRole } from '../middleware/auth.js'

const router = Router()

// Apply JWT authentication to all member routes
router.use(authenticateJWT)

/**
 * GET /api/v1/orgs/:slug/members
 * List all members of an organization with pagination
 */
router.get(
  '/:slug/members',
  rateLimitConfig.readOperations,
  requireRole('OWNER', 'ADMIN', 'MEMBER'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listMembersQuerySchema.parse(req.query)

    if (!req.tenantId) {
      throw new AppError('Tenant context required', 500, 'INTERNAL_ERROR')
    }

    const memberships = await prisma.membership.findMany({
      where: {
        organizationId: req.tenantId,
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
      take: query.limit + 1, // Fetch one extra to determine if there's a next page
    })

    const hasMore = memberships.length > query.limit
    const data = hasMore ? memberships.slice(0, -1) : memberships
    const lastItem = data[data.length - 1]
    const nextCursor = hasMore && lastItem ? lastItem.id : null

    res.json({
      data: data.map((m) => ({
        id: m.id,
        role: m.role,
        userId: m.userId,
        user: m.user,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      nextCursor,
    })
  }),
)

/**
 * PATCH /api/v1/orgs/:slug/members/:memberId
 * Update a member's role
 */
router.patch(
  '/:slug/members/:memberId',
  rateLimitConfig.writeOperations,
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = memberIdParamSchema.parse(req.params)
    const body = updateMemberRoleSchema.parse(req.body)

    if (!req.user || !req.tenantId) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED')
    }

    // Get the membership to update
    const targetMembership = await prisma.membership.findUnique({
      where: { id: memberId },
      include: {
        organization: true,
      },
    })

    if (!targetMembership || targetMembership.organizationId !== req.tenantId) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND')
    }

    // Get caller's membership
    const callerMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: req.tenantId,
        },
      },
    })

    if (!callerMembership) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
    }

    // RBAC checks
    // Cannot demote an OWNER unless you are an OWNER
    if (targetMembership.role === 'OWNER' && callerMembership.role !== 'OWNER') {
      throw new AppError('Cannot demote owner', 403, 'CANNOT_DEMOTE_OWNER')
    }

    // If changing an OWNER's role, check last owner protection
    if (targetMembership.role === 'OWNER' && body.role !== 'OWNER') {
      const ownerCount = await prisma.membership.count({
        where: {
          organizationId: req.tenantId,
          role: 'OWNER',
        },
      })

      if (ownerCount <= 1) {
        throw new AppError('Cannot remove last owner', 409, 'LAST_OWNER_PROTECTION')
      }
    }

    // Update the role
    const updatedMembership = await prisma.membership.update({
      where: { id: memberId },
      data: { role: body.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
    })

    res.json({
      id: updatedMembership.id,
      role: updatedMembership.role,
      userId: updatedMembership.userId,
      user: updatedMembership.user,
      createdAt: updatedMembership.createdAt,
      updatedAt: updatedMembership.updatedAt,
    })
  }),
)

/**
 * DELETE /api/v1/orgs/:slug/members/:memberId
 * Remove a member from the organization
 */
router.delete(
  '/:slug/members/:memberId',
  rateLimitConfig.writeOperations,
  requireRole('OWNER', 'ADMIN', 'MEMBER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = memberIdParamSchema.parse(req.params)

    if (!req.user || !req.tenantId) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED')
    }

    // Get the membership to remove
    const targetMembership = await prisma.membership.findUnique({
      where: { id: memberId },
    })

    if (!targetMembership || targetMembership.organizationId !== req.tenantId) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND')
    }

    // Get caller's membership
    const callerMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: req.tenantId,
        },
      },
    })

    if (!callerMembership) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
    }

    const isSelf = targetMembership.userId === req.user.id

    // Permission checks
    if (!isSelf) {
      // Removing someone else - requires ADMIN or OWNER
      if (callerMembership.role === 'MEMBER') {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
      }

      // ADMIN cannot remove OWNER
      if (targetMembership.role === 'OWNER' && callerMembership.role !== 'OWNER') {
        throw new AppError('Cannot remove owner', 403, 'CANNOT_REMOVE_OWNER')
      }
    }

    // Last owner protection
    if (targetMembership.role === 'OWNER') {
      const ownerCount = await prisma.membership.count({
        where: {
          organizationId: req.tenantId,
          role: 'OWNER',
        },
      })

      if (ownerCount <= 1) {
        throw new AppError('Cannot remove last owner', 409, 'LAST_OWNER_PROTECTION')
      }
    }

    // Delete the membership
    await prisma.membership.delete({
      where: { id: memberId },
    })

    res.status(204).send()
  }),
)

/**
 * POST /api/v1/orgs/:slug/transfer-ownership
 * Transfer OWNER role to another member
 */
router.post(
  '/:slug/transfer-ownership',
  rateLimitConfig.writeOperations,
  requireRole('OWNER'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = transferOwnershipSchema.parse(req.body)

    if (!req.user || !req.tenantId) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED')
    }

    // Prevent transferring to self
    if (body.newOwnerId === req.user.id) {
      throw new AppError('Cannot transfer ownership to yourself', 400, 'CANNOT_TRANSFER_TO_SELF')
    }

    // Get the new owner's membership
    const newOwnerMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: body.newOwnerId,
          organizationId: req.tenantId,
        },
      },
    })

    if (!newOwnerMembership) {
      throw new AppError('New owner must be an existing member', 404, 'NEW_OWNER_NOT_MEMBER')
    }

    // Get current owner's membership
    const currentOwnerMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: req.tenantId,
        },
      },
    })

    if (!currentOwnerMembership) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
    }

    // Transfer ownership in a transaction
    const [newOwner, formerOwner] = await prisma.$transaction([
      // Promote new owner
      prisma.membership.update({
        where: { id: newOwnerMembership.id },
        data: { role: 'OWNER' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
            },
          },
        },
      }),
      // Demote current owner to ADMIN
      prisma.membership.update({
        where: { id: currentOwnerMembership.id },
        data: { role: 'ADMIN' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
            },
          },
        },
      }),
    ])

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: req.tenantId },
    })

    if (!organization) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
    }

    res.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
      newOwner: {
        id: newOwner.id,
        userId: newOwner.userId,
        role: newOwner.role,
        updatedAt: newOwner.updatedAt,
      },
      formerOwner: {
        id: formerOwner.id,
        userId: formerOwner.userId,
        role: formerOwner.role,
        updatedAt: formerOwner.updatedAt,
      },
    })
  }),
)

export default router
