import { createElement } from 'react'

import { InvitationEmail } from '../emails/InvitationEmail.js'

import { sendEmail } from './email.js'
import { buildUrl } from './email-links.js'

/**
 * Human-readable role labels for email copy. The stored role is an uppercase enum; the email
 * reads better in lower case ("invited you ... as a member").
 */
const ROLE_LABELS: Record<string, string> = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
}

/**
 * Send the organization invitation message containing a single-use accept link. The plaintext
 * token travels only in this link (`/invite/:token`); only its hash is persisted. Link-building
 * lives in {@link buildUrl} so every transactional link is constructed consistently.
 */
export const sendInvitationEmail = async (params: {
  to: string
  inviterName: string
  organizationName: string
  role: string
  token: string
}): Promise<void> => {
  const acceptUrl = buildUrl(`/invite/${encodeURIComponent(params.token)}`)
  await sendEmail({
    to: params.to,
    subject: `You're invited to join ${params.organizationName} on Plinth`,
    react: createElement(InvitationEmail, {
      inviterName: params.inviterName,
      organizationName: params.organizationName,
      role: ROLE_LABELS[params.role] ?? params.role.toLowerCase(),
      acceptUrl,
    }),
  })
}
