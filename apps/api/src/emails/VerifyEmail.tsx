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
 * Email verification message sent on registration, carrying the single-use link that
 * materializes the account.
 *
 * The copy below is load-bearing for security, not just UX. Under the pending-registration
 * model the account is created with the password submitted in *this* link's sign-up request,
 * and a verification email is sent to the address on every sign-up attempt — including one an
 * attacker makes for someone else's address. The remaining takeover risk is a recipient
 * clicking a link for a sign-up they did not initiate (which would activate the attacker's
 * password). The wording makes that unambiguous: the link activates the password from *that*
 * request, and an unexpected or duplicate verification email is a signal not to click.
 */
export function VerifyEmail({ name, verifyUrl }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Verify your email address to activate your Plinth account">
      <Heading style={heading}>Verify your email</Heading>
      <Text style={paragraph}>
        Hi {name}, thanks for signing up. Click below to activate your Plinth account using the
        password you chose when you signed up.
      </Text>
      <Button href={verifyUrl} style={button}>
        Verify email address
      </Button>
      <Text style={paragraph}>
        This link sets up the account with the password submitted in that sign-up request, so only
        click it if you just signed up and recognize that password. If you didn&apos;t create a
        Plinth account &mdash; or you received more than one verification email for this address
        &mdash; don&apos;t click: ignore these emails and no account will be created. This link
        expires in 24 hours.
      </Text>
      <Text style={fallback}>Or paste this link into your browser: {verifyUrl}</Text>
    </EmailLayout>
  )
}
