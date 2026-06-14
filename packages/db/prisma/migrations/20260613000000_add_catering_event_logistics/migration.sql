-- AlterTable: Add structured event logistics fields to CateringEvent.
-- All columns are nullable with no defaults, so this is purely additive and safe
-- to apply to an existing (production) table without a backfill.
ALTER TABLE "CateringEvent" ADD COLUMN "eventType" TEXT;
ALTER TABLE "CateringEvent" ADD COLUMN "expectedGuests" INTEGER;
ALTER TABLE "CateringEvent" ADD COLUMN "dietaryNotes" TEXT;
ALTER TABLE "CateringEvent" ADD COLUMN "setupNotes" TEXT;
ALTER TABLE "CateringEvent" ADD COLUMN "onsiteContactName" TEXT;
ALTER TABLE "CateringEvent" ADD COLUMN "onsiteContactPhone" TEXT;
