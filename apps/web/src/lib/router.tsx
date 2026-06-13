import { createBrowserRouter } from 'react-router-dom'

import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute'
import { LoginPage } from '@/features/auth/LoginPage'
import { SecurityPage } from '@/features/auth/pages/SecurityPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { DashboardPage } from '@/features/organizations/DashboardPage'
import { ApiKeysPage } from '@/features/organizations/pages/ApiKeysPage'
import { MembersPage } from '@/features/organizations/pages/MembersPage'
import { SettingsPage } from '@/features/organizations/pages/SettingsPage'
import { DashboardLayout } from '@/shared/components/DashboardLayout'

// Placeholder pages - will be created in later phases
function PlaceholderPage({ title }: { title: string }) {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600">Coming soon...</p>
        </div>
      </div>
    </DashboardLayout>
  )
}

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/invite/:token',
    element: <PlaceholderPage title="Accept Invitation" />,
  },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <DashboardPage />,
      },
      {
        path: '/orgs/:orgSlug/members',
        element: <MembersPage />,
      },
      {
        path: '/orgs/:orgSlug/settings',
        element: <SettingsPage />,
      },
      {
        path: '/orgs/:orgSlug/api-keys',
        element: <ApiKeysPage />,
      },
      {
        path: '/security',
        element: <SecurityPage />,
      },
    ],
  },

  // 404 catch-all
  {
    path: '*',
    element: <PlaceholderPage title="404 - Page Not Found" />,
  },
])
