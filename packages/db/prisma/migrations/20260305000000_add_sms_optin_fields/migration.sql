-- AlterTable: Add SMS opt-in fields to User
ALTER TABLE "User" ADD COLUMN "smsOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "smsOptInDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "smsOptInMethod" TEXT;

-- AlterTable: Add SMS opt-in fields to Guest
ALTER TABLE "Guest" ADD COLUMN "smsOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN "smsOptInDate" TIMESTAMP(3);
