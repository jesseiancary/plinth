import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { VerifyEmail } from '../emails/VerifyEmail.js'

import {
  buildSesSendInput,
  buildTransportOptions,
  clearTestOutbox,
  deliverEmail,
  getTestOutbox,
  sendEmail,
} from './email.js'
import { logger } from './logger.js'

const verifyUrl = 'https://localhost/verify-email?token=abc123'

const renderVerifyEmail = () =>
  sendEmail({
    to: 'ada@example.com',
    subject: 'Verify your email',
    react: createElement(VerifyEmail, { name: 'Ada', verifyUrl }),
  })

describe('sendEmail (test environment)', () => {
  beforeEach(() => {
    clearTestOutbox()
  })

  it('collects the message in the in-memory outbox instead of sending over SMTP', async () => {
    await renderVerifyEmail()

    const outbox = getTestOutbox()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]?.to).toBe('ada@example.com')
    expect(outbox[0]?.subject).toBe('Verify your email')
  })

  it('renders the React component to HTML containing the dynamic props', async () => {
    await renderVerifyEmail()

    const { html } = getTestOutbox()[0] ?? {}
    expect(html).toContain('Ada')
    expect(html).toContain(verifyUrl)
    expect(html).toContain('<html')
  })

  it('renders a plain-text alternative with no HTML markup', async () => {
    await renderVerifyEmail()

    const { text } = getTestOutbox()[0] ?? {}
    expect(text).toContain(verifyUrl)
    expect(text).not.toContain('<html')
    expect(text).not.toContain('<body')
  })

  it('clearTestOutbox empties the outbox', async () => {
    await renderVerifyEmail()
    expect(getTestOutbox()).toHaveLength(1)

    clearTestOutbox()
    expect(getTestOutbox()).toHaveLength(0)
  })
})

describe('sendEmail (render failure)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearTestOutbox()
  })

  it('logs EMAIL_SEND_FAILED and rethrows when template rendering throws', async () => {
    const warnSpy = vi.spyOn(logger, 'warn')
    const ThrowingEmail = () => {
      throw new Error('template render boom')
    }

    await expect(
      sendEmail({
        to: 'ada@example.com',
        subject: 'Verify your email',
        react: createElement(ThrowingEmail),
      }),
    ).rejects.toThrow('template render boom')

    expect(warnSpy).toHaveBeenCalledWith(
      'Email send failed',
      expect.objectContaining({
        event: 'EMAIL_SEND_FAILED',
        to: 'ada@example.com',
        subject: 'Verify your email',
        error: 'template render boom',
      }),
    )
    // A render failure must not leave a half-built message in the outbox.
    expect(getTestOutbox()).toHaveLength(0)
  })
})

describe('buildTransportOptions', () => {
  it('uses implicit TLS on port 465 (no STARTTLS forced)', () => {
    const options = buildTransportOptions({
      host: 'smtp.example.com',
      port: 465,
      user: 'u',
      pass: 'p',
    })

    expect(options.secure).toBe(true)
    expect(options.requireTLS).toBe(false)
    expect(options.auth).toEqual({ user: 'u', pass: 'p' })
  })

  it('forces STARTTLS on a non-implicit-TLS port when credentials are present', () => {
    const options = buildTransportOptions({
      host: 'smtp.example.com',
      port: 587,
      user: 'u',
      pass: 'p',
    })

    expect(options.secure).toBe(false)
    expect(options.requireTLS).toBe(true)
    expect(options.auth).toEqual({ user: 'u', pass: 'p' })
  })

  it('does not force STARTTLS without credentials (e.g. local Mailpit on 1025)', () => {
    const options = buildTransportOptions({
      host: 'mailpit',
      port: 1025,
      user: undefined,
      pass: undefined,
    })

    expect(options.secure).toBe(false)
    expect(options.requireTLS).toBe(false)
    expect(options.auth).toBeUndefined()
  })

  it('omits auth when only one credential is provided', () => {
    const options = buildTransportOptions({
      host: 'smtp.example.com',
      port: 587,
      user: 'u',
      pass: undefined,
    })

    expect(options.auth).toBeUndefined()
    expect(options.requireTLS).toBe(false)
  })
})

describe('buildSesSendInput', () => {
  const message = {
    from: 'Plinth <noreply@plinth.example.com>',
    to: 'ada@example.com',
    subject: 'Verify your email',
    html: '<html><body>Hi Ada</body></html>',
    text: 'Hi Ada',
  }

  it('maps an EmailMessage to SES v2 SendEmail input', () => {
    const input = buildSesSendInput(message)

    expect(input.FromEmailAddress).toBe(message.from)
    expect(input.Destination?.ToAddresses).toEqual([message.to])
    expect(input.Content?.Simple?.Subject).toEqual({ Data: message.subject, Charset: 'UTF-8' })
    expect(input.Content?.Simple?.Body?.Html).toEqual({ Data: message.html, Charset: 'UTF-8' })
    expect(input.Content?.Simple?.Body?.Text).toEqual({ Data: message.text, Charset: 'UTF-8' })
  })

  it('sends to a single recipient (no accidental CC/BCC)', () => {
    const input = buildSesSendInput(message)

    expect(input.Destination?.ToAddresses).toHaveLength(1)
    expect(input.Destination?.CcAddresses).toBeUndefined()
    expect(input.Destination?.BccAddresses).toBeUndefined()
  })
})

describe('deliverEmail', () => {
  const message = {
    from: 'Plinth <noreply@plinth.local>',
    to: 'ada@example.com',
    subject: 'Verify your email',
    html: '<html><body>hello</body></html>',
    text: 'hello',
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the message and logs EMAIL_SENT metadata only (no body)', async () => {
    const infoSpy = vi.spyOn(logger, 'info')
    const sendMail = vi.fn().mockResolvedValue(undefined)

    await deliverEmail({ sendMail }, message)

    expect(sendMail).toHaveBeenCalledWith(message)
    expect(infoSpy).toHaveBeenCalledWith(
      'Email sent',
      expect.objectContaining({ event: 'EMAIL_SENT', to: message.to, subject: message.subject }),
    )
    // winston's logger overloads type mock.calls as a 1-tuple; widen to read the meta arg.
    const meta = (infoSpy.mock.calls[0] as unknown as unknown[])[1] as Record<string, unknown>
    expect(meta).not.toHaveProperty('html')
    expect(meta).not.toHaveProperty('text')
  })

  it('logs EMAIL_SEND_FAILED at warn and rethrows when the transport fails', async () => {
    const warnSpy = vi.spyOn(logger, 'warn')
    const sendMail = vi.fn().mockRejectedValue(new Error('boom'))

    await expect(deliverEmail({ sendMail }, message)).rejects.toThrow('boom')
    expect(warnSpy).toHaveBeenCalledWith(
      'Email send failed',
      expect.objectContaining({ event: 'EMAIL_SEND_FAILED', error: 'boom' }),
    )
  })

  it('truncates an oversized SMTP error before logging it', async () => {
    const warnSpy = vi.spyOn(logger, 'warn')
    const longMessage = 'x'.repeat(300)
    const sendMail = vi.fn().mockRejectedValue(new Error(longMessage))

    await expect(deliverEmail({ sendMail }, message)).rejects.toThrow()

    // winston's logger overloads type mock.calls as a 1-tuple; widen to read the meta arg.
    const meta = (warnSpy.mock.calls[0] as unknown as unknown[])[1] as { error: string }
    expect(meta.error).toHaveLength(201) // 200 chars + ellipsis
    expect(meta.error.endsWith('…')).toBe(true)
  })
})
