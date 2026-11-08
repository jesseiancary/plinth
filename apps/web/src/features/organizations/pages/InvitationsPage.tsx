import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { InviteMemberModal } from '../components/InviteMemberModal'
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
import { PageHeader } from '@/shared/components/PageHeader'
import { ResourceTable } from '@/shared/components/ResourceTable'
import { usePaginatedList } from '@/shared/hooks/usePaginatedList'

type Invitation = components['schemas']['Invitation']

export function InvitationsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const queryClient = useQueryClient()
  const current = useCurrentMembership(orgSlug)

  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [invitationToRevoke, setInvitationToRevoke] = useState<Invitation | null>(null)

  const listKey = queryKeys.invitations.list(orgSlug ?? '')

  const {
    items: invitations,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePaginatedList<Invitation>({
    queryKey: listKey,
    queryFn: (cursor) =>
      api.get(
        `/api/v1/orgs/${orgSlug}/invitations?status=PENDING${cursor ? `&cursor=${cursor}` : ''}`,
      ),
    enabled: Boolean(orgSlug) && current.isAdmin,
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      api.delete(`/api/v1/orgs/${orgSlug}/invitations/${invitationId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations.lists() })
      setInvitationToRevoke(null)
    },
    onError: (mutationError) => {
      setActionError(getApiErrorMessage(mutationError))
    },
  })

  const openRevokeDialog = (invitation: Invitation) => {
    setActionError(null)
    setInvitationToRevoke(invitation)
  }

  const handleConfirmRevoke = () => {
    if (!invitationToRevoke) {
      return
    }
    setActionError(null)
    revokeMutation.mutate(invitationToRevoke.id)
  }

  const closeRevokeDialog = () => {
    if (revokeMutation.isPending) {
      return
    }
    setInvitationToRevoke(null)
    setActionError(null)
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Invitations"
          description="Invite people to your organization and manage pending invites"
          action={
            current.isAdmin && (
              <button
                className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                onClick={() => setIsInviteOpen(true)}
              >
                Invite member
              </button>
            )
          }
        />

        {current.isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {!current.isLoading && !current.isAdmin && (
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            }
            title="You don't have access"
            description="You need admin access to manage invitations for this organization."
          />
        )}

        {!current.isLoading && current.isAdmin && isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {current.isAdmin && error && (
          <ErrorMessage error={error} title="Failed to load invitations" />
        )}

        {current.isAdmin && !isLoading && !error && invitations.length === 0 && (
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            }
            title="No pending invitations"
            description="There are no pending invitations for this organization."
            action={
              current.isAdmin
                ? { label: 'Invite member', onClick: () => setIsInviteOpen(true) }
                : undefined
            }
          />
        )}

        {current.isAdmin && !isLoading && !error && invitations.length > 0 && (
          <ResourceTable
            columns={['Email', 'Role', 'Expires']}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => void fetchNextPage()}
          >
            {invitations.map((invitation) => (
              <tr key={invitation.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {sanitizeDisplayText(invitation.email)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={invitation.role === 'ADMIN' ? 'warning' : 'default'}>
                    {invitation.role.toLowerCase()}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {current.isAdmin ? (
                    <button
                      className="text-red-600 hover:text-red-900"
                      onClick={() => openRevokeDialog(invitation)}
                    >
                      Revoke
                    </button>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </ResourceTable>
        )}
      </div>

      {orgSlug && (
        <InviteMemberModal
          isOpen={isInviteOpen}
          orgSlug={orgSlug}
          onClose={() => setIsInviteOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(invitationToRevoke)}
        title="Revoke invitation"
        message={
          <>
            Revoke the invitation for{' '}
            <span className="font-medium text-gray-900">
              {sanitizeDisplayText(invitationToRevoke?.email ?? '')}
            </span>
            ? The invite link will stop working immediately.
          </>
        }
        confirmLabel="Revoke"
        variant="danger"
        isPending={revokeMutation.isPending}
        errorMessage={invitationToRevoke ? (actionError ?? undefined) : undefined}
        onConfirm={handleConfirmRevoke}
        onClose={closeRevokeDialog}
      />
    </DashboardLayout>
  )
}
