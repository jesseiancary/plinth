import { isTestEnv } from './env.js'

/**
 * Dispatch a transactional email without letting it affect the HTTP response.
 *
 * Failures are swallowed (the email layer logs `EMAIL_SEND_FAILED` for both template-render and
 * SMTP-delivery failures) so a transient outage can't fail the request. The recovery path is
 * flow-specific — re-registering for a fresh verification link, re-requesting a reset, or (for
 * invitations) resending from the token still returned in the create response.
 *
 * In production the send is **fire-and-forget**: awaiting a slow SMTP round-trip would delay the
 * caller, and on enumeration-safe branches (e.g. duplicate registration) it would create a timing
 * oracle — `normalizeAuthTiming` only raises latency to a floor, it cannot cap it, so an awaited
 * send would make the "account exists" branch measurably slower than the no-op branches. In the
 * test environment we await instead, so the in-memory outbox is populated deterministically for
 * assertions.
 */
export const dispatchEmail = async (send: () => Promise<void>): Promise<void> => {
  const safeSend = async (): Promise<void> => {
    try {
      await send()
    } catch {
      // Intentionally ignored — failure already logged by the email layer.
    }
  }

  if (isTestEnv) {
    await safeSend()
    return
  }

  // Fire-and-forget: safeSend never rejects, so no unhandled rejection.
  void safeSend()
}
