-- AlterTable
ALTER TABLE "LoadProduct" ADD COLUMN     "fragile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxStackLoadKg" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "PlacedItem" ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "TruckTier" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "maxHeightMm" INTEGER,
    "maxWeightKg" DECIMAL(12,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruckTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TruckTier_truckId_idx" ON "TruckTier"("truckId");

-- CreateIndex
CREATE UNIQUE INDEX "TruckTier_truckId_level_key" ON "TruckTier"("truckId", "level");

-- AddForeignKey
ALTER TABLE "TruckTier" ADD CONSTRAINT "TruckTier_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "OperationDestinationAssignment_operationId_destinationCatalogId" RENAME TO "OperationDestinationAssignment_operationId_destinationCatal_key";

-- RenameIndex
ALTER INDEX "OperationProductAssignment_operationId_operationDestinationId_i" RENAME TO "OperationProductAssignment_operationId_operationDestination_idx";
