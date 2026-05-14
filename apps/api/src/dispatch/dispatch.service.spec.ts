import { BadRequestException } from '@nestjs/common';
import { AuditAction, DispatchOrderStatus, PreparationStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchService } from './dispatch.service';

const dispatchOrder = {
  id: 'dispatch-1',
  code: 'DSP-1',
  orderId: 'order-1',
  status: DispatchOrderStatus.PLANNED,
  items: [{ id: 'dispatch-item-1', productCatalog: { weightKg: null } }],
  preparations: [],
};

function createService() {
  const transactionClient = {
    loadOperation: { create: vi.fn() },
    destination: { create: vi.fn() },
    loadProduct: { createMany: vi.fn() },
    dispatchOrder: { update: vi.fn() },
  };
  const prisma = {
    dispatchOrder: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((callback) => callback(transactionClient)),
  };
  const audit = { record: vi.fn(), recordWithClient: vi.fn() };
  const service = new DispatchService(prisma as unknown as PrismaService, audit as unknown as AuditService);

  return { audit, prisma, service, transactionClient };
}

describe('DispatchService preparation readiness gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks dispatch readiness when warehouse preparation has not reached ready state', async () => {
    const { prisma, service } = createService();
    prisma.dispatchOrder.findUnique.mockResolvedValue({
      ...dispatchOrder,
      preparations: [{ id: 'preparation-1', status: PreparationStatus.DISCREPANCY, discrepancyQuantity: 1 }],
    });

    await expect(service.markReady(dispatchOrder.id)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.dispatchOrder.update).not.toHaveBeenCalled();
  });

  it('marks dispatch ready only after ready preparation without discrepancies', async () => {
    const { audit, prisma, service } = createService();
    prisma.dispatchOrder.findUnique.mockResolvedValue({
      ...dispatchOrder,
      preparations: [{ id: 'preparation-1', status: PreparationStatus.READY, discrepancyQuantity: 0 }],
    });
    prisma.dispatchOrder.update.mockResolvedValue({
      ...dispatchOrder,
      status: DispatchOrderStatus.READY_TO_LOAD,
      order: { id: 'order-1' },
      deliveryPlan: null,
      items: [{ id: 'dispatch-item-1', weightKg: null, productCatalog: { weightKg: null } }],
    });

    await expect(service.markReady(dispatchOrder.id, 'planner@example.com')).resolves.toMatchObject({ status: DispatchOrderStatus.READY_TO_LOAD });

    expect(prisma.dispatchOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: DispatchOrderStatus.READY_TO_LOAD } }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actor: 'planner@example.com', action: AuditAction.READY_TO_LOAD }));
  });

  it('blocks dispatch readiness when any preparation for the dispatch has discrepancies', async () => {
    const { prisma, service } = createService();
    prisma.dispatchOrder.findUnique.mockResolvedValue({
      ...dispatchOrder,
      preparations: [
        { id: 'preparation-1', status: PreparationStatus.READY, discrepancyQuantity: 0 },
        { id: 'preparation-2', status: PreparationStatus.DISCREPANCY, discrepancyQuantity: 1 },
      ],
    });

    await expect(service.markReady(dispatchOrder.id)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.dispatchOrder.update).not.toHaveBeenCalled();
  });

  it('blocks load operation creation when any preparation for the dispatch has discrepancies', async () => {
    const { prisma, service } = createService();
    prisma.dispatchOrder.findUnique.mockResolvedValue({
      ...dispatchOrder,
      status: DispatchOrderStatus.READY_TO_LOAD,
      loadOperationId: null,
      loadOperation: null,
      preparations: [
        { id: 'preparation-1', status: PreparationStatus.READY, discrepancyQuantity: 0 },
        { id: 'preparation-2', status: PreparationStatus.DISCREPANCY, discrepancyQuantity: 1 },
      ],
    });

    await expect(service.createLoadOperation(dispatchOrder.id)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a load operation when every preparation is ready and discrepancy-free', async () => {
    const { audit, prisma, service, transactionClient } = createService();
    const createdAt = new Date('2026-05-14T12:00:00.000Z');
    const loadOperation = {
      id: 'operation-1',
      code: 'OP-1',
      status: 'DRAFT',
      name: 'Carga DSP-1',
      notes: null,
      scheduledAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    prisma.dispatchOrder.findUnique.mockResolvedValue({
      ...dispatchOrder,
      status: DispatchOrderStatus.READY_TO_LOAD,
      loadOperationId: null,
      loadOperation: null,
      order: { code: 'PED-1', customer: { name: 'Cliente SA' } },
      deliveryPlan: null,
      destinationCatalog: { code: 'DST', name: 'Destino', address: null, notes: null },
      destinationNameSnapshot: 'Destino',
      requestedDeliveryAt: null,
      notes: null,
      preparations: [
        { id: 'preparation-1', status: PreparationStatus.READY, discrepancyQuantity: 0 },
        { id: 'preparation-2', status: PreparationStatus.READY, discrepancyQuantity: 0 },
      ],
      items: [
        {
          id: 'dispatch-item-1',
          productCodeSnapshot: 'SKU-1',
          descriptionSnapshot: 'Steel beam',
          quantity: 2,
          weightKg: 100,
          lengthMm: 1000,
          widthMm: 100,
          heightMm: 50,
          productCatalog: {
            family: 'steel',
            description: 'Catalog steel beam',
            weightKg: 120,
            lengthMm: 1100,
            widthMm: 120,
            heightMm: 60,
            stackable: true,
            rotationAllowed: true,
          },
        },
      ],
    });
    transactionClient.loadOperation.create.mockResolvedValue(loadOperation);
    transactionClient.destination.create.mockResolvedValue({ id: 'destination-1' });

    await expect(service.createLoadOperation(dispatchOrder.id, 'planner@example.com')).resolves.toEqual(loadOperation);

    expect(transactionClient.loadProduct.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ operationId: loadOperation.id })] }));
    expect(transactionClient.dispatchOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ loadOperationId: loadOperation.id }) }));
    expect(audit.recordWithClient).toHaveBeenCalledWith(transactionClient, expect.objectContaining({ actor: 'planner@example.com', action: AuditAction.LOAD_OPERATION_CREATED }));
  });
});
