-- CreateEnum
CREATE TYPE "CreditLotSource" AS ENUM ('CASHBACK', 'REFERRAL', 'WELCOME', 'GOODWILL', 'CHALLENGE', 'ADMIN', 'LEGACY', 'MEAL_GIFT');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('FREE_BOWL', 'PREMIUM_ADDON');

-- CreateEnum
CREATE TYPE "SupportCaseType" AS ENUM ('POD_ISSUE', 'ORDER_ISSUE', 'REFUND_REQUEST', 'GENERAL', 'CONTACT');

-- CreateEnum
CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'RESOLVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SupportResolution" AS ENUM ('GOODWILL_CREDIT', 'STAFF_CREDIT', 'FULL_REFUND', 'DECLINED', 'INFO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreditEventType" ADD VALUE 'GOODWILL';
ALTER TYPE "CreditEventType" ADD VALUE 'WELCOME';
ALTER TYPE "CreditEventType" ADD VALUE 'REWARD_REDEEMED';
ALTER TYPE "CreditEventType" ADD VALUE 'REFUND_RESTORE';

-- AlterTable
ALTER TABLE "Badge" ADD COLUMN     "i18n" JSONB,
ADD COLUMN     "iconKey" TEXT,
ALTER COLUMN "iconEmoji" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "i18n" JSONB,
ADD COLUMN     "iconKey" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "i18n" JSONB,
ADD COLUMN     "layoutKey" TEXT,
ADD COLUMN     "layoutMirror" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "podCount" INTEGER,
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "releaseAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "membershipProcessedAt" TIMESTAMP(3);

-- AlterTable (Task A6: server-computed quote persisted on the order)
ALTER TABLE "Order" ADD COLUMN     "subtotalCents" INTEGER,
ADD COLUMN     "amountDueCents" INTEGER,
ADD COLUMN     "creditsAppliedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rewardId" TEXT,
ADD COLUMN     "rewardDiscountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "giftCardId" TEXT,
ADD COLUMN     "giftCardAppliedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mealGiftId" TEXT,
ADD COLUMN     "mealGiftAppliedCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable (Task A6: a meal gift is usable only once its funding is verified)
ALTER TABLE "MealGift" ADD COLUMN     "stripePaymentIntentId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "MealGift_stripePaymentIntentId_key" ON "MealGift"("stripePaymentIntentId");

-- AlterTable
ALTER TABLE "Seat" ADD COLUMN     "finger" INTEGER,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "position" INTEGER,
ADD COLUMN     "retiredAt" TIMESTAMP(3),
ADD COLUMN     "rowSide" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastTierCelebrated" "MembershipTier",
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "welcomeSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CreditLot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "CreditLotSource" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "remainingCents" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "RewardType" NOT NULL,
    "issuedFor" TEXT NOT NULL,
    "windowEndsAt" TIMESTAMP(3) NOT NULL,
    "redeemedOrderId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orderId" TEXT,
    "type" "SupportCaseType" NOT NULL,
    "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "summary" TEXT NOT NULL,
    "transcript" JSONB,
    "contact" JSONB,
    "locale" TEXT,
    "resolution" "SupportResolution",
    "amountCents" INTEGER,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditLot_userId_expiresAt_idx" ON "CreditLot"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_userId_type_issuedFor_key" ON "Reward"("userId", "type", "issuedFor");

-- CreateIndex
CREATE INDEX "SupportCase_status_createdAt_idx" ON "SupportCase"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");

-- CreateIndex
CREATE INDEX "Seat_locationId_retiredAt_idx" ON "Seat"("locationId", "retiredAt");

-- AddForeignKey
ALTER TABLE "CreditLot" ADD CONSTRAINT "CreditLot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

