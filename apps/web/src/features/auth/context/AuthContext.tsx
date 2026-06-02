import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { z } from 'zod'

import type { components } from '@plinth/types'

import { createStorage, onStorageChange } from '../../../lib/storage'

type User = components['schemas']['User']

// Zod schema for validating user data from localStorage
const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string(),
})

// Type-safe localStorage accessors
const userStorage = createStorage<User>({
  key: 'user',
  schema: userSchema,
})

const tokenStorage = createStorage<string>({
  key: 'accessToken',
})

interface AuthContextValue {
  user: User | null
  accessToken: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => userStorage.get())
  const [accessToken, setAccessToken] = useState<string | null>(() => tokenStorage.get())

  const login = (token: string, user: User) => {
    // Update state first for immediate UI response
    setAccessToken(token)
    setUser(user)

    try {
      // Persist to localStorage (with error handling for edge cases)
      tokenStorage.set(token)
      userStorage.set(user)
    } catch (error) {
      // If localStorage fails, log but don't break the login flow
      // The user is still authenticated in memory for this session
      console.error('Failed to persist auth state to localStorage:', error)
      // Note: Not throwing here because the user is already logged in via state
      // They just won't persist across page reloads
    }
  }

  const logout = () => {
    // Clear localStorage first (atomically)
    // Note: tokenStorage.remove() doesn't throw, so we don't need try/catch here
    tokenStorage.remove()
    userStorage.remove()

    // Update state after localStorage clear
    setAccessToken(null)
    setUser(null)
  }

  // Synchronize auth state across browser tabs
  useEffect(() => {
    // Listen for token changes
    const unsubscribeToken = onStorageChange(tokenStorage.key, () => {
      // newValue from onStorageChange is the raw JSON string
      // Use tokenStorage.get() to parse it properly
      const token = tokenStorage.get()
      setAccessToken(token)

      // If token is cleared, logout completely
      if (!token) {
        setUser(null)
        userStorage.remove()
      }
    })

    // Listen for user changes
    const unsubscribeUser = onStorageChange(userStorage.key, () => {
      // Use userStorage.get() to parse and validate user data
      const user = userStorage.get()
      setUser(user)

      // If user is cleared, logout completely
      if (!user) {
        setAccessToken(null)
        tokenStorage.remove()
      }
    })

    return () => {
      unsubscribeToken()
      unsubscribeUser()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        isAuthenticated: !!accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
