-- Private events (2026-10-01). Additive, idempotent. Prod is db-push managed (no _prisma_migrations).
ALTER TABLE "CateringEvent" ADD COLUMN IF NOT EXISTS "hostName" TEXT;
ALTER TABLE "CateringEvent" ADD COLUMN IF NOT EXISTS "welcomeNote" TEXT;
ALTER TABLE "CateringRSVP"  ADD COLUMN IF NOT EXISTS "notes" TEXT;
