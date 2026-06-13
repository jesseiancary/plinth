import { ChangePasswordForm } from '../components/ChangePasswordForm'

import { DashboardLayout } from '@/shared/components/DashboardLayout'

export function SecurityPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Security Settings</h1>
          <p className="mt-2 text-gray-600">Manage your password and security preferences</p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Change Password</h2>
            <p className="mt-1 text-sm text-gray-600">
              Update your password. This will log you out of all devices.
            </p>
          </div>

          <div className="px-6 py-6">
            <ChangePasswordForm />
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Security Information</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Changing your password will invalidate all active sessions on all devices</li>
                  <li>You'll need to log in again with your new password</li>
                  <li>
                    Strong passwords include uppercase, lowercase, numbers, and special characters
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
