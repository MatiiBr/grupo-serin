-- CreateEnum
CREATE TYPE "TransportExitStatus" AS ENUM ('PENDING', 'DOCS_READY', 'SCALED', 'AUTHORIZED_EXIT', 'DISPATCHED', 'BLOCKED');

-- CreateTable
CREATE TABLE "TransportExit" (
    "id" TEXT NOT NULL,
    "dispatchOrderId" TEXT NOT NULL,
    "status" "TransportExitStatus" NOT NULL DEFAULT 'PENDING',
    "externalRef" TEXT,
    "docsReadyAt" TIMESTAMP(3),
    "scaleWeightKg" DECIMAL(12,3),
    "scaledAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportExit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransportExit_dispatchOrderId_key" ON "TransportExit"("dispatchOrderId");

-- CreateIndex
CREATE INDEX "TransportExit_status_idx" ON "TransportExit"("status");

-- CreateIndex
CREATE INDEX "TransportExit_createdAt_idx" ON "TransportExit"("createdAt");

-- CreateIndex
CREATE INDEX "TransportExit_authorizedAt_idx" ON "TransportExit"("authorizedAt");

-- CreateIndex
CREATE INDEX "TransportExit_dispatchedAt_idx" ON "TransportExit"("dispatchedAt");

-- AddForeignKey
ALTER TABLE "TransportExit" ADD CONSTRAINT "TransportExit_dispatchOrderId_fkey" FOREIGN KEY ("dispatchOrderId") REFERENCES "DispatchOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
