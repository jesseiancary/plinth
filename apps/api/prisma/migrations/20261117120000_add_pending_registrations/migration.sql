-- Create the pending_registrations table: a signup awaiting email verification. The real
-- User (+ personal Organization + OWNER Membership) is materialized only when the emailed
-- link is clicked, so email ownership — not registration order — decides who controls an
-- account. `email` is intentionally NOT unique: multiple pending rows per email may coexist,
-- each carrying its own password hash and single-use token hash.
CREATE TABLE "pending_registrations" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "verificationTokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);

-- Unique (not just indexed) so the database enforces single-use token issuance, matching
-- Invitation.tokenHash / ApiKey.keyHash.
CREATE UNIQUE INDEX "pending_registrations_verificationTokenHash_key" ON "pending_registrations"("verificationTokenHash");

CREATE INDEX "pending_registrations_email_idx" ON "pending_registrations"("email");

CREATE INDEX "pending_registrations_expiresAt_idx" ON "pending_registrations"("expiresAt");

-- Remove accounts left unverified by the earlier (#78) email-verification flow before dropping
-- the verification columns they depended on. Under the pending-registration model a User with
-- emailVerified = false has NO recovery path (verify/resend operate on pending_registrations
-- rows, which these users have none of; register hits the duplicate branch), so they would be
-- permanently locked out. Their blast radius is bounded: an unverified user can only ever hold
-- its single personal-org OWNER membership — login is blocked, so it can never have accepted an
-- invitation into another org. Delete those users (cascading their memberships) and the orgs that
-- only they belong to, so the real inbox owner can re-register cleanly.
--
-- Delete personal orgs owned solely by unverified users first (the NOT EXISTS guard protects any
-- org that has at least one verified member). Deleting an organization cascades its memberships.
DELETE FROM "organizations" o
WHERE EXISTS (
  SELECT 1 FROM "memberships" m
  JOIN "users" u ON u."id" = m."userId"
  WHERE m."organizationId" = o."id" AND u."emailVerified" = false
)
AND NOT EXISTS (
  SELECT 1 FROM "memberships" m2
  JOIN "users" u2 ON u2."id" = m2."userId"
  WHERE m2."organizationId" = o."id" AND u2."emailVerified" = true
);

-- Then delete the unverified users themselves (cascades any remaining memberships).
DELETE FROM "users" WHERE "emailVerified" = false;

-- Drop the now-vestigial per-User verification columns. Verification happens before the User
-- exists under the pending-registration model, so these are unused and are removed to avoid
-- implying a second verification path on User. `emailVerified` stays (set true at
-- materialization) as the login gate; the add_email_verification migration already grandfathered
-- pre-existing users to emailVerified = true, and the DELETEs above clear any left unverified.
DROP INDEX "users_verificationTokenHash_key";

ALTER TABLE "users" DROP COLUMN "verificationTokenHash",
DROP COLUMN "verificationExpiresAt";
