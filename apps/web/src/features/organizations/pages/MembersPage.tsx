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

type Membership = components['schemas']['Membership']

interface MembersResponse {
  data: Membership[]
  nextCursor: string | null
}

export function MembersPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()

  const {
    data: membersResponse,
    isLoading,
    error,
  } = useQuery<MembersResponse>({
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    queryKey: queryKeys.members.list(orgSlug!),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    queryFn: () => api.get(`/api/v1/orgs/${orgSlug}/members`),
    enabled: Boolean(orgSlug),
  })

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Members</h1>
          <p className="mt-2 text-gray-600">Manage your organization's team members</p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {error && <ErrorMessage error={error} title="Failed to load members" />}

        {!isLoading && !error && membersResponse && membersResponse.data.length === 0 && (
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
            description="This organization doesn't have any members yet. Invite your first team member to get started."
            action={{
              label: 'Invite Member',
              onClick: () => {
                // TODO: Open invite modal
              },
            }}
          />
        )}

        {!isLoading && !error && membersResponse && membersResponse.data.length > 0 && (
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
                {membersResponse.data.map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call */}
                          {sanitizeDisplayText(member.user.name)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call */}
                          {sanitizeDisplayText(member.user.email)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {member.role !== 'OWNER' && (
                        <button className="text-brand-600 hover:text-brand-900">Manage</button>
                      )}
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
