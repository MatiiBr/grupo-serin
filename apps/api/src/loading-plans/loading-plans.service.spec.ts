import { BadRequestException } from '@nestjs/common';
import { AlertSeverity, AlertType, AuditAction, AuditSource, LoadingMethod, OperationStatus, PlanStatus, ProductFamily, TruckZoneType, UnplacedReason } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LoadingPlansService } from './loading-plans.service';

describe('LoadingPlansService manual unplaced placement', () => {
  it('creates a placed item from an unplaced item, removes it from unplaced, and recalculates metrics', async () => {
    const tx = transactionClient();
    const prisma = prismaClient(tx, planWithUnplaced());
    const audit = { recordWithClient: vi.fn().mockResolvedValue(undefined) };
    const service = new LoadingPlansService(prisma as never, audit as never);
    vi.spyOn(service as unknown as { loadTruckLoadingLayerRows: () => Promise<unknown[]> }, 'loadTruckLoadingLayerRows').mockResolvedValue([]);
    vi.spyOn(service as unknown as { loadTruckAxleGroups: () => Promise<unknown[]> }, 'loadTruckAxleGroups').mockResolvedValue([]);
    vi.spyOn(service as unknown as { loadPlanDomain: () => Promise<unknown> }, 'loadPlanDomain').mockResolvedValue({ loadingLayers: [], axleLoadSnapshots: [], placedItemLayers: [] });

    await service.placeUnplacedItem('plan-1', 'unplaced-1', { xMm: 1000, yMm: 250, zMm: 0, rotationDeg: 90, locked: true }, 'tester');

    expect(tx.placedItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        planId: 'plan-1',
        productId: 'product-1',
        unitIndex: 1,
        xMm: 1000,
        yMm: 250,
        zMm: 0,
        rotationDeg: 90,
        lengthMm: 500,
        widthMm: 2000,
        heightMm: 120,
        locked: true,
        manuallyAdjusted: true,
      }),
    }));
    expect(tx.unplacedItem.delete).toHaveBeenCalledWith({ where: { id: 'unplaced-1' } });
    expect(tx.planMetrics.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ placedItemCount: 1, unplacedItemCount: 0 }),
    }));
    expect(tx.loadingPlan.update).toHaveBeenCalledWith({ where: { id: 'plan-1' }, data: { status: PlanStatus.MODIFIED } });
    expect(audit.recordWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({
      actor: 'tester',
      source: AuditSource.API,
      action: AuditAction.MANUAL_ADJUSTED,
      entityType: 'UnplacedItem',
      entityId: 'unplaced-1',
      relatedEntityType: 'LoadingPlan',
      relatedEntityId: 'plan-1',
    }));
  });

  it('rejects manual placement when the plan is already approved', async () => {
    const service = new LoadingPlansService(prismaClient(transactionClient(), { ...planWithUnplaced(), status: PlanStatus.APPROVED }) as never, { recordWithClient: vi.fn() } as never);

    await expect(service.placeUnplacedItem('plan-1', 'unplaced-1', { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 })).rejects.toBeInstanceOf(BadRequestException);
  });
});

function transactionClient() {
  return {
    placedItem: { create: vi.fn().mockResolvedValue({ id: 'placed-1' }) },
    unplacedItem: { delete: vi.fn().mockResolvedValue({}) },
    loadAlert: { deleteMany: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({}) },
    planMetrics: { upsert: vi.fn().mockResolvedValue({}) },
    loadingPlan: {
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn().mockResolvedValue(planWithUnplaced({ unplaced: [] })),
    },
    $executeRaw: vi.fn().mockResolvedValue(undefined),
  };
}

function prismaClient(tx: ReturnType<typeof transactionClient>, plan: ReturnType<typeof planWithUnplaced>) {
  return {
    loadingPlan: { findUnique: vi.fn().mockResolvedValue(plan) },
    $transaction: vi.fn(async (callback) => callback(tx)),
  };
}

function planWithUnplaced(overrides: Partial<ReturnType<typeof basePlan>> = {}) {
  return { ...basePlan(), ...overrides };
}

function basePlan() {
  const product = {
    id: 'product-1',
    code: 'CH-100',
    description: 'Chapa galvanizada',
    family: ProductFamily.SHEET,
    destinationId: null,
    destination: null,
    quantity: 1,
    weightKg: 1000,
    lengthMm: 2000,
    widthMm: 500,
    heightMm: 120,
    stackable: true,
    rotationAllowed: true,
  };
  return {
    id: 'plan-1',
    operationId: 'operation-1',
    version: 1,
    status: PlanStatus.GENERATED as PlanStatus,
    method: LoadingMethod.REAR,
    isCurrent: true,
    notes: null,
    approvedAt: null,
    createdAt: new Date('2026-05-18T00:00:00.000Z'),
    updatedAt: new Date('2026-05-18T00:00:00.000Z'),
    operation: {
      id: 'operation-1',
      code: 'OP-1',
      status: OperationStatus.PLAN_GENERATED,
      truck: {
        id: 'truck-1',
        lengthMm: 12000,
        widthMm: 2400,
        heightMm: 2600,
        maxPayloadKg: 24000,
        zones: [{ id: 'zone-1', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 4000, startYMm: 0, endYMm: 2400, maxWeightKg: null }],
      },
    },
    placedItems: [],
    unplaced: [{ id: 'unplaced-1', planId: 'plan-1', productId: 'product-1', unitIndex: 1, reason: UnplacedReason.NO_AVAILABLE_SPACE, message: 'No floor space available.', product }],
    alerts: [{ id: 'alert-1', planId: 'plan-1', productId: 'product-1', placedItemId: null, severity: AlertSeverity.CRITICAL, type: AlertType.UNPLACED_ITEM, message: 'No floor space available.', createdAt: new Date('2026-05-18T00:00:00.000Z') }],
    steps: [],
    metrics: null,
  };
}
