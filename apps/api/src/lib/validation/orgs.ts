import { z } from 'zod'

// Slug validation: lowercase alphanumeric + hyphens, 3-63 chars
// Cannot start/end with hyphen, no consecutive hyphens
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const createOrgSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(255, 'Organization name must not exceed 255 characters'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(63, 'Slug must not exceed 63 characters')
    .regex(slugRegex, 'Slug must be lowercase alphanumeric and hyphens only'),
})

export const updateOrgSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(255, 'Organization name must not exceed 255 characters')
    .optional(),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(63, 'Slug must not exceed 63 characters')
    .regex(slugRegex, 'Slug must be lowercase alphanumeric and hyphens only')
    .optional(),
})

export const orgSlugParamSchema = z.object({
  slug: z.string().min(1, 'Organization slug is required'),
})

export type CreateOrgInput = z.infer<typeof createOrgSchema>
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>
export type OrgSlugParam = z.infer<typeof orgSlugParamSchema>
