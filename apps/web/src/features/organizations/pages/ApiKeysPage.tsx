import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { CreateApiKeyModal } from '../components/CreateApiKeyModal'
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

type ApiKey = components['schemas']['ApiKey']

interface ApiKeysResponse {
  data: ApiKey[]
  nextCursor: string | null
}

export function ApiKeysPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const queryClient = useQueryClient()
  const current = useCurrentMembership(orgSlug)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null)

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: queryKeys.apiKeys.list(orgSlug ?? ''), // stable key; cursor is the pageParam
      queryFn: ({ pageParam }: { pageParam: string | undefined }): Promise<ApiKeysResponse> =>
        api.get(
          `/api/v1/orgs/${orgSlug}/api-keys?active=true${pageParam ? `&cursor=${pageParam}` : ''}`,
        ),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: Boolean(orgSlug) && current.isAdmin,
    })

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.delete(`/api/v1/orgs/${orgSlug}/api-keys/${keyId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.lists() })
      setKeyToRevoke(null)
    },
    onError: (mutationError) => {
      setActionError(getApiErrorMessage(mutationError))
    },
  })

  const openRevokeDialog = (apiKey: ApiKey) => {
    setActionError(null)
    setKeyToRevoke(apiKey)
  }

  const handleConfirmRevoke = () => {
    if (!keyToRevoke) {
      return
    }
    setActionError(null)
    revokeMutation.mutate(keyToRevoke.id)
  }

  const closeRevokeDialog = () => {
    if (revokeMutation.isPending) {
      return
    }
    setKeyToRevoke(null)
    setActionError(null)
  }

  const apiKeys = data?.pages.flatMap((page) => page.data) ?? []

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
            <p className="mt-2 text-gray-600">
              Manage API keys for programmatic access to your organization
            </p>
          </div>
          {current.isAdmin && (
            <button
              className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              onClick={() => setIsCreateOpen(true)}
            >
              Create API key
            </button>
          )}
        </div>

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
            description="You need admin access to manage API keys for this organization."
          />
        )}

        {!current.isLoading && current.isAdmin && isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {current.isAdmin && error && <ErrorMessage error={error} title="Failed to load API keys" />}

        {current.isAdmin && !isLoading && !error && apiKeys.length === 0 && (
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
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            }
            title="No API keys"
            description="You haven't created any API keys yet. Create your first API key to enable programmatic access to the API."
            action={
              current.isAdmin
                ? { label: 'Create API key', onClick: () => setIsCreateOpen(true) }
                : undefined
            }
          />
        )}

        {current.isAdmin && !isLoading && !error && apiKeys.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Active API Keys</h2>
              <p className="mt-1 text-sm text-gray-600">
                Keep your API keys secure and never share them publicly
              </p>
            </div>

            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Scopes
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Last Used
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Created
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {apiKeys.map((apiKey) => (
                  <tr key={apiKey.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {sanitizeDisplayText(apiKey.name)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {apiKey.scopes.map((scope) => (
                          <Badge key={scope} variant="info">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {apiKey.lastUsedAt
                        ? new Date(apiKey.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(apiKey.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {current.isAdmin ? (
                        <button
                          className="text-red-600 hover:text-red-900"
                          onClick={() => openRevokeDialog(apiKey)}
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
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

      {orgSlug && (
        <CreateApiKeyModal
          isOpen={isCreateOpen}
          orgSlug={orgSlug}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(keyToRevoke)}
        title="Revoke API key"
        message={
          <>
            Revoke the API key{' '}
            <span className="font-medium text-gray-900">
              {sanitizeDisplayText(keyToRevoke?.name ?? '')}
            </span>
            ? Any integration using it will stop working immediately.
          </>
        }
        confirmLabel="Revoke"
        variant="danger"
        isPending={revokeMutation.isPending}
        errorMessage={keyToRevoke ? (actionError ?? undefined) : undefined}
        onConfirm={handleConfirmRevoke}
        onClose={closeRevokeDialog}
      />
    </DashboardLayout>
  )
}
