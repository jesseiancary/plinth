import type { FormEvent } from 'react'
import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { api } from '@/lib/api-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { sanitizeDisplayText } from '@/lib/sanitize'
import { Button } from '@/shared/components/Button'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { Modal } from '@/shared/components/Modal'

type Membership = components['schemas']['Membership']

interface MembersResponse {
  data: Membership[]
  nextCursor: string | null
}

interface TransferOwnershipModalProps {
  isOpen: boolean
  orgSlug: string
  currentUserId: string | null
  onClose: () => void
}

/**
 * Owner-only modal to transfer organization ownership to another member. The
 * acting owner is demoted to ADMIN on success, so the caller should invalidate
 * `auth.me` to re-hide the danger zone.
 */
export function TransferOwnershipModal({
  isOpen,
  orgSlug,
  currentUserId,
  onClose,
}: TransferOwnershipModalProps) {
  const queryClient = useQueryClient()
  const selectFieldId = useId()
  const [newOwnerId, setNewOwnerId] = useState('')

  const {
    data: members,
    isLoading,
    error,
  } = useQuery<MembersResponse>({
    queryKey: queryKeys.members.transferCandidates(orgSlug),
    queryFn: () => api.get(`/api/v1/orgs/${orgSlug}/members`),
    enabled: isOpen,
  })

  const mutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/api/v1/orgs/${orgSlug}/transfer-ownership`, { newOwnerId: userId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.members.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() }),
      ])
      // Success always closes — bypass the in-flight guard used by the user path.
      close()
    },
  })

  // The current owner cannot transfer to themselves.
  const candidates = (members?.data ?? []).filter((member) => member.userId !== currentUserId)

  const close = () => {
    setNewOwnerId('')
    mutation.reset()
    onClose()
  }

  const handleClose = () => {
    if (mutation.isPending) {
      return
    }
    close()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!newOwnerId) {
      return
    }
    mutation.mutate(newOwnerId)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Transfer ownership">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600">
          Transfer ownership of this organization to another member. You will become an admin and
          can no longer delete the organization or transfer ownership.
        </p>

        {isLoading && (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="md" />
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-3" role="alert">
            <p className="text-sm text-danger">{getApiErrorMessage(error)}</p>
          </div>
        )}

        {!isLoading && !error && candidates.length === 0 && (
          <p className="text-sm text-gray-500">
            There are no other members to transfer ownership to. Invite a member first.
          </p>
        )}

        {!isLoading && !error && candidates.length > 0 && (
          <div>
            <label htmlFor={selectFieldId} className="block text-sm font-medium text-gray-700 mb-1">
              New owner
            </label>
            <select
              id={selectFieldId}
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.currentTarget.value)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-brand-500 focus:ring-brand-500"
            >
              <option value="">Select a member…</option>
              {candidates.map((member) => (
                <option key={member.id} value={member.userId}>
                  {sanitizeDisplayText(member.user.name)} ({sanitizeDisplayText(member.user.email)})
                </option>
              ))}
            </select>
          </div>
        )}

        {mutation.isError && (
          <div className="rounded-md bg-red-50 p-3" role="alert">
            <p className="text-sm text-danger">{getApiErrorMessage(mutation.error)}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={mutation.isPending || !newOwnerId || candidates.length === 0}
          >
            {mutation.isPending ? 'Transferring…' : 'Transfer ownership'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
