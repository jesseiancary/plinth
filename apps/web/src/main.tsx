import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from './features/auth/context/AuthContext'
import { OrgProvider } from './features/organizations/context/OrgContext'
import { queryClient } from './lib/query-client'
import { router } from './lib/router'
import { ErrorBoundary } from './shared/components/ErrorBoundary'

import './index.css'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OrgProvider>
            <RouterProvider router={router} />
          </OrgProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
