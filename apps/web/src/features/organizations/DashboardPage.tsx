import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { api } from '../../lib/api-client'
import { DashboardLayout } from '../../shared/components/DashboardLayout'
import { LoadingSpinner } from '../../shared/components/LoadingSpinner'

import { useActiveOrg } from './context/OrgContext'

type User = components['schemas']['User']
type Organization = components['schemas']['Organization']

interface UserWithMemberships extends User {
  memberships: Array<{
    id: string
    role: string
    organization: Organization
  }>
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { activeOrgSlug, setActiveOrgSlug } = useActiveOrg()

  const { data: user, isLoading } = useQuery<UserWithMemberships>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/api/v1/auth/me'),
  })

  // Auto-select first org if none selected
  useEffect(() => {
    if (user && !activeOrgSlug && user.memberships.length > 0) {
      const firstOrg = user.memberships[0].organization
      setActiveOrgSlug(firstOrg.slug)
      void navigate(`/orgs/${firstOrg.slug}/members`, { replace: true })
    }
  }, [user, activeOrgSlug, navigate, setActiveOrgSlug])

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Plinth</h1>
        <p className="text-gray-600">Select an organization from the dropdown to get started.</p>
      </div>
    </DashboardLayout>
  )
}
