import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { api } from '../../../lib/api-client'
import { queryKeys } from '../../../lib/query-keys'
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
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const menuItemsRef = useRef<(HTMLButtonElement | null)[]>([])

  const { data: user, isLoading } = useQuery<UserWithMemberships>({
    queryKey: queryKeys.auth.me(),
    queryFn: () => api.get('/api/v1/auth/me'),
  })

  const currentOrg = user?.memberships.find((m) => m.organization.slug === activeOrgSlug)

  // Reset focused index when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Find the index of the currently active org
      const activeIndex = user?.memberships.findIndex((m) => m.organization.slug === activeOrgSlug)
      setFocusedIndex(activeIndex ?? 0)
    }
  }, [isOpen, user?.memberships, activeOrgSlug])

  // Focus the menu item when focusedIndex changes
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && menuItemsRef.current[focusedIndex]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      menuItemsRef.current[focusedIndex]?.focus()
    }
  }, [focusedIndex, isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const itemCount = user?.memberships.length ?? 0

      if (e.key === 'Escape') {
        setIsOpen(false)
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex((prev) => (prev + 1) % itemCount)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((prev) => (prev - 1 + itemCount) % itemCount)
        return
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (focusedIndex >= 0 && user?.memberships[focusedIndex]) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          handleSelectOrg(user.memberships[focusedIndex].organization.slug)
        }
        return
      }

      if (e.key === 'Home') {
        e.preventDefault()
        setFocusedIndex(0)
        return
      }

      if (e.key === 'End') {
        e.preventDefault()
        setFocusedIndex(itemCount - 1)
        return
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    document.addEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, focusedIndex, user?.memberships])

  const handleSelectOrg = async (slug: string) => {
    setActiveOrgSlug(slug)
    setIsOpen(false)
    await navigate(`/orgs/${slug}/members`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
      </div>
    )
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
              {user.memberships.map((membership, index) => (
                <button
                  key={membership.id}
                  ref={(el) => {
                    menuItemsRef.current[index] = el
                  }}
                  onClick={() => handleSelectOrg(membership.organization.slug)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none focus:bg-brand-100 ${
                    membership.organization.slug === activeOrgSlug ? 'bg-brand-50' : ''
                  }`}
                  role="menuitem"
                  tabIndex={-1}
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
