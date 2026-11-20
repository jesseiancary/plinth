import type { Request, Response } from 'express'
import { Router } from 'express'

import { asyncHandler } from '../lib/async-handler.js'
import { generateInvitationToken, sha256 } from '../lib/crypto.js'
import { prisma } from '../lib/db.js'
import { dispatchEmail } from '../lib/dispatch-email.js'
import { AppError } from '../lib/errors.js'
import { sendInvitationEmail } from '../lib/invitation-emails.js'
import { rateLimitConfig } from '../lib/security.js'
import {
  createInvitationSchema,
  invitationIdParamSchema,
  listInvitationsQuerySchema,
} from '../lib/validation/invitations.js'
import { authenticateApiKeyOptional, requireRole, requireRoleOrScope } from '../middleware/auth.js'

const router = Router()

// JWT parsing is global (app.ts). Only authenticateApiKeyOptional is wired per-route
// — on the dual-auth GET/DELETE — so the JWT-only POST never touches the API-key hash
// lookup / lastUsedAt write.

/**
 * POST /api/v1/orgs/:slug/invitations
 * Create an invitation to join the organization
 */
router.post(
  '/:slug/invitations',
  rateLimitConfig.invitationCreate,
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = createInvitationSchema.parse(req.body)

    // req.organization is populated alongside req.tenantId by requireRole; assert it here so the
    // invitation email can name the org without re-querying the row the middleware already resolved.
    if (!req.user || !req.tenantId || !req.organization) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED')
    }

    // Check if user with this email is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
      include: {
        memberships: {
          where: {
            organizationId: req.tenantId,
          },
        },
      },
    })

    if (existingUser && existingUser.memberships.length > 0) {
      throw new AppError('User is already a member', 409, 'USER_ALREADY_MEMBER')
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: body.email,
        organizationId: req.tenantId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    })

    if (existingInvitation) {
      throw new AppError(
        'Pending invitation already exists for this email',
        409,
        'INVITATION_ALREADY_EXISTS',
      )
    }

    // Generate invitation token
    const token = generateInvitationToken()
    const tokenHash = sha256(token)

    // Create invitation (expires in 72 hours)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 72)

    // Pull the inviter's display name back from the same insert (invitedBy relation) so the email
    // copy needs no extra query. User.name is non-null, so there's a real name to show — no
    // fallback to the inviter's email (which would disclose it to the invitee).
    const invitation = await prisma.invitation.create({
      data: {
        email: body.email,
        role: body.role,
        tokenHash,
        status: 'PENDING',
        expiresAt,
        organizationId: req.tenantId,
        invitedById: req.user.id,
      },
      include: {
        invitedBy: {
          select: { name: true },
        },
      },
    })

    // Email the invitee the accept link. Capture the org name outside the closure (req is mutable,
    // so TS widens req.organization back to optional inside it). The plaintext token travels only
    // in the email — and, for now, the create response below.
    const organizationName = req.organization.name
    await dispatchEmail(() =>
      sendInvitationEmail({
        to: invitation.email,
        inviterName: invitation.invitedBy.name,
        organizationName,
        role: invitation.role,
        token,
      }),
    )

    res.status(201).json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
      token, // Only shown once
    })
  }),
)

/**
 * GET /api/v1/orgs/:slug/invitations
 * List all invitations for the organization
 */
router.get(
  '/:slug/invitations',
  rateLimitConfig.readOperations,
  authenticateApiKeyOptional,
  requireRoleOrScope(['OWNER', 'ADMIN'], 'invitations:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listInvitationsQuerySchema.parse(req.query)

    if (!req.tenantId) {
      throw new AppError('Tenant context required', 500, 'INTERNAL_ERROR')
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: req.tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      orderBy: {
        id: 'asc',
      },
      take: query.limit + 1,
    })

    const hasMore = invitations.length > query.limit
    const data = hasMore ? invitations.slice(0, -1) : invitations
    const lastItem = data[data.length - 1]
    const nextCursor = hasMore && lastItem ? lastItem.id : null

    res.json({
      data: data.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        createdAt: inv.createdAt,
      })),
      nextCursor,
    })
  }),
)

/**
 * DELETE /api/v1/orgs/:slug/invitations/:invitationId
 * Revoke a pending invitation
 */
router.delete(
  '/:slug/invitations/:invitationId',
  rateLimitConfig.writeOperations,
  authenticateApiKeyOptional,
  requireRoleOrScope(['OWNER', 'ADMIN'], 'invitations:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const { invitationId } = invitationIdParamSchema.parse(req.params)

    if (!req.tenantId) {
      throw new AppError('Tenant context required', 500, 'INTERNAL_ERROR')
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    })

    if (!invitation || invitation.organizationId !== req.tenantId) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND')
    }

    if (invitation.status !== 'PENDING') {
      throw new AppError(
        'Invitation already processed',
        410,
        invitation.status === 'ACCEPTED' ? 'INVITATION_ALREADY_ACCEPTED' : 'INVITATION_REVOKED',
      )
    }

    // Mark as revoked
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    })

    res.status(204).send()
  }),
)

export default router
