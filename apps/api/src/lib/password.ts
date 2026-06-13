import bcrypt from 'bcrypt'

import { env } from './env.js'

const SALT_ROUNDS = parseInt(env.BCRYPT_WORK_FACTOR || '10', 10)

/**
 * Minimum response time for authentication operations to prevent timing attacks
 * Set to 200ms to normalize timing across different error paths
 */
const MIN_AUTH_RESPONSE_TIME_MS = 200

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Normalize authentication response timing to prevent timing attacks
 * Ensures all authentication failures take consistent time regardless of error type
 *
 * @param startTime - Timestamp when the authentication operation started (from Date.now())
 * @returns Promise that resolves after ensuring minimum response time has elapsed
 *
 * @example
 * ```typescript
 * const startTime = Date.now()
 * const isValid = await verifyPassword(input, hash)
 * if (!isValid) {
 *   await normalizeAuthTiming(startTime)
 *   throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
 * }
 * ```
 */
export async function normalizeAuthTiming(startTime: number): Promise<void> {
  const elapsedTime = Date.now() - startTime
  const remainingTime = MIN_AUTH_RESPONSE_TIME_MS - elapsedTime

  if (remainingTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingTime))
  }
}
