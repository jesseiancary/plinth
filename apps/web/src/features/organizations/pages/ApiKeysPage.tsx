import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { sanitizeDisplayText } from '@/lib/sanitize'
import { Badge } from '@/shared/components/Badge'
import { DashboardLayout } from '@/shared/components/DashboardLayout'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'

type ApiKey = components['schemas']['ApiKey']

interface ApiKeysResponse {
  data: ApiKey[]
}

export function ApiKeysPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()

  const {
    data: apiKeysResponse,
    isLoading,
    error,
  } = useQuery<ApiKeysResponse>({
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    queryKey: queryKeys.apiKeys.list(orgSlug!),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    queryFn: () => api.get(`/api/v1/orgs/${orgSlug}/api-keys`),
    enabled: Boolean(orgSlug),
  })

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
          <p className="mt-2 text-gray-600">
            Manage API keys for programmatic access to your organization
          </p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {error && <ErrorMessage error={error} title="Failed to load API keys" />}

        {!isLoading && !error && apiKeysResponse && apiKeysResponse.data.length === 0 && (
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
            action={{
              label: 'Create API Key',
              onClick: () => {
                // TODO: Open create API key modal
              },
            }}
          />
        )}

        {!isLoading && !error && apiKeysResponse && apiKeysResponse.data.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Active API Keys</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Keep your API keys secure and never share them publicly
                </p>
              </div>
              <button
                className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                onClick={() => {
                  // TODO: Open create API key modal
                }}
              >
                Create API Key
              </button>
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
                {apiKeysResponse.data.map((apiKey) => (
                  <tr key={apiKey.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call */}
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
                      <button className="text-red-600 hover:text-red-900">Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
