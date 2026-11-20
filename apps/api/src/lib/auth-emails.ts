import { createElement } from 'react'

import { AccountExistsEmail } from '../emails/AccountExistsEmail.js'
import { ResetPasswordEmail } from '../emails/ResetPasswordEmail.js'
import { VerifyEmail } from '../emails/VerifyEmail.js'

import { sendEmail } from './email.js'
import { buildUrl } from './email-links.js'

/**
 * Transactional email senders for the authentication flows. Link-building (WEB_URL + path +
 * token) lives in {@link buildUrl} so routes stay focused on their own logic and every link is
 * constructed consistently.
 */

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

/**
 * Send the password-reset message containing a single-use link. The plaintext token travels
 * only in this link; only its hash is persisted. Sent exclusively when the requested email
 * belongs to a real account — the forgot-password endpoint stays enumeration-safe by returning
 * a generic response whether or not this email is dispatched.
 */
export const sendPasswordResetEmail = async (params: {
  to: string
  name: string
  token: string
}): Promise<void> => {
  const resetUrl = buildUrl('/reset-password', { token: params.token })
  await sendEmail({
    to: params.to,
    subject: 'Reset your password',
    react: createElement(ResetPasswordEmail, { name: params.name, resetUrl }),
  })
}
