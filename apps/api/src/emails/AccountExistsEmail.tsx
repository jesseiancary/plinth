import { Button, Heading, Text } from '@react-email/components'

import { EmailLayout } from './EmailLayout.js'

type AccountExistsEmailProps = {
  /** Display name of the existing account holder, used in the greeting. */
  name: string
  /** Link to the login page (WEB_URL/login). */
  loginUrl: string
  /** Link to start a password reset (WEB_URL/forgot-password). */
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

/**
 * Sent when someone attempts to register with an email that already has an account.
 * The registration endpoint returns a generic response to prevent account enumeration;
 * this email is the enumeration-safe side-channel that lets the real owner know, without
 * the request itself confirming the address exists.
 */
export function AccountExistsEmail({ name, loginUrl, resetUrl }: AccountExistsEmailProps) {
  return (
    <EmailLayout preview="Someone tried to create a Plinth account with your email">
      <Heading style={heading}>You already have an account</Heading>
      <Text style={paragraph}>
        Hi {name}, someone just tried to sign up for Plinth using this email address, but an account
        already exists. If this was you, simply log in — there&apos;s no need to register again.
      </Text>
      <Button href={loginUrl} style={button}>
        Log in
      </Button>
      <Text style={paragraph}>
        If you&apos;ve forgotten your password, you can <a href={resetUrl}>reset it here</a>. If
        this wasn&apos;t you, no action is needed — your account is safe and no changes were made.
      </Text>
    </EmailLayout>
  )
}
