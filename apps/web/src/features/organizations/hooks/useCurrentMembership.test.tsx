import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useCurrentMembership } from './useCurrentMembership'

import { queryKeys } from '@/lib/query-keys'

const user = {
  id: 'user-1',
  email: 'me@acme.test',
  name: 'Me',
  createdAt: '2024-01-01T00:00:00Z',
  memberships: [
    {
      id: 'mem-1',
      role: 'ADMIN',
      organization: {
        id: 'org-1',
        name: 'Acme',
        slug: 'acme',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
    {
      id: 'mem-2',
      role: 'OWNER',
      organization: {
        id: 'org-2',
        name: 'Beta',
        slug: 'beta',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
  ],
}

const wrapperWithSeededCache = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(queryKeys.auth.me(), user)
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useCurrentMembership', () => {
  it('derives admin role for the matching org', async () => {
    const { result } = renderHook(() => useCurrentMembership('acme'), {
      wrapper: wrapperWithSeededCache(),
    })

    await waitFor(() => {
      expect(result.current.role).toBe('ADMIN')
    })
    expect(result.current.userId).toBe('user-1')
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isOwner).toBe(false)
  })

  it('derives owner role for a different org', async () => {
    const { result } = renderHook(() => useCurrentMembership('beta'), {
      wrapper: wrapperWithSeededCache(),
    })

    await waitFor(() => {
      expect(result.current.role).toBe('OWNER')
    })
    expect(result.current.isOwner).toBe(true)
    expect(result.current.isAdmin).toBe(true)
  })

  it('returns null role when the user has no membership in the org', async () => {
    const { result } = renderHook(() => useCurrentMembership('gamma'), {
      wrapper: wrapperWithSeededCache(),
    })

    await waitFor(() => {
      expect(result.current.userId).toBe('user-1')
    })
    expect(result.current.role).toBeNull()
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isOwner).toBe(false)
  })
})
