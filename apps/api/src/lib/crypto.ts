import crypto from 'crypto'

/**
 * Generate a SHA-256 hash of a string
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

/**
 * Generate a single-use secret token with a typed prefix and 256 bits of CSPRNG entropy
 * (`crypto.randomBytes(32)`, hex-encoded). Only the SHA-256 hash of the token is ever persisted
 * (the stored column is random regardless of plaintext, so there is no DB-ordering benefit to a
 * time-based UUID here); the plaintext travels only in the emailed link.
 */
function generateSecretToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString('hex')}`
}

/**
 * Generate an invitation token with format: inv_<64 hex chars>.
 */
export function generateInvitationToken(): string {
  return generateSecretToken('inv')
}

/**
 * Generate an email verification token with format: ver_<64 hex chars>.
 */
export function generateVerificationToken(): string {
  return generateSecretToken('ver')
}

/**
 * Generate a password-reset token with format: rst_<64 hex chars>.
 */
export function generateResetToken(): string {
  return generateSecretToken('rst')
}
