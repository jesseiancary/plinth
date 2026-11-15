import type { ReactNode } from 'react'
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'

type EmailLayoutProps = {
  /** Short preview/snippet text shown by email clients in the inbox list. */
  preview: string
  children: ReactNode
}

const main = {
  backgroundColor: '#f3f4f6',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
}

const container = {
  margin: '0 auto',
  padding: '32px 24px',
  maxWidth: '480px',
}

const card = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '32px',
}

const footer = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
}

/**
 * Shared chrome for every transactional email: document head, inbox preview text,
 * a centered white card for the body, and a muted footer. Keep per-email templates
 * focused on their own content by wrapping them in this layout.
 */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>{children}</Section>
          <Hr />
          <Text style={footer}>
            Plinth — multi-tenant SaaS starter. This is an automated message.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
