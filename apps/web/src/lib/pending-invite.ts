import { z } from 'zod'

import { createStorage } from './storage'

/**
 * Durable stash for an invitation token a visitor intends to accept but can't
 * yet (they need to sign up / verify their email first). The register → verify
 * (email round-trip) → login flow crosses sessions, so React Router's
 * `location.state` can't carry the invite across it — localStorage can.
 *
 * The token is already present in the user's invite email/URL, so persisting it
 * client-side adds no new sensitivity. Set it when an unauthenticated visitor
 * lands on a valid invite; consume it on the next successful login to resume at
 * the invite page; clear it once accepted or when the token proves unusable.
 */
export const pendingInviteStorage = createStorage<string>({
  key: 'pendingInviteToken',
  schema: z.string().min(1),
})
