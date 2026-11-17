import type {
  Organization,
  PendingRegistration,
  User,
} from '../../prisma/generated/client/client.js'
import { Prisma } from '../../prisma/generated/client/client.js'

import { prisma } from './db.js'
import { generateUniqueSlug } from './slug.js'

/**
 * A minimal slice of the Prisma client that works both on the base client and inside an
 * interactive transaction (`$transaction(async (tx) => ...)`), so callers can sweep as part
 * of a larger atomic operation or on its own.
 */
type PendingRegistrationDelegate = {
  pendingRegistration: { deleteMany: typeof prisma.pendingRegistration.deleteMany }
}

/**
 * How many times to regenerate a personal-org slug and retry when a concurrent
 * materialization claims the same slug first (unique violation on `organizations.slug`).
 * Collisions require two same-named users verifying at the same instant, so a few retries
 * is ample.
 */
const MAX_SLUG_ATTEMPTS = 5

/**
 * Delete pending registrations whose verification window has closed. Opportunistic
 * housekeeping — the materialization path already ignores expired tokens, so this only
 * reclaims dead rows. Called on register/resend; a scheduled job is a future improvement.
 */
export const sweepExpiredPendingRegistrations = async (
  client: PendingRegistrationDelegate = prisma,
): Promise<void> => {
  await client.pendingRegistration.deleteMany({ where: { expiresAt: { lt: new Date() } } })
}

const isUniqueViolationOn = (error: unknown, column: string): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false
  }
  const target = error.meta?.['target']
  return Array.isArray(target) && target.includes(column)
}

const isMissingRecord = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'

/**
 * Atomically materialize a pending registration into a real account: create the `User`
 * (verified, with the pending row's password hash), its personal `Organization`, and the
 * OWNER `Membership`, then consume the pending row. Single-use is enforced by the delete.
 *
 * Returns `null` when the account already exists for this email (a concurrent verify of
 * another pending row for the same address won the race): the caller should treat that as the
 * already-verified outcome. Any leftover pending rows for the email are cleaned up in that
 * case too, so their tokens can't be replayed.
 *
 * Slug collisions (two same-named users materializing at once) are resolved by regenerating a
 * fresh unique slug and retrying, so a losing race surfaces as a clean retry rather than a 500.
 */
export const materializePendingRegistration = async (
  pending: PendingRegistration,
): Promise<{ user: User; organization: Organization } | null> => {
  // Bounded retry loop: `attempt` must advance on slug collision, so a counter is unavoidable
  // here (mirrors the pattern in `generateUniqueSlug`).
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    // Slug generation queries existing orgs; compute it per attempt so a retry picks a fresh,
    // still-unclaimed slug after a collision.
    const orgSlug = await generateUniqueSlug(pending.name)

    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: pending.email,
            password: pending.passwordHash,
            name: pending.name,
            emailVerified: true,
            memberships: {
              create: {
                role: 'OWNER',
                organization: {
                  create: {
                    name: `${pending.name}'s Organization`,
                    slug: orgSlug,
                  },
                },
              },
            },
          },
          include: {
            memberships: {
              include: {
                organization: true,
              },
            },
          },
        })

        await tx.pendingRegistration.delete({ where: { id: pending.id } })

        const organization = user.memberships[0]?.organization
        if (!organization) {
          // Unreachable: the OWNER membership + organization are created together above.
          throw new Error('Materialized user is missing its personal organization')
        }

        return { user, organization }
      })
    } catch (error) {
      // A concurrent verify for another pending row of the same email won the race and created
      // the User first (unique constraint on `users.email`). Collapse to already-verified.
      if (isUniqueViolationOn(error, 'email')) {
        await prisma.pendingRegistration.deleteMany({ where: { email: pending.email } })
        return null
      }

      // The pending row vanished mid-transaction (swept, or consumed by a concurrent verify of
      // the same token). Collapse to already-verified only if the account actually exists now;
      // otherwise this is an unexpected failure and must surface rather than falsely succeed.
      if (isMissingRecord(error)) {
        const existing = await prisma.user.findUnique({
          where: { email: pending.email },
          select: { id: true },
        })
        if (existing) {
          await prisma.pendingRegistration.deleteMany({ where: { email: pending.email } })
          return null
        }
        throw error
      }

      // Lost the slug to a concurrent same-named materialization — regenerate and retry.
      if (isUniqueViolationOn(error, 'slug')) {
        continue
      }

      throw error
    }
  }

  // Exhausted slug retries (pathological contention). Surface as an unexpected error.
  throw new Error('Unable to materialize registration: slug allocation kept colliding')
}
