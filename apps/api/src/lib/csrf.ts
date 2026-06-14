import crypto from 'node:crypto'

/**
 * Generate a cryptographically secure CSRF token
 * @returns Base64url-encoded random token (32 bytes = 43 characters after encoding)
 */
export const generateCsrfToken = (): string => {
  const buffer = crypto.randomBytes(32)
  return buffer.toString('base64url')
}

/**
 * Constant-time comparison to prevent timing attacks
 * Compares two strings of equal length without early termination
 * @param a First string to compare
 * @param b Second string to compare
 * @returns True if strings match, false otherwise
 */
export const constantTimeCompare = (a: string, b: string): boolean => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false
  }

  // If lengths differ, still compare to prevent timing leak
  // but ensure result is false
  const aLength = Buffer.byteLength(a)
  const bLength = Buffer.byteLength(b)

  // Create buffers - use max length to avoid timing leak on length check
  const maxLength = Math.max(aLength, bLength)
  const bufferA = Buffer.alloc(maxLength)
  const bufferB = Buffer.alloc(maxLength)

  bufferA.write(a)
  bufferB.write(b)

  // Use crypto.timingSafeEqual for constant-time comparison
  // This prevents timing attacks by ensuring comparison takes
  // the same time regardless of where strings differ
  const buffersMatch = crypto.timingSafeEqual(bufferA, bufferB)

  // If lengths differ, return false even if padded buffers match
  return aLength === bLength && buffersMatch
}

/**
 * Validate CSRF token from cookie against header value
 * Uses constant-time comparison to prevent timing attacks
 * @param cookieToken Token from csrf-token cookie
 * @param headerToken Token from X-CSRF-Token header
 * @returns True if tokens match and are valid, false otherwise
 */
export const validateCsrfToken = (
  cookieToken: string | undefined,
  headerToken: string | undefined,
): boolean => {
  if (!cookieToken || !headerToken) {
    return false
  }

  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') {
    return false
  }

  if (cookieToken.length < 32 || headerToken.length < 32) {
    return false
  }

  return constantTimeCompare(cookieToken, headerToken)
}
