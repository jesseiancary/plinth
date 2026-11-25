import type { ReactElement } from 'react'
import type { SendEmailCommandInput } from '@aws-sdk/client-sesv2'
import { render, toPlainText } from '@react-email/render'
import type { Transporter } from 'nodemailer'
import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'

import { logEmailEvent } from './business-logger.js'
import { env, isTestEnv } from './env.js'

export type EmailMessage = {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

export type SendEmailParams = {
  to: string
  subject: string
  react: ReactElement
}

export type SentEmail = {
  to: string
  subject: string
  html: string
  text: string
}

const DEFAULT_SMTP_PORT = 587
const IMPLICIT_TLS_PORT = 465

/**
 * In-memory outbox used in the test environment instead of a real SMTP connection.
 * Integration tests can assert that an email was "sent" (and inspect its rendered
 * contents) without standing up a mail server.
 */
const testOutbox: SentEmail[] = []

export const getTestOutbox = (): readonly SentEmail[] => testOutbox

export const clearTestOutbox = (): void => {
  testOutbox.length = 0
}

/**
 * Build nodemailer transport options from raw SMTP settings. Pure and exported so
 * the port/TLS/auth branch logic can be unit-tested without env coupling.
 *
 * - Port 465 uses implicit TLS (`secure: true`).
 * - Other ports (587 STARTTLS, 1025 Mailpit) are not implicitly encrypted. When
 *   credentials are present we force STARTTLS (`requireTLS: true`) so a MITM can't
 *   strip encryption and capture them. Mailpit (no auth) is left unforced so local
 *   dev — which offers no STARTTLS — keeps working.
 *
 * The "only one credential set" case is rejected at the env layer (see env.ts's
 * superRefine), so it can't reach production; this helper stays defensively tolerant
 * of it (auth omitted) rather than throwing.
 */
export const buildTransportOptions = (params: {
  host: string | undefined
  port: number
  user: string | undefined
  pass: string | undefined
}): SMTPTransport.Options => {
  const secure = params.port === IMPLICIT_TLS_PORT
  const auth = params.user && params.pass ? { user: params.user, pass: params.pass } : undefined

  return {
    host: params.host,
    port: params.port,
    secure,
    requireTLS: Boolean(auth) && !secure,
    auth,
  }
}

/**
 * Minimal transport contract the send path depends on: something that accepts a
 * fully-rendered {@link EmailMessage}. Both a nodemailer SMTP `Transporter` and the
 * SES HTTPS adapter below satisfy it, which keeps {@link deliverEmail} transport-agnostic.
 */
export type EmailTransport = {
  sendMail: (message: EmailMessage) => Promise<unknown>
}

/** SMTP transport (local Mailpit in dev; any SMTP provider otherwise). */
const createSmtpTransport = (): Transporter =>
  nodemailer.createTransport(
    buildTransportOptions({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ? Number(env.SMTP_PORT) : DEFAULT_SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    }),
  )

/**
 * Map a rendered message to SES v2 `SendEmail` input. Pure and exported so the
 * EmailMessage → SES-request mapping can be unit-tested without an AWS client.
 */
export const buildSesSendInput = (message: EmailMessage): SendEmailCommandInput => ({
  FromEmailAddress: message.from,
  Destination: { ToAddresses: [message.to] },
  Content: {
    Simple: {
      Subject: { Data: message.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: message.html, Charset: 'UTF-8' },
        Text: { Data: message.text, Charset: 'UTF-8' },
      },
    },
  },
})

/**
 * SES HTTPS-API transport. Used in production because Railway's Hobby plan blocks
 * outbound SMTP; HTTPS (443) is unaffected. Region/credentials are validated at the
 * env layer when EMAIL_TRANSPORT=ses (see env.ts's superRefine).
 */
const createSesTransport = (): EmailTransport => {
  // Lazily import the AWS SDK so the SMTP/test paths (the default transport) never load
  // the multi-megabyte client. This runs only on the `ses` branch; the dynamic import is
  // module-cached, so it resolves once and is reused across sends.
  const sdk = import('@aws-sdk/client-sesv2')
  // Region + credentials are guaranteed present here by env validation (EMAIL_TRANSPORT=ses);
  // keys are included only when set so `exactOptionalPropertyTypes` isn't handed `undefined`.
  const client = sdk.then(
    (aws) =>
      new aws.SESv2Client({
        ...(env.AWS_REGION ? { region: env.AWS_REGION } : {}),
        ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
          ? {
              credentials: {
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
              },
            }
          : {}),
      }),
  )
  return {
    sendMail: async (message) => {
      const aws = await sdk
      return (await client).send(new aws.SendEmailCommand(buildSesSendInput(message)))
    },
  }
}

let transporter: EmailTransport | null = null

/**
 * Lazily create (and memoize) the transport selected by EMAIL_TRANSPORT: the SES
 * HTTPS API in production, SMTP (Mailpit) in dev.
 */
const getTransporter = (): EmailTransport => {
  if (!transporter) {
    transporter = env.EMAIL_TRANSPORT === 'ses' ? createSesTransport() : createSmtpTransport()
  }
  return transporter
}

/**
 * Dispatch a fully-rendered message over the given transport, logging the outcome
 * (metadata only — never the body) and rethrowing on failure so callers can react.
 *
 * Exported so the send/success/failure-logging path is testable with a stub transport
 * without depending on the module's env gate (see {@link sendEmail}).
 */
export const deliverEmail = async (
  transport: EmailTransport,
  message: EmailMessage,
): Promise<void> => {
  try {
    await transport.sendMail(message)
  } catch (error) {
    logEmailEvent({
      event: 'EMAIL_SEND_FAILED',
      to: message.to,
      subject: message.subject,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  logEmailEvent({ event: 'EMAIL_SENT', to: message.to, subject: message.subject })
}

/**
 * Render a React Email component to HTML + plain text and send it.
 *
 * The component tree is rendered once to HTML; the plain-text alternative is derived
 * from that HTML. In the test environment the message is collected in an in-memory
 * outbox (see {@link getTestOutbox}) rather than dispatched over SMTP.
 */
export const sendEmail = async ({ to, subject, react }: SendEmailParams): Promise<void> => {
  // Render inside a try so a template failure logs at the same chokepoint as a delivery
  // failure (deliverEmail logs the send path). Without this, a broken template throws
  // silently and callers that swallow email errors see no trace of the outage.
  let html: string
  let text: string
  try {
    html = await render(react)
    text = toPlainText(html)
  } catch (error) {
    logEmailEvent({
      event: 'EMAIL_SEND_FAILED',
      to,
      subject,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  if (isTestEnv) {
    testOutbox.push({ to, subject, html, text })
    return
  }

  await deliverEmail(getTransporter(), { from: env.EMAIL_FROM, to, subject, html, text })
}
