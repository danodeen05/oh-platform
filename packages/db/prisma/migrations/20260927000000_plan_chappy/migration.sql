-- Chappy on the business plan: chat log, visit summaries, interaction detail.
-- Additive only. Prod is applied by hand with psql (no _prisma_migrations table there).

-- AlterTable
ALTER TABLE "PlanViewSession" ALTER COLUMN "lastSeenAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PlanViewSession" ADD COLUMN "events" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "PlanSectionView" ADD COLUMN "targets" JSONB;

-- CreateTable
CREATE TABLE "PlanChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "accessCodeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sectionKey" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVisitSummary" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "visitStart" TIMESTAMP(3) NOT NULL,
    "visitEnd" TIMESTAMP(3) NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "sections" JSONB NOT NULL DEFAULT '{}',
    "chatCount" INTEGER NOT NULL DEFAULT 0,
    "verdict" TEXT,
    "take" TEXT,
    "emailedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVisitSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanChatMessage_sessionId_createdAt_idx" ON "PlanChatMessage"("sessionId", "createdAt");
CREATE INDEX "PlanChatMessage_accessCodeId_createdAt_idx" ON "PlanChatMessage"("accessCodeId", "createdAt");
CREATE INDEX "PlanVisitSummary_sessionId_visitEnd_idx" ON "PlanVisitSummary"("sessionId", "visitEnd");

-- AddForeignKey
ALTER TABLE "PlanChatMessage" ADD CONSTRAINT "PlanChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlanViewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanChatMessage" ADD CONSTRAINT "PlanChatMessage_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "PlanAccessCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanVisitSummary" ADD CONSTRAINT "PlanVisitSummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlanViewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
