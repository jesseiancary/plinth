import { z } from 'zod'

// Valid API key scopes.
//
// Enforced today (see requireRoleOrScope wiring): org:read, org:write,
// members:read, invitations:read, invitations:write, api-keys:read.
//
// Reserved for destructive / privilege-escalating actions that remain JWT-only
// (human) and are therefore never reachable by an API key: org:delete,
// members:write, api-keys:write. They stay in the vocabulary so keys can be
// provisioned ahead of future support; granting them currently confers nothing
// (fail-safe — a key is never granted more than the API enforces).
const validScopes = [
  'org:read',
  'org:write',
  'org:delete',
  'members:read',
  'members:write',
  'invitations:read',
  'invitations:write',
  'api-keys:read',
  'api-keys:write',
] as const

export const scopeSchema = z.enum(validScopes)

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'API key name is required')
    .max(255, 'API key name must not exceed 255 characters'),
  scopes: z.array(scopeSchema).min(1, 'At least one scope is required').default(['org:read']),
})

export const apiKeyIdParamSchema = z.object({
  keyId: z.string().min(1, 'API key ID is required'),
})

export const listApiKeysQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must not exceed 100')
    .default(20),
  active: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
})

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>
export type ApiKeyIdParam = z.infer<typeof apiKeyIdParamSchema>
export type ListApiKeysQuery = z.infer<typeof listApiKeysQuerySchema>
export type Scope = z.infer<typeof scopeSchema>
