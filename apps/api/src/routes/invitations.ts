import type { Request, Response } from 'express'
import { Router } from 'express'

import { asyncHandler } from '../lib/async-handler.js'
import { sha256 } from '../lib/crypto.js'
import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import {
  acceptInvitationSchema,
  invitationTokenParamSchema,
} from '../lib/validation/invitations.js'
import { authenticateJWT, requireAuth } from '../middleware/auth.js'

const router = Router()

/**
 * GET /api/v1/invitations/validate/:token
 * Validate an invitation token (public endpoint, no auth required)
 */
router.get(
  '/validate/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = invitationTokenParamSchema.parse(req.params)

    const tokenHash = sha256(token)

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    })

    if (!invitation) {
      throw new AppError('Invalid invitation token', 404, 'INVALID_TOKEN')
    }

    // Check status
    if (invitation.status === 'REVOKED') {
      throw new AppError('Invitation has been revoked', 410, 'INVITATION_REVOKED')
    }

    if (invitation.status === 'ACCEPTED') {
      throw new AppError('Invitation has already been accepted', 410, 'INVITATION_ALREADY_ACCEPTED')
    }

    // Check expiry
    if (invitation.expiresAt < new Date()) {
      // Mark as expired if not already
      if (invitation.status === 'PENDING') {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        })
      }

      throw new AppError('Invitation has expired', 410, 'INVITATION_EXPIRED')
    }

    res.json({
      email: invitation.email,
      role: invitation.role,
      organization: {
        name: invitation.organization.name,
        slug: invitation.organization.slug,
      },
      expiresAt: invitation.expiresAt,
    })
  }),
)

/**
 * POST /api/v1/invitations/accept
 * Accept an invitation and join the organization
 */
router.post(
  '/accept',
  authenticateJWT,
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const body = acceptInvitationSchema.parse(req.body)

    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED')
    }

    const tokenHash = sha256(body.token)

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        organization: true,
      },
    })

    if (!invitation) {
      throw new AppError('Invalid invitation token', 404, 'INVALID_TOKEN')
    }

    // Check status
    if (invitation.status === 'REVOKED') {
      throw new AppError('Invitation has been revoked', 410, 'INVITATION_REVOKED')
    }

    if (invitation.status === 'ACCEPTED') {
      throw new AppError('Invitation has already been accepted', 410, 'INVITATION_ALREADY_ACCEPTED')
    }

    // Check expiry
    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      })

      throw new AppError('Invitation has expired', 410, 'INVITATION_EXPIRED')
    }

    // Check if user is already a member
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: invitation.organizationId,
        },
      },
    })

    if (existingMembership) {
      throw new AppError('User is already a member', 409, 'USER_ALREADY_MEMBER')
    }

    // Create membership and mark invitation as accepted in a transaction
    const [membership] = await prisma.$transaction([
      prisma.membership.create({
        data: {
          userId: req.user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
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
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      }),
    ])

    res.status(201).json({
      membership: {
        id: membership.id,
        role: membership.role,
        userId: membership.userId,
        user: membership.user,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      },
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        slug: invitation.organization.slug,
        createdAt: invitation.organization.createdAt,
        updatedAt: invitation.organization.updatedAt,
      },
    })
  }),
)

export default router
