import { Button, Heading, Text } from '@react-email/components'

import { EmailLayout } from './EmailLayout.js'

type InvitationEmailProps = {
  /** Display name of the person who created the invitation, used in the body copy. */
  inviterName: string
  /** Name of the organization the recipient is being invited to join. */
  organizationName: string
  /** Human-readable role the recipient will hold (e.g. "member", "admin"). */
  role: string
  /** Fully-qualified link (WEB_URL + /invite/:token) the recipient clicks to accept. */
  acceptUrl: string
}

const heading = {
  fontSize: '20px',
  fontWeight: 600,
  color: '#111827',
  margin: '0 0 16px',
}

const paragraph = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#374151',
}

const button = {
  display: 'inline-block',
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  borderRadius: '6px',
  padding: '12px 20px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  margin: '16px 0',
}

const fallback = {
  fontSize: '12px',
  lineHeight: '18px',
  color: '#6b7280',
  wordBreak: 'break-all' as const,
}

/**
 * Invitation message sent when an owner/admin invites someone to an organization. Carries the
 * single-use accept link (`/invite/:token`); only the token's hash is persisted. The copy names
 * the inviter and organization so the recipient can judge whether the invitation is expected.
 */
export function InvitationEmail({
  inviterName,
  organizationName,
  role,
  acceptUrl,
}: InvitationEmailProps) {
  return (
    <EmailLayout preview={`You've been invited to join ${organizationName} on Plinth`}>
      <Heading style={heading}>You&apos;re invited to join {organizationName}</Heading>
      <Text style={paragraph}>
        {inviterName} invited you to join <strong>{organizationName}</strong> on Plinth as a {role}.
        Click below to accept the invitation and set up your access.
      </Text>
      <Button href={acceptUrl} style={button}>
        Accept invitation
      </Button>
      <Text style={paragraph}>
        This invitation expires in 72 hours. If you weren&apos;t expecting it, you can safely ignore
        this email &mdash; no account or membership is created unless you accept.
      </Text>
      <Text style={fallback}>Or paste this link into your browser: {acceptUrl}</Text>
    </EmailLayout>
  )
}
