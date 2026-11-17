-- Add self-service password-reset columns to the User model. Only the SHA-256 hash of the
-- emailed reset token is persisted (consistent with Invitation.tokenHash); the plaintext token
-- travels only in the reset link. Both columns are nullable — populated only while a reset is in
-- flight and cleared on consumption (single-use). No backfill is required: existing rows simply
-- have no reset in progress.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordResetExpiresAt" TIMESTAMPTZ,
ADD COLUMN "passwordResetTokenHash" VARCHAR(64);

-- CreateIndex
-- Unique (not just indexed) so the database enforces single-issuance of the reset token hash,
-- matching Invitation.tokenHash / ApiKey.keyHash / PendingRegistration.verificationTokenHash.
-- Postgres allows multiple NULLs under a unique index, so rows with no reset in progress coexist.
CREATE UNIQUE INDEX "users_passwordResetTokenHash_key" ON "users"("passwordResetTokenHash");
