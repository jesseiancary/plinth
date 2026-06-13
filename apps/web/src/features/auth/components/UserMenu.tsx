import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getAvatarInitial, sanitizeDisplayText } from '../../../lib/sanitize'
import { useAuth } from '../context/AuthContext'

export function UserMenu() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const signOutButtonRef = useRef<HTMLButtonElement>(null)

  // Focus the sign out button when dropdown opens
  useEffect(() => {
    if (isOpen && signOutButtonRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      signOutButtonRef.current.focus()
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        return
      }

      // Enter or Space triggers the sign out action
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        void handleLogout()
        return
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    document.addEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleLogout = async () => {
    logout()
    await navigate('/login')
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
        aria-label="User menu"
      >
        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-medium">
          {getAvatarInitial(user.name)}
        </div>
        <span className="text-sm font-medium text-gray-700">{sanitizeDisplayText(user.name)}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div
            className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20"
            role="menu"
            aria-orientation="vertical"
          >
            <div className="py-1">
              <div className="px-4 py-2 text-sm text-gray-700 border-b">
                <div className="font-medium">{sanitizeDisplayText(user.name)}</div>
                <div className="text-xs text-gray-500 truncate">
                  {sanitizeDisplayText(user.email)}
                </div>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false)
                  void navigate('/security')
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-brand-100"
                role="menuitem"
              >
                Security Settings
              </button>
              <button
                ref={signOutButtonRef}
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-brand-100"
                role="menuitem"
                tabIndex={-1}
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
