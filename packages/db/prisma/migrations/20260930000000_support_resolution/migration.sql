-- AlterTable (Task A9: staff reason and resolution detail on support cases)
ALTER TABLE "SupportCase" ADD COLUMN     "resolutionDetail" JSONB,
ADD COLUMN     "resolutionNote" TEXT;
