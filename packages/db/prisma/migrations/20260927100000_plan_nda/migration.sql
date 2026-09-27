-- CreateEnum
CREATE TYPE "PlanNdaStatus" AS ENUM ('DRAFT', 'SIGNED', 'VOIDED');

-- AlterTable
ALTER TABLE "PlanAccessCode" ADD COLUMN     "ndaRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlanNda" (
    "id" TEXT NOT NULL,
    "accessCodeId" TEXT NOT NULL,
    "status" "PlanNdaStatus" NOT NULL DEFAULT 'DRAFT',
    "version" TEXT,
    "legalNameEnc" TEXT,
    "emailEnc" TEXT,
    "phoneEnc" TEXT,
    "addressEnc" TEXT,
    "companyEnc" TEXT,
    "titleEnc" TEXT,
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "otpSentAt" TIMESTAMP(3),
    "otpSendCount" INTEGER NOT NULL DEFAULT 0,
    "phoneVerifiedAt" TIMESTAMP(3),
    "signatureKind" TEXT,
    "signatureEnc" TEXT,
    "consentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signerIpEnc" TEXT,
    "signerUserAgent" TEXT,
    "documentSha256" TEXT,
    "pdfEnc" BYTEA,
    "pdfSha256" TEXT,
    "countersignerName" TEXT,
    "countersignerTitle" TEXT,
    "emailedAt" TIMESTAMP(3),
    "textedAt" TIMESTAMP(3),
    "ownerNotifiedAt" TIMESTAMP(3),
    "deliveryError" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanNda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanNdaCountersigner" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanNdaCountersigner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanNda_accessCodeId_status_idx" ON "PlanNda"("accessCodeId", "status");

-- AddForeignKey
ALTER TABLE "PlanNda" ADD CONSTRAINT "PlanNda_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "PlanAccessCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

