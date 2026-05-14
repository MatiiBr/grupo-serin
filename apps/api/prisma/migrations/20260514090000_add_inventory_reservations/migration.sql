-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'RESERVED', 'PARTIAL', 'RELEASED');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "dispatchOrderId" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unreservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "externalRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "dispatchOrderItemId" TEXT NOT NULL,
    "productCatalogId" TEXT NOT NULL,
    "productCodeSnapshot" TEXT NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "availableQuantity" INTEGER NOT NULL,
    "reservedQuantity" INTEGER NOT NULL,
    "unreservedQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_dispatchOrderId_idx" ON "Reservation"("dispatchOrderId");
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX "Reservation_createdAt_idx" ON "Reservation"("createdAt");
CREATE UNIQUE INDEX "ReservationItem_reservationId_dispatchOrderItemId_key" ON "ReservationItem"("reservationId", "dispatchOrderItemId");
CREATE INDEX "ReservationItem_dispatchOrderItemId_idx" ON "ReservationItem"("dispatchOrderItemId");
CREATE INDEX "ReservationItem_productCatalogId_idx" ON "ReservationItem"("productCatalogId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_dispatchOrderId_fkey" FOREIGN KEY ("dispatchOrderId") REFERENCES "DispatchOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_dispatchOrderItemId_fkey" FOREIGN KEY ("dispatchOrderItemId") REFERENCES "DispatchOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_productCatalogId_fkey" FOREIGN KEY ("productCatalogId") REFERENCES "ProductCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
