import { createElement } from 'react'

import { AccountExistsEmail } from '../emails/AccountExistsEmail.js'
import { VerifyEmail } from '../emails/VerifyEmail.js'

import { sendEmail } from './email.js'
import { env } from './env.js'

/**
 * Transactional email senders for the authentication flows. Centralizes the link-building
 * (WEB_URL + path + token) so routes stay focused on their own logic and every link is
 * constructed consistently.
 */

const buildUrl = (path: string, params?: Record<string, string>): string => {
  // Append `path` to WEB_URL's full path rather than using `new URL(path, base)`: a
  // root-absolute second argument would discard any path prefix on WEB_URL (e.g. a
  // '/app' subpath mount), producing broken links. `path` always begins with '/'.
  const base = env.WEB_URL.replace(/\/+$/, '')
  const url = new URL(`${base}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

/**
 * Send the email-verification message containing a single-use link. The plaintext token
 * travels only in this link; only its hash is persisted.
 */
export const sendVerificationEmail = async (params: {
  to: string
  name: string
  token: string
}): Promise<void> => {
  const verifyUrl = buildUrl('/verify-email', { token: params.token })
  await sendEmail({
    to: params.to,
    subject: 'Verify your email',
    react: createElement(VerifyEmail, { name: params.name, verifyUrl }),
  })
}

/**
 * Notify an existing account holder that someone attempted to register with their email.
 * Sent on duplicate registration so the generic API response stays enumeration-safe.
 */
export const sendAccountExistsEmail = async (params: {
  to: string
  name: string
}): Promise<void> => {
  const loginUrl = buildUrl('/login')
  const resetUrl = buildUrl('/forgot-password')
  await sendEmail({
    to: params.to,
    subject: 'You already have a Plinth account',
    react: createElement(AccountExistsEmail, { name: params.name, loginUrl, resetUrl }),
  })
}
