-- AlterTable (Task A8: rank 1 = nearest free pod to the entry, for pickBestPod)
ALTER TABLE "Seat" ADD COLUMN     "bestRank" INTEGER;
