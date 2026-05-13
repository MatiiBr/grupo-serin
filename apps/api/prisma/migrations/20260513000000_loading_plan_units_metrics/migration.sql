-- AlterTable
ALTER TABLE "PlacedItem" ADD COLUMN "unitIndex" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "UnplacedItem" ADD COLUMN "unitIndex" INTEGER NOT NULL DEFAULT 1;

-- DropIndex
DROP INDEX "PlacedItem_planId_productId_key";

-- DropIndex
DROP INDEX "UnplacedItem_planId_productId_key";

-- CreateIndex
CREATE UNIQUE INDEX "PlacedItem_planId_productId_unitIndex_key" ON "PlacedItem"("planId", "productId", "unitIndex");

-- CreateIndex
CREATE UNIQUE INDEX "UnplacedItem_planId_productId_unitIndex_key" ON "UnplacedItem"("planId", "productId", "unitIndex");

-- AlterTable
ALTER TABLE "PlanMetrics" ADD COLUMN "volumeUtilizationPct" DECIMAL(7,3),
ADD COLUMN "placedItemCount" INTEGER,
ADD COLUMN "unplacedItemCount" INTEGER,
ADD COLUMN "leftWeightKg" DECIMAL(12,3),
ADD COLUMN "rightWeightKg" DECIMAL(12,3),
ADD COLUMN "cabinSideWeightKg" DECIMAL(12,3),
ADD COLUMN "centerWeightKg" DECIMAL(12,3),
ADD COLUMN "doorSideWeightKg" DECIMAL(12,3),
ADD COLUMN "criticalAlertCount" INTEGER,
ADD COLUMN "warningAlertCount" INTEGER;
