import { z } from 'zod'

// Role enum matching Prisma schema
export const roleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER'])

export const updateMemberRoleSchema = z.object({
  role: roleSchema,
})

export const memberIdParamSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
})

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1, 'New owner user ID is required'),
})

export const listMembersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must not exceed 100')
    .default(20),
})

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>
export type MemberIdParam = z.infer<typeof memberIdParamSchema>
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>
export type Role = z.infer<typeof roleSchema>
