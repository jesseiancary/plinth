import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { api } from '../../../lib/api-client'
import { sanitizeDisplayText } from '../../../lib/sanitize'
import { useActiveOrg } from '../context/OrgContext'

type User = components['schemas']['User']
type Organization = components['schemas']['Organization']

interface UserWithMemberships extends User {
  memberships: Array<{
    id: string
    role: string
    organization: Organization
  }>
}

export function OrgSwitcher() {
  const navigate = useNavigate()
  const { activeOrgSlug, setActiveOrgSlug } = useActiveOrg()
  const [isOpen, setIsOpen] = useState(false)

  const { data: user } = useQuery<UserWithMemberships>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/api/v1/auth/me'),
  })

  const currentOrg = user?.memberships.find((m) => m.organization.slug === activeOrgSlug)

  // Handle Escape key to close dropdown
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    document.addEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSelectOrg = async (slug: string) => {
    setActiveOrgSlug(slug)
    setIsOpen(false)
    await navigate(`/orgs/${slug}/members`)
  }

  if (!user) {
    return null
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Organization switcher"
      >
        <span className="font-medium text-gray-900">
          {currentOrg ? sanitizeDisplayText(currentOrg.organization.name) : 'Select Organization'}
        </span>
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div
            className="absolute left-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20"
            role="menu"
            aria-orientation="vertical"
          >
            <div className="py-1">
              {user.memberships.map((membership) => (
                <button
                  key={membership.id}
                  onClick={() => handleSelectOrg(membership.organization.slug)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                    membership.organization.slug === activeOrgSlug ? 'bg-brand-50' : ''
                  }`}
                  role="menuitem"
                  aria-current={membership.organization.slug === activeOrgSlug ? 'true' : undefined}
                >
                  <div className="font-medium">
                    {sanitizeDisplayText(membership.organization.name)}
                  </div>
                  <div className="text-xs text-gray-500">{membership.role}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
