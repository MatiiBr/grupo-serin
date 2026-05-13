-- AlterTable
ALTER TABLE "PlacedItem" ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manuallyAdjusted" BOOLEAN NOT NULL DEFAULT false;
