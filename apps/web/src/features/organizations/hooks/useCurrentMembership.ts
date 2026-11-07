import { useQuery } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

type User = components['schemas']['User']
type Organization = components['schemas']['Organization']

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'

interface UserWithMemberships extends User {
  memberships: Array<{
    id: string
    role: Role
    organization: Organization
  }>
}

export interface CurrentMembership {
  userId: string | null
  role: Role | null
  isOwner: boolean
  isAdmin: boolean
  isLoading: boolean
}

/**
 * Derives the authenticated user's role within a given organization from the
 * `GET /api/v1/auth/me` query (the single source of truth for memberships).
 *
 * Used for UI role-gating. The backend remains the authority — gating here only
 * hides controls the user cannot use; it is not a security boundary.
 */
export function useCurrentMembership(orgSlug: string | undefined): CurrentMembership {
  const { data: user, isLoading } = useQuery<UserWithMemberships>({
    queryKey: queryKeys.auth.me(),
    queryFn: () => api.get('/api/v1/auth/me'),
  })

  const membership = user?.memberships.find((m) => m.organization.slug === orgSlug)
  const role = membership?.role ?? null

  return {
    userId: user?.id ?? null,
    role,
    isOwner: role === 'OWNER',
    isAdmin: role === 'OWNER' || role === 'ADMIN',
    isLoading,
  }
}
