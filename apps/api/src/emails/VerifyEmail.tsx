import { Button, Heading, Text } from '@react-email/components'

import { EmailLayout } from './EmailLayout.js'

type VerifyEmailProps = {
  /** Display name of the recipient, used in the greeting. */
  name: string
  /** Fully-qualified link (WEB_URL + token) the recipient clicks to verify. */
  verifyUrl: string
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
 * Email verification message sent on registration. Wired into the register flow
 * in a later Phase 8 PR; included here as the first template exercising the
 * {@link EmailLayout} + `sendEmail` pipeline.
 */
export function VerifyEmail({ name, verifyUrl }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Verify your email address to activate your Plinth account">
      <Heading style={heading}>Verify your email</Heading>
      <Text style={paragraph}>
        Hi {name}, thanks for signing up. Confirm your email address to activate your account.
      </Text>
      <Button href={verifyUrl} style={button}>
        Verify email address
      </Button>
      <Text style={paragraph}>
        This link expires in 24 hours. If you didn&apos;t create a Plinth account, you can safely
        ignore this email.
      </Text>
      <Text style={fallback}>Or paste this link into your browser: {verifyUrl}</Text>
    </EmailLayout>
  )
}
