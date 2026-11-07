import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { InfiniteData } from '@tanstack/react-query'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { useCurrentMembership } from '../hooks/useCurrentMembership'

import { api } from '@/lib/api-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { sanitizeDisplayText } from '@/lib/sanitize'
import { Badge } from '@/shared/components/Badge'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { DashboardLayout } from '@/shared/components/DashboardLayout'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'

type Membership = components['schemas']['Membership']
type Role = Membership['role']

interface MembersResponse {
  data: Membership[]
  nextCursor: string | null
}

export function MembersPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const current = useCurrentMembership(orgSlug)

  const [actionError, setActionError] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<Membership | null>(null)

  const listKey = queryKeys.members.list(orgSlug ?? '')

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: listKey, // stable key; the cursor is the pageParam, not part of the key
      queryFn: ({ pageParam }: { pageParam: string | undefined }): Promise<MembersResponse> =>
        api.get(`/api/v1/orgs/${orgSlug}/members${pageParam ? `?cursor=${pageParam}` : ''}`),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: Boolean(orgSlug),
    })

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: Role }) =>
      api.patch(`/api/v1/orgs/${orgSlug}/members/${memberId}`, { role }),
    onMutate: async ({ memberId, role }) => {
      // Optimistically reflect the new role immediately; roll back in onError.
      setActionError(null)
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueryData(listKey)
      queryClient.setQueryData<InfiniteData<MembersResponse>>(
        listKey,
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((m) => (m.id === memberId ? { ...m, role } : m)),
            })),
          },
      )
      return { previous }
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous)
      }
      setActionError(getApiErrorMessage(mutationError))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.lists() })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/api/v1/orgs/${orgSlug}/members/${memberId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.members.lists() })
      // If the user removed themselves, their memberships changed — refresh and
      // leave the org context.
      if (current.userId && memberToRemove?.userId === current.userId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })
        void navigate('/')
      }
      setMemberToRemove(null)
    },
    onError: (mutationError) => {
      setActionError(getApiErrorMessage(mutationError))
    },
  })

  const handleRoleChange = (memberId: string, role: Role) => {
    roleMutation.mutate({ memberId, role })
  }

  const openRemoveDialog = (member: Membership) => {
    setActionError(null)
    setMemberToRemove(member)
  }

  const handleConfirmRemove = () => {
    if (!memberToRemove) {
      return
    }
    setActionError(null)
    removeMutation.mutate(memberToRemove.id)
  }

  const closeRemoveDialog = () => {
    if (removeMutation.isPending) {
      return
    }
    setMemberToRemove(null)
    setActionError(null)
  }

  const members = data?.pages.flatMap((page) => page.data) ?? []
  const removingSelf = Boolean(
    memberToRemove && current.userId && memberToRemove.userId === current.userId,
  )

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Members</h1>
          <p className="mt-2 text-gray-600">Manage your organization's team members</p>
        </div>

        {actionError && !memberToRemove && (
          <div className="mb-4 rounded-md bg-red-50 p-4" role="alert">
            <p className="text-sm text-danger">{actionError}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {error && <ErrorMessage error={error} title="Failed to load members" />}

        {!isLoading && !error && members.length === 0 && (
          <EmptyState
            icon={
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            }
            title="No team members"
            description="This organization doesn't have any members yet."
          />
        )}

        {!isLoading && !error && members.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Member
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Role
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Joined
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {members.map((member) => {
                  const isSelf = member.userId === current.userId
                  const isOwnerRow = member.role === 'OWNER'
                  // Admins may manage members; only owners may change an owner's role.
                  const canManage = current.isAdmin && !isSelf && (!isOwnerRow || current.isOwner)
                  const isRoleMutating =
                    roleMutation.isPending && roleMutation.variables?.memberId === member.id

                  return (
                    <tr key={member.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {sanitizeDisplayText(member.user.name)}
                            {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                          </div>
                          <div className="text-sm text-gray-500">
                            {sanitizeDisplayText(member.user.email)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {canManage ? (
                          <label className="sr-only" htmlFor={`role-${member.id}`}>
                            Change role for {sanitizeDisplayText(member.user.name)}
                          </label>
                        ) : null}
                        {canManage ? (
                          <select
                            id={`role-${member.id}`}
                            value={member.role}
                            disabled={isRoleMutating}
                            onChange={(e) => {
                              handleRoleChange(member.id, e.currentTarget.value as Role)
                            }}
                            className="rounded-md border-gray-300 text-sm focus:border-brand-500 focus:ring-brand-500 disabled:opacity-50"
                          >
                            {isOwnerRow && <option value="OWNER">Owner</option>}
                            <option value="ADMIN">Admin</option>
                            <option value="MEMBER">Member</option>
                          </select>
                        ) : (
                          <Badge
                            variant={
                              member.role === 'OWNER'
                                ? 'success'
                                : member.role === 'ADMIN'
                                  ? 'warning'
                                  : 'default'
                            }
                          >
                            {member.role.toLowerCase()}
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {isSelf ? (
                          <button
                            className="text-red-600 hover:text-red-900"
                            onClick={() => openRemoveDialog(member)}
                          >
                            Leave
                          </button>
                        ) : canManage ? (
                          <button
                            className="text-red-600 hover:text-red-900"
                            onClick={() => openRemoveDialog(member)}
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {hasNextPage && (
              <div className="flex justify-center border-t border-gray-200 bg-gray-50 px-6 py-3">
                <button
                  className="text-sm font-medium text-brand-600 hover:text-brand-900 disabled:opacity-50"
                  disabled={isFetchingNextPage}
                  onClick={() => {
                    void fetchNextPage()
                  }}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        title={removingSelf ? 'Leave organization' : 'Remove member'}
        message={
          removingSelf ? (
            'Are you sure you want to leave this organization? You will lose access to its resources.'
          ) : (
            <>
              Remove{' '}
              <span className="font-medium text-gray-900">
                {sanitizeDisplayText(memberToRemove?.user.name ?? '')}
              </span>{' '}
              from this organization? This cannot be undone.
            </>
          )
        }
        confirmLabel={removingSelf ? 'Leave' : 'Remove'}
        variant="danger"
        isPending={removeMutation.isPending}
        errorMessage={memberToRemove ? (actionError ?? undefined) : undefined}
        onConfirm={handleConfirmRemove}
        onClose={closeRemoveDialog}
      />
    </DashboardLayout>
  )
}
