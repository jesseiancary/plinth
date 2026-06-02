import type { ZodSchema } from 'zod'

/**
 * Type-safe localStorage wrapper with validation support.
 *
 * This utility eliminates the need for eslint-disable comments around
 * localStorage operations by providing proper TypeScript types and
 * error handling.
 *
 * Features:
 * - Type-safe get/set operations
 * - Zod validation for stored data
 * - Automatic JSON serialization
 * - Graceful error handling
 * - Cross-tab synchronization support
 *
 * @example
 * const storage = createStorage({
 *   key: 'user',
 *   schema: userSchema,
 * })
 *
 * storage.set(user)
 * const user = storage.get()
 * storage.remove()
 */

// Safe localStorage wrapper that handles SSR and test environments
// Note: In test environments (JSDOM), localStorage may be typed as 'any'
// These functions provide a safe, typed interface over the raw localStorage API
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      // localStorage is 'any' in JSDOM test environment - this is expected
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    // localStorage is 'any' in JSDOM test environment - this is expected
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    localStorage.setItem(key, value)
  },
  removeItem: (key: string): void => {
    try {
      // localStorage is 'any' in JSDOM test environment - this is expected
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      localStorage.removeItem(key)
    } catch {
      // Ignore errors when removing
    }
  },
}

interface StorageOptions<T> {
  /**
   * The localStorage key
   */
  key: string

  /**
   * Optional Zod schema for validating stored data.
   * If provided, get() will validate against this schema and return null
   * if validation fails (removing the invalid data from storage).
   */
  schema?: ZodSchema<T>
}

interface TypedStorage<T> {
  /**
   * Get value from localStorage.
   * Returns null if:
   * - Key doesn't exist
   * - JSON parse fails
   * - Schema validation fails (if schema provided)
   * - localStorage is unavailable (SSR, private browsing, etc.)
   */
  get: () => T | null

  /**
   * Set value in localStorage.
   * Throws if:
   * - JSON serialization fails
   * - localStorage is full
   * - localStorage is unavailable
   */
  set: (value: T) => void

  /**
   * Remove value from localStorage.
   * Does not throw if key doesn't exist or localStorage is unavailable.
   */
  remove: () => void

  /**
   * Get the storage key (useful for storage event listeners)
   */
  readonly key: string
}

/**
 * Create a type-safe localStorage accessor for a specific key.
 *
 * @example
 * // Simple string storage
 * const tokenStorage = createStorage<string>({ key: 'accessToken' })
 * tokenStorage.set('abc123')
 * const token = tokenStorage.get() // string | null
 *
 * @example
 * // Validated object storage
 * const userStorage = createStorage({
 *   key: 'user',
 *   schema: z.object({ id: z.string(), email: z.string() })
 * })
 * userStorage.set({ id: '1', email: 'test@example.com' })
 * const user = userStorage.get() // User | null (validated)
 */
export function createStorage<T>({ key, schema }: StorageOptions<T>): TypedStorage<T> {
  return {
    key,

    get: (): T | null => {
      try {
        const stored = safeLocalStorage.getItem(key)

        if (!stored) {
          return null
        }

        const parsed: unknown = JSON.parse(stored)

        // If schema provided, validate the data
        if (schema) {
          const result = schema.safeParse(parsed)

          if (!result.success) {
            // Invalid data - remove it from localStorage
            safeLocalStorage.removeItem(key)
            return null
          }

          return result.data
        }

        // No schema - return parsed data as-is
        return parsed as T
      } catch {
        // JSON parse error or localStorage unavailable - remove corrupted data
        safeLocalStorage.removeItem(key)
        return null
      }
    },

    set: (value: T): void => {
      try {
        const serialized = JSON.stringify(value)
        safeLocalStorage.setItem(key, serialized)
      } catch (error) {
        // Re-throw with context (could be QuotaExceededError, etc.)
        throw new Error(`Failed to save to localStorage (key: ${key}): ${String(error)}`)
      }
    },

    remove: (): void => {
      safeLocalStorage.removeItem(key)
    },
  }
}

/**
 * Listen for changes to a specific localStorage key across browser tabs.
 *
 * This is a type-safe wrapper around the storage event that filters to
 * only the specified key and provides proper typing for the event.
 *
 * @example
 * const userStorage = createStorage({ key: 'user', schema: userSchema })
 *
 * const unsubscribe = onStorageChange(userStorage.key, (newValue) => {
 *   if (newValue === null) {
 *     // User was logged out in another tab
 *     setUser(null)
 *   } else {
 *     // Validate and update user
 *     const user = userStorage.get()
 *     setUser(user)
 *   }
 * })
 *
 * // Cleanup
 * unsubscribe()
 */
export function onStorageChange(
  key: string,
  callback: (newValue: string | null, oldValue: string | null) => void,
): () => void {
  const handler = (event: Event): void => {
    // Type guard for StorageEvent
    if (!(event instanceof StorageEvent)) {
      return
    }

    // Only respond to localStorage changes from other tabs
    // localStorage and event properties are 'any' in JSDOM test environment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (event.storageArea !== localStorage) {
      return
    }

    // Only respond to changes for the specified key
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (event.key !== key) {
      return
    }

    // event.newValue and event.oldValue are 'any' in JSDOM test environment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    callback(event.newValue, event.oldValue)
  }

  // window is 'any' in JSDOM test environment - this is expected
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  window.addEventListener('storage', handler)

  return () => {
    // window is 'any' in JSDOM test environment - this is expected
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    window.removeEventListener('storage', handler)
  }
}
