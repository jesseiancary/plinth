/**
 * Query key factory for consistent cache key management across the app.
 *
 * Follows best practices from TanStack Query documentation:
 * - Hierarchical structure for easy invalidation
 * - Type-safe key generation
 * - Consistent naming conventions
 */

export const queryKeys = {
  // Auth keys
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },

  // Organization keys
  organizations: {
    all: ['organizations'] as const,
    detail: (slug: string) => [...queryKeys.organizations.all, slug] as const,
  },

  // Member keys
  members: {
    all: ['members'] as const,
    lists: () => [...queryKeys.members.all, 'list'] as const,
    list: (orgSlug: string, cursor?: string) =>
      [...queryKeys.members.lists(), orgSlug, { cursor }] as const,
  },

  // Invitation keys
  invitations: {
    all: ['invitations'] as const,
    lists: () => [...queryKeys.invitations.all, 'list'] as const,
    list: (orgSlug: string, cursor?: string) =>
      [...queryKeys.invitations.lists(), orgSlug, { cursor }] as const,
  },

  // API key keys
  apiKeys: {
    all: ['apiKeys'] as const,
    lists: () => [...queryKeys.apiKeys.all, 'list'] as const,
    list: (orgSlug: string) => [...queryKeys.apiKeys.lists(), orgSlug] as const,
  },
} as const
