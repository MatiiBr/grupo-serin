-- Add minimal Serin layer/eje domain model.
-- Axle group source is stored per record because demo P2 values are configured snapshots,
-- not a complete legal validation engine.

CREATE TYPE "AxleLoadStatus" AS ENUM ('OK', 'EXCEEDED', 'UNKNOWN');

CREATE TABLE "LoadingLayer" (
  "id" TEXT NOT NULL,
  "truckId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "groupLabel" TEXT NOT NULL,
  "minZMm" INTEGER NOT NULL,
  "maxZMm" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoadingLayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AxleGroup" (
  "id" TEXT NOT NULL,
  "truckId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "startXMm" INTEGER NOT NULL,
  "endXMm" INTEGER NOT NULL,
  "maxWeightKg" DECIMAL(12,3),
  "source" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AxleGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AxleLoadSnapshot" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "axleGroupId" TEXT,
  "axleGroupCode" TEXT NOT NULL,
  "axleGroupLabel" TEXT NOT NULL,
  "startXMm" INTEGER NOT NULL,
  "endXMm" INTEGER NOT NULL,
  "maxWeightKg" DECIMAL(12,3),
  "computedWeightKg" DECIMAL(12,3) NOT NULL,
  "status" "AxleLoadStatus" NOT NULL DEFAULT 'UNKNOWN',
  "source" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AxleLoadSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlacedItem" ADD COLUMN "loadingLayerId" TEXT;

CREATE UNIQUE INDEX "LoadingLayer_truckId_number_key" ON "LoadingLayer"("truckId", "number");
CREATE INDEX "LoadingLayer_truckId_idx" ON "LoadingLayer"("truckId");
CREATE UNIQUE INDEX "AxleGroup_truckId_code_key" ON "AxleGroup"("truckId", "code");
CREATE INDEX "AxleGroup_truckId_idx" ON "AxleGroup"("truckId");
CREATE UNIQUE INDEX "AxleLoadSnapshot_planId_axleGroupCode_key" ON "AxleLoadSnapshot"("planId", "axleGroupCode");
CREATE INDEX "AxleLoadSnapshot_planId_status_idx" ON "AxleLoadSnapshot"("planId", "status");
CREATE INDEX "AxleLoadSnapshot_axleGroupId_idx" ON "AxleLoadSnapshot"("axleGroupId");
CREATE INDEX "PlacedItem_loadingLayerId_idx" ON "PlacedItem"("loadingLayerId");

ALTER TABLE "LoadingLayer" ADD CONSTRAINT "LoadingLayer_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AxleGroup" ADD CONSTRAINT "AxleGroup_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AxleLoadSnapshot" ADD CONSTRAINT "AxleLoadSnapshot_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LoadingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AxleLoadSnapshot" ADD CONSTRAINT "AxleLoadSnapshot_axleGroupId_fkey" FOREIGN KEY ("axleGroupId") REFERENCES "AxleGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlacedItem" ADD CONSTRAINT "PlacedItem_loadingLayerId_fkey" FOREIGN KEY ("loadingLayerId") REFERENCES "LoadingLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
