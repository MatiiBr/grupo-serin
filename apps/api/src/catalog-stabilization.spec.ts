import { ConflictException } from '@nestjs/common';
import { LoadingMethod, Prisma, ProductFamily, TruckZoneType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationsService } from './destinations/destinations.service';
import { PrismaService } from './prisma/prisma.service';
import { ProductsService } from './products/products.service';
import { TrucksService } from './trucks/trucks.service';

function prismaKnownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma constraint error', { code, clientVersion: 'test' });
}

describe('catalog stabilization semantics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps product catalog reusable and creates operation product assignments as loading snapshots', async () => {
    const prisma = {
      loadOperation: { findUnique: vi.fn().mockResolvedValue({ id: 'operation-1' }) },
      productCatalog: { findUnique: vi.fn().mockResolvedValue({ id: 'product-catalog-1' }) },
      operationDestinationAssignment: { findUnique: vi.fn().mockResolvedValue({ operationId: 'operation-1' }) },
      operationProductAssignment: {
        create: vi.fn().mockResolvedValue({
          id: 'assignment-1',
          operationId: 'operation-1',
          productCatalogId: 'product-catalog-1',
          operationDestinationId: 'destination-assignment-1',
          quantity: 2,
          weightKgOverride: null,
          lengthMmOverride: null,
          widthMmOverride: null,
          heightMmOverride: null,
          stackableOverride: null,
          rotationAllowedOverride: null,
          notes: null,
          catalog: {
            id: 'product-catalog-1',
            code: 'SKU-1',
            family: ProductFamily.SHEET,
            weightKg: new Prisma.Decimal(1200),
          },
          operationDestination: { id: 'destination-assignment-1', catalog: { id: 'destination-catalog-1', name: 'Rosario' } },
        }),
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    const result = await service.create('operation-1', {
      productCatalogId: 'product-catalog-1',
      operationDestinationId: 'destination-assignment-1',
      quantity: 2,
    });

    expect(prisma.operationProductAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operationId: 'operation-1',
          productCatalogId: 'product-catalog-1',
          operationDestinationId: 'destination-assignment-1',
          quantity: 2,
        }),
      }),
    );
    expect(result.catalog.weightKg).toBe(1200);
  });

  it('keeps destination catalog reusable and assigns destinations through operation references', async () => {
    const assignment = {
      id: 'destination-assignment-1',
      operationId: 'operation-1',
      destinationCatalogId: 'destination-catalog-1',
      unloadingOrder: 1,
      catalog: { id: 'destination-catalog-1', name: 'Rosario', code: 'ROS' },
    };
    const prisma = {
      loadOperation: { findUnique: vi.fn().mockResolvedValue({ id: 'operation-1' }) },
      destinationCatalog: { findUnique: vi.fn().mockResolvedValue({ id: 'destination-catalog-1' }) },
      operationDestinationAssignment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(assignment),
      },
    };
    const service = new DestinationsService(prisma as unknown as PrismaService);

    await expect(service.create('operation-1', { destinationCatalogId: 'destination-catalog-1', unloadingOrder: 1 })).resolves.toBe(assignment);

    expect(prisma.operationDestinationAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { operationId: 'operation-1', destinationCatalogId: 'destination-catalog-1', unloadingOrder: 1 },
        include: { catalog: true },
      }),
    );
  });

  it('copies truck zone templates into operation vehicle assignment snapshots without mutating catalog records', async () => {
    const operationVehicleAssignment = { id: 'vehicle-assignment-1', operationId: 'operation-1' };
    const templates = [
      { id: 'zone-template-1', type: TruckZoneType.CABIN_SIDE, name: 'Cabin', maxWeightKg: new Prisma.Decimal(5000), startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 2400 },
      { id: 'zone-template-2', type: TruckZoneType.CENTER, name: 'Center', maxWeightKg: new Prisma.Decimal(15000), startXMm: 1000, endXMm: 9000, startYMm: 0, endYMm: 2400 },
      { id: 'zone-template-3', type: TruckZoneType.DOOR_SIDE, name: 'Door', maxWeightKg: new Prisma.Decimal(5000), startXMm: 9000, endXMm: 10000, startYMm: 0, endYMm: 2400 },
    ];
    const transactionClient = {
      operationVehicleAssignment: {
        upsert: vi.fn().mockResolvedValue(operationVehicleAssignment),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...operationVehicleAssignment,
          truckCatalogId: 'truck-catalog-1',
          trailerCatalogId: null,
          notes: null,
          truck: { id: 'truck-catalog-1', plate: 'ABC123', loadingMethod: LoadingMethod.REAR, maxPayloadKg: new Prisma.Decimal(28000) },
          trailer: null,
          zones: templates.map((template) => ({ ...template, zoneTemplateId: template.id, vehicleAssignmentId: operationVehicleAssignment.id })),
        }),
      },
      zoneTemplate: { findMany: vi.fn().mockResolvedValue(templates) },
      operationTruckZone: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      loadOperation: { findUnique: vi.fn().mockResolvedValue({ id: 'operation-1' }) },
      truckCatalog: { findUnique: vi.fn().mockResolvedValue({ id: 'truck-catalog-1' }) },
      $transaction: vi.fn((callback) => callback(transactionClient)),
    };
    const service = new TrucksService(prisma as unknown as PrismaService);

    const result = await service.upsertForOperation('operation-1', { truckCatalogId: 'truck-catalog-1' });

    expect(transactionClient.operationVehicleAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { operationId: 'operation-1', truckCatalogId: 'truck-catalog-1' } }),
    );
    expect(transactionClient.operationTruckZone.upsert).toHaveBeenCalledTimes(3);
    expect(transactionClient.operationTruckZone.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          vehicleAssignmentId: 'vehicle-assignment-1',
          zoneTemplateId: 'zone-template-1',
          name: 'Cabin',
        }),
        update: {},
      }),
    );
    expect(result.truck.maxPayloadKg).toBe(28000);
  });

  it('blocks hard deletion of catalog records once operational assignments reference them', async () => {
    const prisma = {
      productCatalog: {
        findUnique: vi.fn().mockResolvedValue({ id: 'product-catalog-1' }),
        delete: vi.fn().mockRejectedValue(prismaKnownError('P2003')),
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.removeCatalog('product-catalog-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
