import type { FormEvent } from 'react'
import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import type { components } from '@plinth/types'

import { api } from '@/lib/api-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Modal } from '@/shared/components/Modal'

type Invitation = components['schemas']['Invitation']

// Ownership is granted via transfer-ownership, never by invitation.
type InviteRole = 'ADMIN' | 'MEMBER'

interface CreateInvitationResponse {
  invitation: Invitation
  token: string
}

interface InviteMemberModalProps {
  isOpen: boolean
  orgSlug: string
  onClose: () => void
}

const emailSchema = z.string().email('Enter a valid email address')

export function InviteMemberModal({ isOpen, orgSlug, onClose }: InviteMemberModalProps) {
  const queryClient = useQueryClient()
  const roleFieldId = useId()

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('MEMBER')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const mutation = useMutation({
    mutationFn: (payload: { email: string; role: InviteRole }): Promise<CreateInvitationResponse> =>
      api.post(`/api/v1/orgs/${orgSlug}/invitations`, payload),
    onSuccess: (result) => {
      setToken(result.token)
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations.lists() })
    },
  })

  const reset = () => {
    setEmail('')
    setRole('MEMBER')
    setValidationError(null)
    setToken(null)
    setCopied(false)
    setCopyFailed(false)
    mutation.reset()
  }

  const handleClose = () => {
    if (mutation.isPending) {
      return
    }
    reset()
    onClose()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = emailSchema.safeParse(email.trim())
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Enter a valid email address')
      return
    }
    setValidationError(null)
    mutation.mutate({ email: parsed.data, role })
  }

  const inviteLink = token ? `${window.location.origin}/invite/${encodeURIComponent(token)}` : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setCopyFailed(false)
    } catch {
      // Clipboard access can fail (insecure context, denied permission). The
      // link is already visible and selectable, so fall back to manual copy.
      setCopyFailed(true)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite member">
      {token ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Invitation created. Share this link with the invitee so they can join — it is shown only
            once and cannot be retrieved later.
          </p>
          <div className="flex items-center gap-2">
            <Input
              label="Invitation link"
              readOnly
              value={inviteLink}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
          {copyFailed && (
            <p className="text-sm text-gray-500" role="alert">
              Couldn't copy automatically — select the link above and copy it manually.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
            <Button type="button" variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            error={validationError ?? undefined}
            placeholder="person@example.com"
            autoFocus
          />

          <div>
            <label htmlFor={roleFieldId} className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id={roleFieldId}
              value={role}
              onChange={(e) => setRole(e.currentTarget.value as InviteRole)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-brand-500 focus:ring-brand-500"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

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
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
