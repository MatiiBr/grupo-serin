-- CreateEnum
CREATE TYPE "CustomsReleaseStatus" AS ENUM ('PENDING', 'CLEARED', 'BLOCKED');

-- CreateTable
CREATE TABLE "CustomsRelease" (
    "id" TEXT NOT NULL,
    "dispatchOrderId" TEXT NOT NULL,
    "status" "CustomsReleaseStatus" NOT NULL DEFAULT 'PENDING',
    "externalRef" TEXT,
    "blockedReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "CustomsRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomsRelease_dispatchOrderId_key" ON "CustomsRelease"("dispatchOrderId");

-- CreateIndex
CREATE INDEX "CustomsRelease_status_idx" ON "CustomsRelease"("status");

-- CreateIndex
CREATE INDEX "CustomsRelease_createdAt_idx" ON "CustomsRelease"("createdAt");

-- CreateIndex
CREATE INDEX "CustomsRelease_clearedAt_idx" ON "CustomsRelease"("clearedAt");

-- AddForeignKey
ALTER TABLE "CustomsRelease" ADD CONSTRAINT "CustomsRelease_dispatchOrderId_fkey" FOREIGN KEY ("dispatchOrderId") REFERENCES "DispatchOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
