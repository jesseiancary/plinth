import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { UserMenu } from '@/features/auth/components/UserMenu'
import { OrgSwitcher } from '@/features/organizations/components/OrgSwitcher'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-brand-600">
                Plinth
              </Link>
              <OrgSwitcher />
            </div>
            <div className="flex items-center">
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar + Main Content */}
      <div className="flex">
        {/* Sidebar */}
        {orgSlug && (
          <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
            <nav className="p-4 space-y-1">
              <Link
                to={`/orgs/${orgSlug}/members`}
                className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Members
              </Link>
              <Link
                to={`/orgs/${orgSlug}/settings`}
                className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Settings
              </Link>
              <Link
                to={`/orgs/${orgSlug}/api-keys`}
                className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                API Keys
              </Link>
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
