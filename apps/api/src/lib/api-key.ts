import crypto from 'node:crypto'

/**
 * Generate a new API key with the format sk_live_<random>
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32)
  const randomString = randomBytes.toString('base64url')
  return `sk_live_${randomString}`
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}
