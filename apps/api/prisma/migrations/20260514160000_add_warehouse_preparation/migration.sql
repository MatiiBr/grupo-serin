-- CreateEnum
CREATE TYPE "PreparationStatus" AS ENUM ('PENDING', 'PICKING', 'READY', 'DISCREPANCY');

-- CreateTable
CREATE TABLE "Preparation" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "dispatchOrderId" TEXT NOT NULL,
    "status" "PreparationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "readyQuantity" INTEGER NOT NULL DEFAULT 0,
    "discrepancyQuantity" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Preparation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreparationItem" (
    "id" TEXT NOT NULL,
    "preparationId" TEXT NOT NULL,
    "reservationItemId" TEXT NOT NULL,
    "productCodeSnapshot" TEXT NOT NULL,
    "reservedQuantity" INTEGER NOT NULL,
    "readyQuantity" INTEGER NOT NULL,
    "discrepancyQuantity" INTEGER NOT NULL DEFAULT 0,
    "discrepancyReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreparationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Preparation_reservationId_key" ON "Preparation"("reservationId");

-- CreateIndex
CREATE INDEX "Preparation_dispatchOrderId_idx" ON "Preparation"("dispatchOrderId");

-- CreateIndex
CREATE INDEX "Preparation_status_idx" ON "Preparation"("status");

-- CreateIndex
CREATE INDEX "Preparation_createdAt_idx" ON "Preparation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PreparationItem_preparationId_reservationItemId_key" ON "PreparationItem"("preparationId", "reservationItemId");

-- CreateIndex
CREATE INDEX "PreparationItem_reservationItemId_idx" ON "PreparationItem"("reservationItemId");

-- AddForeignKey
ALTER TABLE "Preparation" ADD CONSTRAINT "Preparation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preparation" ADD CONSTRAINT "Preparation_dispatchOrderId_fkey" FOREIGN KEY ("dispatchOrderId") REFERENCES "DispatchOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparationItem" ADD CONSTRAINT "PreparationItem_preparationId_fkey" FOREIGN KEY ("preparationId") REFERENCES "Preparation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparationItem" ADD CONSTRAINT "PreparationItem_reservationItemId_fkey" FOREIGN KEY ("reservationItemId") REFERENCES "ReservationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
