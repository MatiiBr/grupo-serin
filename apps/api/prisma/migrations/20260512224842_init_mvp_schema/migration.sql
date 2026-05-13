-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('DRAFT', 'PLAN_GENERATED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoadingMethod" AS ENUM ('REAR', 'SIDE', 'TOP', 'MIXED');

-- CreateEnum
CREATE TYPE "TruckZoneType" AS ENUM ('CABIN_SIDE', 'CENTER', 'DOOR_SIDE');

-- CreateEnum
CREATE TYPE "ProductFamily" AS ENUM ('COIL', 'SHEET', 'PROFILE', 'TUBE', 'BAR', 'GENERIC_PACKAGE');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('GENERATED', 'MODIFIED', 'APPROVED', 'INVALID');

-- CreateEnum
CREATE TYPE "UnplacedReason" AS ENUM ('DOES_NOT_FIT', 'EXCEEDS_WEIGHT', 'NO_AVAILABLE_SPACE', 'STACKING_RESTRICTION', 'MANUAL_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('MAX_WEIGHT_EXCEEDED', 'OUT_OF_BOUNDS', 'OVERLAP', 'HEIGHT_EXCEEDED', 'UNPLACED_ITEM', 'WEIGHT_IMBALANCE', 'DESTINATION_BLOCKED', 'STACKING_RISK', 'MANUAL_REVIEW_REQUIRED');

-- CreateTable
CREATE TABLE "LoadOperation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT,
    "notes" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Truck" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "description" TEXT,
    "loadingMethod" "LoadingMethod" NOT NULL DEFAULT 'REAR',
    "maxPayloadKg" DECIMAL(12,3),
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruckZone" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "type" "TruckZoneType" NOT NULL,
    "name" TEXT,
    "maxWeightKg" DECIMAL(12,3),
    "startXMm" INTEGER,
    "endXMm" INTEGER,
    "startYMm" INTEGER,
    "endYMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruckZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "unloadingOrder" INTEGER NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadProduct" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "destinationId" TEXT,
    "code" TEXT NOT NULL,
    "family" "ProductFamily" NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weightKg" DECIMAL(12,3),
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadingPlan" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'GENERATED',
    "method" "LoadingMethod" NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacedItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "truckZoneId" TEXT,
    "xMm" INTEGER NOT NULL,
    "yMm" INTEGER NOT NULL,
    "zMm" INTEGER NOT NULL DEFAULT 0,
    "rotationDeg" INTEGER NOT NULL DEFAULT 0,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnplacedItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reason" "UnplacedReason" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnplacedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadingStep" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "placedItemId" TEXT,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadAlert" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "productId" TEXT,
    "placedItemId" TEXT,
    "severity" "AlertSeverity" NOT NULL,
    "type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoadAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanMetrics" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "totalWeightKg" DECIMAL(12,3),
    "placedWeightKg" DECIMAL(12,3),
    "unplacedWeightKg" DECIMAL(12,3),
    "usedVolumeM3" DECIMAL(12,3),
    "loadLengthMm" INTEGER,
    "maxHeightMm" INTEGER,
    "centerOfGravityX" DECIMAL(12,3),
    "centerOfGravityY" DECIMAL(12,3),
    "centerOfGravityZ" DECIMAL(12,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoadOperation_code_key" ON "LoadOperation"("code");

-- CreateIndex
CREATE INDEX "LoadOperation_status_idx" ON "LoadOperation"("status");

-- CreateIndex
CREATE INDEX "LoadOperation_scheduledAt_idx" ON "LoadOperation"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_operationId_key" ON "Truck"("operationId");

-- CreateIndex
CREATE INDEX "Truck_plate_idx" ON "Truck"("plate");

-- CreateIndex
CREATE INDEX "TruckZone_truckId_idx" ON "TruckZone"("truckId");

-- CreateIndex
CREATE UNIQUE INDEX "TruckZone_truckId_type_key" ON "TruckZone"("truckId", "type");

-- CreateIndex
CREATE INDEX "Destination_operationId_code_idx" ON "Destination"("operationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_operationId_unloadingOrder_key" ON "Destination"("operationId", "unloadingOrder");

-- CreateIndex
CREATE INDEX "LoadProduct_operationId_destinationId_idx" ON "LoadProduct"("operationId", "destinationId");

-- CreateIndex
CREATE INDEX "LoadProduct_operationId_code_idx" ON "LoadProduct"("operationId", "code");

-- CreateIndex
CREATE INDEX "LoadProduct_family_idx" ON "LoadProduct"("family");

-- CreateIndex
CREATE INDEX "LoadingPlan_operationId_isCurrent_version_idx" ON "LoadingPlan"("operationId", "isCurrent", "version");

-- CreateIndex
CREATE INDEX "LoadingPlan_operationId_status_idx" ON "LoadingPlan"("operationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LoadingPlan_operationId_version_key" ON "LoadingPlan"("operationId", "version");

-- CreateIndex
CREATE INDEX "PlacedItem_planId_idx" ON "PlacedItem"("planId");

-- CreateIndex
CREATE INDEX "PlacedItem_productId_idx" ON "PlacedItem"("productId");

-- CreateIndex
CREATE INDEX "PlacedItem_truckZoneId_idx" ON "PlacedItem"("truckZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacedItem_planId_productId_key" ON "PlacedItem"("planId", "productId");

-- CreateIndex
CREATE INDEX "UnplacedItem_planId_idx" ON "UnplacedItem"("planId");

-- CreateIndex
CREATE INDEX "UnplacedItem_productId_idx" ON "UnplacedItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "UnplacedItem_planId_productId_key" ON "UnplacedItem"("planId", "productId");

-- CreateIndex
CREATE INDEX "LoadingStep_planId_idx" ON "LoadingStep"("planId");

-- CreateIndex
CREATE INDEX "LoadingStep_placedItemId_idx" ON "LoadingStep"("placedItemId");

-- CreateIndex
CREATE UNIQUE INDEX "LoadingStep_planId_sequence_key" ON "LoadingStep"("planId", "sequence");

-- CreateIndex
CREATE INDEX "LoadAlert_planId_severity_idx" ON "LoadAlert"("planId", "severity");

-- CreateIndex
CREATE INDEX "LoadAlert_planId_type_idx" ON "LoadAlert"("planId", "type");

-- CreateIndex
CREATE INDEX "LoadAlert_productId_idx" ON "LoadAlert"("productId");

-- CreateIndex
CREATE INDEX "LoadAlert_placedItemId_idx" ON "LoadAlert"("placedItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanMetrics_planId_key" ON "PlanMetrics"("planId");

-- AddForeignKey
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "LoadOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckZone" ADD CONSTRAINT "TruckZone_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Destination" ADD CONSTRAINT "Destination_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "LoadOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadProduct" ADD CONSTRAINT "LoadProduct_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "LoadOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadProduct" ADD CONSTRAINT "LoadProduct_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadingPlan" ADD CONSTRAINT "LoadingPlan_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "LoadOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedItem" ADD CONSTRAINT "PlacedItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LoadingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedItem" ADD CONSTRAINT "PlacedItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LoadProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedItem" ADD CONSTRAINT "PlacedItem_truckZoneId_fkey" FOREIGN KEY ("truckZoneId") REFERENCES "TruckZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnplacedItem" ADD CONSTRAINT "UnplacedItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LoadingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnplacedItem" ADD CONSTRAINT "UnplacedItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LoadProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadingStep" ADD CONSTRAINT "LoadingStep_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LoadingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadingStep" ADD CONSTRAINT "LoadingStep_placedItemId_fkey" FOREIGN KEY ("placedItemId") REFERENCES "PlacedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadAlert" ADD CONSTRAINT "LoadAlert_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LoadingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadAlert" ADD CONSTRAINT "LoadAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LoadProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadAlert" ADD CONSTRAINT "LoadAlert_placedItemId_fkey" FOREIGN KEY ("placedItemId") REFERENCES "PlacedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMetrics" ADD CONSTRAINT "PlanMetrics_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LoadingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
