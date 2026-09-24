-- CreateEnum
CREATE TYPE "PlanAudience" AS ENUM ('INVESTOR', 'LENDER', 'LANDLORD', 'PARTNER', 'ADVISOR', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PlanScenario" AS ENUM ('CONSERVATIVE', 'BASE', 'AGGRESSIVE');

-- CreateTable
CREATE TABLE "PlanAccessCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "audience" "PlanAudience" NOT NULL,
    "defaultScenario" "PlanScenario" NOT NULL DEFAULT 'BASE',
    "allowedSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "maxSessions" INTEGER,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "PlanAccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanViewSession" (
    "id" TEXT NOT NULL,
    "accessCodeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "country" TEXT,
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanViewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSectionView" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interactions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanSectionView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanQuestion" (
    "id" TEXT NOT NULL,
    "accessCodeId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contactEmail" TEXT,
    "answeredAt" TIMESTAMP(3),
    "answerBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanAccessCode_code_key" ON "PlanAccessCode"("code");

-- CreateIndex
CREATE INDEX "PlanViewSession_accessCodeId_startedAt_idx" ON "PlanViewSession"("accessCodeId", "startedAt");

-- CreateIndex
CREATE INDEX "PlanSectionView_sessionId_sectionKey_idx" ON "PlanSectionView"("sessionId", "sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlanSectionView_sessionId_sectionKey_key" ON "PlanSectionView"("sessionId", "sectionKey");

-- CreateIndex
CREATE INDEX "PlanQuestion_accessCodeId_createdAt_idx" ON "PlanQuestion"("accessCodeId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlanViewSession" ADD CONSTRAINT "PlanViewSession_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "PlanAccessCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSectionView" ADD CONSTRAINT "PlanSectionView_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlanViewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanQuestion" ADD CONSTRAINT "PlanQuestion_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "PlanAccessCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

