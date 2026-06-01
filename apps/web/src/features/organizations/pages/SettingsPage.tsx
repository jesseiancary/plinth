import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { sanitizeDisplayText } from '@/lib/sanitize'
import { Button } from '@/shared/components/Button'
import { DashboardLayout } from '@/shared/components/DashboardLayout'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { Input } from '@/shared/components/Input'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'

type Organization = components['schemas']['Organization']

export function SettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const {
    data: organization,
    isLoading,
    error,
  } = useQuery<Organization>({
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    queryKey: queryKeys.organizations.detail(orgSlug!),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const response: Organization = await api.get(`/api/v1/orgs/${orgSlug}`)
      // Initialize form fields with current values
      setName(response.name)
      setSlug(response.slug)
      return response
    },
    enabled: Boolean(orgSlug),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement update organization mutation
  }

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
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                  setName(e.currentTarget.value)
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
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                  setSlug(e.currentTarget.value)
                }}
                placeholder="acme-inc"
                required
                helperText="Used in URLs and must be unique"
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              />

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>

            <div className="px-6 py-6 border-t border-gray-200 bg-red-50">
              <h3 className="text-base font-medium text-red-900">Danger Zone</h3>
              <p className="mt-2 text-sm text-red-700">
                Once you delete an organization, there is no going back. Please be certain.
              </p>
              <div className="mt-4">
                <Button
                  variant="danger"
                  onClick={() => {
                    // TODO: Implement delete organization
                  }}
                >
                  Delete Organization
                </Button>
              </div>
            </div>
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
                    {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call */}
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
    </DashboardLayout>
  )
}
