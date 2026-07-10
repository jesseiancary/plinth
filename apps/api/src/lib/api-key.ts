import crypto from 'node:crypto'

/**
 * Generate a new API key with the format sk_live_<UUIDv7>
 * Uses UUIDv7 for time-ordering and better database indexing
 */
export function generateApiKey(): string {
  const uuid = crypto.randomUUIDv7()
  const compactUuid = uuid.replace(/-/g, '')
  return `sk_live_${compactUuid}`
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}
