import { Button, Heading, Text } from '@react-email/components'

import { EmailLayout } from './EmailLayout.js'

type ResetPasswordEmailProps = {
  /** Display name of the recipient, used in the greeting. */
  name: string
  /** Fully-qualified link (WEB_URL + token) the recipient clicks to set a new password. */
  resetUrl: string
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
 * Password-reset message carrying a single-use link. Sent only when the requested email maps to
 * a real account; the forgot-password endpoint responds generically either way so the request
 * itself never confirms whether the address exists. The copy reassures a recipient who did not
 * request a reset that no action is needed (the link can simply be ignored and the token expires).
 */
export function ResetPasswordEmail({ name, resetUrl }: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Reset your Plinth password">
      <Heading style={heading}>Reset your password</Heading>
      <Text style={paragraph}>
        Hi {name}, we received a request to reset the password for your Plinth account. Click below
        to choose a new password.
      </Text>
      <Button href={resetUrl} style={button}>
        Reset password
      </Button>
      <Text style={paragraph}>
        This link expires in 1 hour and can be used only once. If you didn&apos;t request a password
        reset, you can safely ignore this email &mdash; your password won&apos;t change and no
        action is needed.
      </Text>
      <Text style={fallback}>Or paste this link into your browser: {resetUrl}</Text>
    </EmailLayout>
  )
}
