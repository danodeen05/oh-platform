-- Plan invitation: an optional recipient on a plan access code (sealed under
-- PLAN_PII_KEY) and when the invitation email last went out.

-- AlterTable
ALTER TABLE "PlanAccessCode" ADD COLUMN     "recipientFirstNameEnc" TEXT,
ADD COLUMN     "recipientLastNameEnc" TEXT,
ADD COLUMN     "recipientEmailEnc" TEXT,
ADD COLUMN     "inviteSentAt" TIMESTAMP(3),
ADD COLUMN     "inviteSentToEnc" TEXT,
ADD COLUMN     "inviteSendCount" INTEGER NOT NULL DEFAULT 0;
