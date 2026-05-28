import { z } from 'zod'

import { roleSchema } from './members.js'

export const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  role: roleSchema.default('MEMBER'),
})

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
})

export const invitationTokenParamSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
})

export const invitationIdParamSchema = z.object({
  invitationId: z.string().min(1, 'Invitation ID is required'),
})

export const listInvitationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must not exceed 100')
    .default(20),
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']).optional(),
})

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>
export type InvitationTokenParam = z.infer<typeof invitationTokenParamSchema>
export type InvitationIdParam = z.infer<typeof invitationIdParamSchema>
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>
