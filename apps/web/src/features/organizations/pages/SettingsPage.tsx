import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import type { components } from '@plinth/types'

import { TransferOwnershipModal } from '../components/TransferOwnershipModal'
import { useActiveOrg } from '../context/OrgContext'
import { useCurrentMembership } from '../hooks/useCurrentMembership'

import { api } from '@/lib/api-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { sanitizeDisplayText } from '@/lib/sanitize'
import { Button } from '@/shared/components/Button'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { DashboardLayout } from '@/shared/components/DashboardLayout'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { Input } from '@/shared/components/Input'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'

type Organization = components['schemas']['Organization']

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only')

export function SettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const current = useCurrentMembership(orgSlug)
  const { setActiveOrgSlug, clearActiveOrg } = useActiveOrg()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renameSaved, setRenameSaved] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)

  const {
    data: organization,
    isLoading,
    error,
  } = useQuery<Organization>({
    queryKey: queryKeys.organizations.detail(orgSlug ?? ''),
    queryFn: (): Promise<Organization> => api.get(`/api/v1/orgs/${orgSlug}`),
    enabled: Boolean(orgSlug),
  })

  // Seed the form from the loaded org only when its identity changes (first load
  // or org switch), never on background refetches — otherwise an invalidation
  // while editing would discard the user's unsaved changes.
  const initializedOrgId = useRef<string | null>(null)
  useEffect(() => {
    if (organization && initializedOrgId.current !== organization.id) {
      initializedOrgId.current = organization.id
      setName(organization.name)
      setSlug(organization.slug)
    }
  }, [organization])

  const renameMutation = useMutation({
    mutationFn: (payload: { name?: string; slug?: string }): Promise<Organization> =>
      api.patch(`/api/v1/orgs/${orgSlug}`, payload),
    onSuccess: async (updated) => {
      const slugChanged = updated.slug !== orgSlug
      if (slugChanged) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() }),
        ])
        setActiveOrgSlug(updated.slug)
        void navigate(`/orgs/${updated.slug}/settings`, { replace: true })
        return
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(orgSlug ?? '') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() }),
      ])
      setRenameSaved(true)
    },
    onError: (mutationError) => {
      setRenameError(getApiErrorMessage(mutationError))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/orgs/${orgSlug}`),
    onSuccess: async () => {
      clearActiveOrg()
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })
      setIsDeleteOpen(false)
      void navigate('/')
    },
    onError: (mutationError) => {
      setDeleteError(getApiErrorMessage(mutationError))
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!organization) {
      return
    }
    setRenameError(null)
    setRenameSaved(false)

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()

    if (trimmedSlug !== organization.slug) {
      const parsed = slugSchema.safeParse(trimmedSlug)
      if (!parsed.success) {
        setRenameError(parsed.error.issues[0]?.message ?? 'Enter a valid slug')
        return
      }
    }

    const payload: { name?: string; slug?: string } = {}
    if (trimmedName !== organization.name) {
      payload.name = trimmedName
    }
    if (trimmedSlug !== organization.slug) {
      payload.slug = trimmedSlug
    }

    if (payload.name === undefined && payload.slug === undefined) {
      return
    }

    renameMutation.mutate(payload)
  }

  const handleCancel = () => {
    if (!organization) {
      return
    }
    setName(organization.name)
    setSlug(organization.slug)
    setRenameError(null)
    setRenameSaved(false)
  }

  const openDeleteDialog = () => {
    setDeleteError(null)
    setIsDeleteOpen(true)
  }

  const closeDeleteDialog = () => {
    if (deleteMutation.isPending) {
      return
    }
    setIsDeleteOpen(false)
    setDeleteError(null)
  }

  const hasChanges = Boolean(
    organization && (name.trim() !== organization.name || slug.trim() !== organization.slug),
  )

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Organization Settings</h1>
          <p className="mt-2 text-gray-600">Manage your organization's profile and preferences</p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {error && <ErrorMessage error={error} title="Failed to load organization settings" />}

        {!isLoading && !error && organization && (
          <div className="bg-white shadow rounded-lg">
            {current.isAdmin && (
              <>
                <div className="px-6 py-6 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">General Information</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Update your organization's basic information
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
                  <Input
                    label="Organization Name"
                    id="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.currentTarget.value)
                      setRenameSaved(false)
                    }}
                    placeholder="Acme Inc."
                    required
                    helperText="The display name for your organization"
                  />

                  <Input
                    label="Organization Slug"
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.currentTarget.value)
                      setRenameSaved(false)
                    }}
                    placeholder="acme-inc"
                    required
                    helperText="Used in URLs and must be unique"
                    pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  />

                  {renameError && (
                    <div className="rounded-md bg-red-50 p-3" role="alert">
                      <p className="text-sm text-danger">{renameError}</p>
                    </div>
                  )}

                  {renameSaved && (
                    <div className="rounded-md bg-green-50 p-3" role="status">
                      <p className="text-sm text-green-800">Organization updated.</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-end space-x-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleCancel}
                        disabled={renameMutation.isPending || !hasChanges}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={renameMutation.isPending || !hasChanges}
                      >
                        {renameMutation.isPending ? 'Saving…' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                </form>
              </>
            )}

            {current.isOwner && (
              <div className="px-6 py-6 border-t border-gray-200 bg-red-50">
                <h3 className="text-base font-medium text-red-900">Danger Zone</h3>
                <p className="mt-2 text-sm text-red-700">
                  These actions are irreversible. Transfer ownership before leaving, or permanently
                  delete the organization and all of its data.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setIsTransferOpen(true)}>
                    Transfer Ownership
                  </Button>
                  <Button variant="danger" onClick={openDeleteDialog}>
                    Delete Organization
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-6 py-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Organization Details</h2>
          </div>
          <div className="px-6 py-6">
            {organization && (
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Organization ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {sanitizeDisplayText(organization.id)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(organization.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(organization.updatedAt).toLocaleString()}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </div>

      {organization && current.isOwner && (
        <TransferOwnershipModal
          isOpen={isTransferOpen}
          orgSlug={organization.slug}
          currentUserId={current.userId}
          onClose={() => setIsTransferOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete organization"
        message={
          <>
            This permanently deletes{' '}
            <span className="font-medium text-gray-900">
              {sanitizeDisplayText(organization?.name ?? '')}
            </span>{' '}
            and all of its members, invitations, and API keys. This cannot be undone.
          </>
        }
        confirmLabel="Delete Organization"
        variant="danger"
        confirmationPhrase={organization?.slug}
        isPending={deleteMutation.isPending}
        errorMessage={isDeleteOpen ? (deleteError ?? undefined) : undefined}
        onConfirm={() => deleteMutation.mutate()}
        onClose={closeDeleteDialog}
      />
    </DashboardLayout>
  )
}
