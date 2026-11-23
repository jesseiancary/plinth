import type { ReactNode } from 'react'

/**
 * Centered card shell shared by the public, unauthenticated pages — verify
 * email, forgot / reset password, and accept-invite. Mirrors the layout of
 * `LoginPage` / `RegisterPage` so every pre-session screen reads the same.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          {subtitle && <p className="text-gray-600">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-lg shadow-md p-8">{children}</div>
      </div>
    </div>
  )
}
