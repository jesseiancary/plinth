-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationExpiresAt" TIMESTAMPTZ,
ADD COLUMN     "verificationTokenHash" VARCHAR(64);

-- Backfill: existing accounts (created before email verification existed) are grandfathered
-- in as verified so demo/seed users and any live accounts keep working. Only registrations
-- created after this migration start unverified (the column default).
UPDATE "users" SET "emailVerified" = true;

-- CreateIndex
-- Unique (not just indexed) so the database enforces single-use token issuance, matching
-- Invitation.tokenHash / ApiKey.keyHash. Postgres allows multiple NULLs, so verified users
-- (hash cleared to NULL) don't collide.
CREATE UNIQUE INDEX "users_verificationTokenHash_key" ON "users"("verificationTokenHash");
