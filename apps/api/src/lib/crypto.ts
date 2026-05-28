import crypto from 'crypto'

/**
 * Generate a SHA-256 hash of a string
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

/**
 * Generate a cryptographically secure random token
 * @param byteLength - Number of random bytes to generate (default: 32)
 * @returns Hex-encoded random string
 */
export function generateSecureToken(byteLength: number = 32): string {
  return crypto.randomBytes(byteLength).toString('hex')
}

/**
 * Generate an invitation token with format: inv_<64 hex chars>
 */
export function generateInvitationToken(): string {
  return `inv_${generateSecureToken(32)}`
}
