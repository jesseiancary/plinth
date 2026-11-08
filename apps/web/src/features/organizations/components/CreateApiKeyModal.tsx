import type { FormEvent } from 'react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { api } from '@/lib/api-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Modal } from '@/shared/components/Modal'

// The 9 scopes accepted by the backend (apps/api/src/lib/validation/api-keys.ts),
// paired with a human-readable label. The checkbox value is the raw scope string.
const API_KEY_SCOPES = [
  { value: 'org:read', label: 'Read organization' },
  { value: 'org:write', label: 'Write organization' },
  { value: 'org:delete', label: 'Delete organization' },
  { value: 'members:read', label: 'Read members' },
  { value: 'members:write', label: 'Manage members' },
  { value: 'invitations:read', label: 'Read invitations' },
  { value: 'invitations:write', label: 'Manage invitations' },
  { value: 'api-keys:read', label: 'Read API keys' },
  { value: 'api-keys:write', label: 'Manage API keys' },
] as const

type ScopeValue = (typeof API_KEY_SCOPES)[number]['value']

interface CreateApiKeyResponse {
  id: string
  name: string
  key: string
  scopes: string[]
  createdAt: string
}

interface CreateApiKeyModalProps {
  isOpen: boolean
  orgSlug: string
  onClose: () => void
}

const nameSchema = z
  .string()
  .min(1, 'API key name is required')
  .max(255, 'API key name must not exceed 255 characters')

export function CreateApiKeyModal({ isOpen, orgSlug, onClose }: CreateApiKeyModalProps) {
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ScopeValue[]>(['org:read'])
  const [nameError, setNameError] = useState<string | null>(null)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const mutation = useMutation({
    mutationFn: (payload: { name: string; scopes: ScopeValue[] }): Promise<CreateApiKeyResponse> =>
      api.post(`/api/v1/orgs/${orgSlug}/api-keys`, payload),
    onSuccess: (result) => {
      setCreatedKey(result.key)
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.lists() })
    },
  })

  const reset = () => {
    setName('')
    setScopes(['org:read'])
    setNameError(null)
    setScopeError(null)
    setCreatedKey(null)
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

  const toggleScope = (scope: ScopeValue) => {
    setScopes((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope],
    )
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setNameError(null)
    setScopeError(null)
    const parsed = nameSchema.safeParse(name.trim())
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? 'API key name is required')
      return
    }
    if (scopes.length === 0) {
      setScopeError('Select at least one scope')
      return
    }
    mutation.mutate({ name: parsed.data, scopes })
  }

  const handleCopy = async () => {
    if (!createdKey) {
      return
    }
    try {
      await navigator.clipboard.writeText(createdKey)
      setCopied(true)
      setCopyFailed(false)
    } catch {
      // Clipboard access can fail (insecure context, denied permission). The
      // key is already visible and selectable, so fall back to manual copy.
      setCopyFailed(true)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create API key">
      {createdKey ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Copy your API key now and store it somewhere safe — it is shown only once and cannot be
            retrieved later.
          </p>
          <Input
            label="API key"
            readOnly
            value={createdKey}
            onFocus={(e) => e.currentTarget.select()}
          />
          {copyFailed && (
            <p className="text-sm text-gray-500" role="alert">
              Couldn't copy automatically — select the key above and copy it manually.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy key'}
            </Button>
            <Button type="button" variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            error={nameError ?? undefined}
            placeholder="e.g. CI deploy key"
            autoFocus
          />

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-1">Scopes</legend>
            <div className="space-y-2">
              {API_KEY_SCOPES.map((scope) => (
                <label key={scope.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    value={scope.value}
                    checked={scopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>
                    {scope.label} <span className="text-gray-400">({scope.value})</span>
                  </span>
                </label>
              ))}
            </div>
            {scopeError && (
              <p className="mt-1 text-sm text-danger" role="alert">
                {scopeError}
              </p>
            )}
          </fieldset>

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
              {mutation.isPending ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
