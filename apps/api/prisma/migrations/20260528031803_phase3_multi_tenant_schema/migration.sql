/*
  Warnings:

  - You are about to alter the column `name` on the `api_keys` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `keyHash` on the `api_keys` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to drop the column `token` on the `invitations` table. All the data in the column will be lost.
  - You are about to alter the column `email` on the `invitations` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `name` on the `organizations` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `slug` on the `organizations` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `email` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `password` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `name` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `provider` on the `webhook_events` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `eventType` on the `webhook_events` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `idempotencyKey` on the `webhook_events` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - A unique constraint covering the columns `[tokenHash]` on the table `invitations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tokenHash` to the `invitations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- DropIndex
DROP INDEX "invitations_organizationId_idx";

-- DropIndex
DROP INDEX "invitations_token_idx";

-- DropIndex
DROP INDEX "invitations_token_key";

-- DropIndex
DROP INDEX "organizations_slug_idx";

-- DropIndex
DROP INDEX "webhook_events_idempotencyKey_idx";

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "revokedAt" TIMESTAMPTZ,
ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "keyHash" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "lastUsedAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "invitations" DROP COLUMN "token",
ADD COLUMN     "acceptedAt" TIMESTAMPTZ,
ADD COLUMN     "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "tokenHash" VARCHAR(64) NOT NULL,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "memberships" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "slug" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "password" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "webhook_events" ALTER COLUMN "provider" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "eventType" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "idempotencyKey" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "processedAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "api_keys_organizationId_revokedAt_idx" ON "api_keys"("organizationId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_organizationId_status_idx" ON "invitations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "invitations_email_organizationId_status_idx" ON "invitations"("email", "organizationId", "status");

-- CreateIndex
CREATE INDEX "invitations_expiresAt_idx" ON "invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "memberships_organizationId_role_idx" ON "memberships"("organizationId", "role");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "webhook_events_processedAt_idx" ON "webhook_events"("processedAt");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
