import crypto from 'crypto'

/**
 * Generate a SHA-256 hash of a string
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

/**
 * Generate an invitation token with format: inv_<UUIDv7>
 * Uses UUIDv7 for time-ordering and better database indexing
 */
export function generateInvitationToken(): string {
  const uuid = crypto.randomUUIDv7()
  const compactUuid = uuid.replace(/-/g, '')
  return `inv_${compactUuid}`
}
