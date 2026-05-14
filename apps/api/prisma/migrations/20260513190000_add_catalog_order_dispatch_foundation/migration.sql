-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'RECEIVED', 'CREDIT_HELD', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('PENDING', 'HELD', 'RELEASED');

-- CreateEnum
CREATE TYPE "SellerPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "DeliveryPlanStatus" AS ENUM ('DRAFT', 'PLANNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DispatchOrderStatus" AS ENUM ('PLANNED', 'READY_TO_LOAD', 'LOAD_OPERATION_LINKED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ProductCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "family" "ProductFamily" NOT NULL,
    "description" TEXT,
    "weightKg" DECIMAL(12,3),
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "rotationAllowed" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestinationCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DestinationCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruckCatalog" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "description" TEXT,
    "loadingMethod" "LoadingMethod" NOT NULL DEFAULT 'REAR',
    "maxPayloadKg" DECIMAL(12,3),
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruckCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrailerCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "maxPayloadKg" DECIMAL(12,3),
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrailerCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneTemplate" (
    "id" TEXT NOT NULL,
    "truckCatalogId" TEXT NOT NULL,
    "type" "TruckZoneType" NOT NULL,
    "name" TEXT,
    "maxWeightKg" DECIMAL(12,3),
    "startXMm" INTEGER,
    "endXMm" INTEGER,
    "startYMm" INTEGER,
    "endYMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoneTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationDestinationAssignment" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "destinationCatalogId" TEXT NOT NULL,
    "unloadingOrder" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationDestinationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationProductAssignment" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "productCatalogId" TEXT NOT NULL,
    "operationDestinationId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weightKgOverride" DECIMAL(12,3),
    "lengthMmOverride" INTEGER,
    "widthMmOverride" INTEGER,
    "heightMmOverride" INTEGER,
    "stackableOverride" BOOLEAN,
    "rotationAllowedOverride" BOOLEAN,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationProductAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationVehicleAssignment" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "truckCatalogId" TEXT NOT NULL,
    "trailerCatalogId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationVehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationTruckZone" (
    "id" TEXT NOT NULL,
    "vehicleAssignmentId" TEXT NOT NULL,
    "zoneTemplateId" TEXT,
    "type" "TruckZoneType" NOT NULL,
    "name" TEXT,
    "maxWeightKg" DECIMAL(12,3),
    "startXMm" INTEGER,
    "endXMm" INTEGER,
    "startYMm" INTEGER,
    "endYMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationTruckZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "creditStatus" "CreditStatus" NOT NULL DEFAULT 'PENDING',
    "sellerPriority" "SellerPriority" NOT NULL DEFAULT 'NORMAL',
    "destinationCatalogId" TEXT,
    "destinationName" TEXT,
    "requestedDeliveryAt" TIMESTAMP(3),
    "externalRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productCatalogId" TEXT,
    "productCode" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weightKg" DECIMAL(12,3),
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "DeliveryPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "plannedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "DispatchOrderStatus" NOT NULL DEFAULT 'PLANNED',
    "orderId" TEXT NOT NULL,
    "deliveryPlanId" TEXT,
    "destinationCatalogId" TEXT,
    "destinationNameSnapshot" TEXT,
    "sellerPriority" "SellerPriority" NOT NULL,
    "requestedDeliveryAt" TIMESTAMP(3),
    "loadOperationId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchOrderItem" (
    "id" TEXT NOT NULL,
    "dispatchOrderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productCatalogId" TEXT NOT NULL,
    "productCodeSnapshot" TEXT NOT NULL,
    "descriptionSnapshot" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weightKg" DECIMAL(12,3),
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalog_code_key" ON "ProductCatalog"("code");
CREATE INDEX "ProductCatalog_family_idx" ON "ProductCatalog"("family");
CREATE INDEX "ProductCatalog_description_idx" ON "ProductCatalog"("description");
CREATE INDEX "ProductCatalog_isActive_idx" ON "ProductCatalog"("isActive");
CREATE UNIQUE INDEX "DestinationCatalog_code_key" ON "DestinationCatalog"("code");
CREATE INDEX "DestinationCatalog_name_idx" ON "DestinationCatalog"("name");
CREATE INDEX "DestinationCatalog_isActive_idx" ON "DestinationCatalog"("isActive");
CREATE UNIQUE INDEX "TruckCatalog_plate_key" ON "TruckCatalog"("plate");
CREATE INDEX "TruckCatalog_plate_idx" ON "TruckCatalog"("plate");
CREATE INDEX "TruckCatalog_isActive_idx" ON "TruckCatalog"("isActive");
CREATE UNIQUE INDEX "TrailerCatalog_code_key" ON "TrailerCatalog"("code");
CREATE INDEX "TrailerCatalog_isActive_idx" ON "TrailerCatalog"("isActive");
CREATE INDEX "ZoneTemplate_truckCatalogId_idx" ON "ZoneTemplate"("truckCatalogId");
CREATE UNIQUE INDEX "ZoneTemplate_truckCatalogId_type_key" ON "ZoneTemplate"("truckCatalogId", "type");
CREATE UNIQUE INDEX "OperationDestinationAssignment_operationId_unloadingOrder_key" ON "OperationDestinationAssignment"("operationId", "unloadingOrder");
CREATE UNIQUE INDEX "OperationDestinationAssignment_operationId_destinationCatalogId_key" ON "OperationDestinationAssignment"("operationId", "destinationCatalogId");
CREATE INDEX "OperationDestinationAssignment_destinationCatalogId_idx" ON "OperationDestinationAssignment"("destinationCatalogId");
CREATE INDEX "OperationProductAssignment_operationId_operationDestinationId_idx" ON "OperationProductAssignment"("operationId", "operationDestinationId");
CREATE INDEX "OperationProductAssignment_operationId_productCatalogId_idx" ON "OperationProductAssignment"("operationId", "productCatalogId");
CREATE INDEX "OperationProductAssignment_productCatalogId_idx" ON "OperationProductAssignment"("productCatalogId");
CREATE UNIQUE INDEX "OperationVehicleAssignment_operationId_key" ON "OperationVehicleAssignment"("operationId");
CREATE INDEX "OperationVehicleAssignment_truckCatalogId_idx" ON "OperationVehicleAssignment"("truckCatalogId");
CREATE INDEX "OperationVehicleAssignment_trailerCatalogId_idx" ON "OperationVehicleAssignment"("trailerCatalogId");
CREATE UNIQUE INDEX "OperationTruckZone_vehicleAssignmentId_type_key" ON "OperationTruckZone"("vehicleAssignmentId", "type");
CREATE INDEX "OperationTruckZone_vehicleAssignmentId_idx" ON "OperationTruckZone"("vehicleAssignmentId");
CREATE INDEX "OperationTruckZone_zoneTemplateId_idx" ON "OperationTruckZone"("zoneTemplateId");
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");
CREATE INDEX "Customer_status_idx" ON "Customer"("status");
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_status_creditStatus_idx" ON "Order"("status", "creditStatus");
CREATE INDEX "Order_sellerPriority_idx" ON "Order"("sellerPriority");
CREATE INDEX "Order_requestedDeliveryAt_idx" ON "Order"("requestedDeliveryAt");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productCatalogId_idx" ON "OrderItem"("productCatalogId");
CREATE INDEX "OrderItem_productCode_idx" ON "OrderItem"("productCode");
CREATE UNIQUE INDEX "DeliveryPlan_code_key" ON "DeliveryPlan"("code");
CREATE INDEX "DeliveryPlan_status_idx" ON "DeliveryPlan"("status");
CREATE INDEX "DeliveryPlan_plannedDate_idx" ON "DeliveryPlan"("plannedDate");
CREATE UNIQUE INDEX "DispatchOrder_code_key" ON "DispatchOrder"("code");
CREATE UNIQUE INDEX "DispatchOrder_loadOperationId_key" ON "DispatchOrder"("loadOperationId");
CREATE INDEX "DispatchOrder_status_idx" ON "DispatchOrder"("status");
CREATE INDEX "DispatchOrder_orderId_idx" ON "DispatchOrder"("orderId");
CREATE INDEX "DispatchOrder_deliveryPlanId_idx" ON "DispatchOrder"("deliveryPlanId");
CREATE INDEX "DispatchOrder_destinationCatalogId_idx" ON "DispatchOrder"("destinationCatalogId");
CREATE INDEX "DispatchOrder_requestedDeliveryAt_idx" ON "DispatchOrder"("requestedDeliveryAt");
CREATE UNIQUE INDEX "DispatchOrderItem_dispatchOrderId_orderItemId_key" ON "DispatchOrderItem"("dispatchOrderId", "orderItemId");
CREATE INDEX "DispatchOrderItem_orderItemId_idx" ON "DispatchOrderItem"("orderItemId");
CREATE INDEX "DispatchOrderItem_productCatalogId_idx" ON "DispatchOrderItem"("productCatalogId");

-- AddForeignKey
ALTER TABLE "ZoneTemplate" ADD CONSTRAINT "ZoneTemplate_truckCatalogId_fkey" FOREIGN KEY ("truckCatalogId") REFERENCES "TruckCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationDestinationAssignment" ADD CONSTRAINT "OperationDestinationAssignment_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "LoadOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationDestinationAssignment" ADD CONSTRAINT "OperationDestinationAssignment_destinationCatalogId_fkey" FOREIGN KEY ("destinationCatalogId") REFERENCES "DestinationCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationProductAssignment" ADD CONSTRAINT "OperationProductAssignment_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "LoadOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationProductAssignment" ADD CONSTRAINT "OperationProductAssignment_productCatalogId_fkey" FOREIGN KEY ("productCatalogId") REFERENCES "ProductCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationProductAssignment" ADD CONSTRAINT "OperationProductAssignment_operationDestinationId_fkey" FOREIGN KEY ("operationDestinationId") REFERENCES "OperationDestinationAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationVehicleAssignment" ADD CONSTRAINT "OperationVehicleAssignment_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "LoadOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationVehicleAssignment" ADD CONSTRAINT "OperationVehicleAssignment_truckCatalogId_fkey" FOREIGN KEY ("truckCatalogId") REFERENCES "TruckCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationVehicleAssignment" ADD CONSTRAINT "OperationVehicleAssignment_trailerCatalogId_fkey" FOREIGN KEY ("trailerCatalogId") REFERENCES "TrailerCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationTruckZone" ADD CONSTRAINT "OperationTruckZone_vehicleAssignmentId_fkey" FOREIGN KEY ("vehicleAssignmentId") REFERENCES "OperationVehicleAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationTruckZone" ADD CONSTRAINT "OperationTruckZone_zoneTemplateId_fkey" FOREIGN KEY ("zoneTemplateId") REFERENCES "ZoneTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productCatalogId_fkey" FOREIGN KEY ("productCatalogId") REFERENCES "ProductCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_deliveryPlanId_fkey" FOREIGN KEY ("deliveryPlanId") REFERENCES "DeliveryPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_destinationCatalogId_fkey" FOREIGN KEY ("destinationCatalogId") REFERENCES "DestinationCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_loadOperationId_fkey" FOREIGN KEY ("loadOperationId") REFERENCES "LoadOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DispatchOrderItem" ADD CONSTRAINT "DispatchOrderItem_dispatchOrderId_fkey" FOREIGN KEY ("dispatchOrderId") REFERENCES "DispatchOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DispatchOrderItem" ADD CONSTRAINT "DispatchOrderItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DispatchOrderItem" ADD CONSTRAINT "DispatchOrderItem_productCatalogId_fkey" FOREIGN KEY ("productCatalogId") REFERENCES "ProductCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
