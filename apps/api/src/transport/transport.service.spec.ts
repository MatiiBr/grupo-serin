import { BadRequestException } from '@nestjs/common';
import { AuditAction, DispatchOrderStatus, OperationStatus, PlanStatus, TransportExitStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransportService } from './transport.service';

const exitGate = {
  id: 'exit-1',
  dispatchOrderId: 'dispatch-1',
  status: TransportExitStatus.PENDING,
  externalRef: null,
  docsReadyAt: null,
  scaleWeightKg: null,
  scaledAt: null,
  authorizedAt: null,
  dispatchedAt: null,
  blockedReason: null,
  notes: null,
  createdAt: new Date('2026-05-14T21:00:00.000Z'),
  updatedAt: new Date('2026-05-14T21:00:00.000Z'),
};

function createService() {
  const prisma = {
    dispatchOrder: { findUnique: vi.fn() },
    transportExit: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  };
  const audit = { record: vi.fn() };
  const service = new TransportService(prisma as unknown as PrismaService, audit as unknown as AuditService);

  return { audit, prisma, service };
}

describe('TransportService exit gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a dispatch order linked to a load operation before creating an exit gate', async () => {
    const { prisma, service } = createService();
    prisma.dispatchOrder.findUnique.mockResolvedValue({ id: 'dispatch-1', status: DispatchOrderStatus.READY_TO_LOAD, loadOperationId: null });

    await expect(service.createExit({ dispatchOrderId: 'dispatch-1' })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.transportExit.create).not.toHaveBeenCalled();
  });

  it('creates an exit gate for a dispatch order linked to loading execution', async () => {
    const { audit, prisma, service } = createService();
    prisma.dispatchOrder.findUnique.mockResolvedValue({ id: 'dispatch-1', status: DispatchOrderStatus.LOAD_OPERATION_LINKED, loadOperationId: 'operation-1' });
    prisma.transportExit.create.mockResolvedValue({ ...exitGate, dispatchOrder: { id: 'dispatch-1' } });

    await expect(service.createExit({ dispatchOrderId: 'dispatch-1' }, 'gate@example.com')).resolves.toMatchObject({ status: TransportExitStatus.PENDING });

    expect(prisma.transportExit.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dispatchOrderId: 'dispatch-1' }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actor: 'gate@example.com', action: AuditAction.CREATED }));
  });

  it('blocks scale capture until transport documents are ready', async () => {
    const { prisma, service } = createService();
    prisma.transportExit.findUnique.mockResolvedValue(exitGate);

    await expect(service.recordScale(exitGate.id, { scaleWeightKg: 28000 })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.transportExit.update).not.toHaveBeenCalled();
  });

  it('blocks exit authorization until loading plan is approved', async () => {
    const { prisma, service } = createService();
    prisma.transportExit.findUnique.mockResolvedValue({
      ...exitGate,
      status: TransportExitStatus.SCALED,
      docsReadyAt: new Date('2026-05-14T21:05:00.000Z'),
      scaledAt: new Date('2026-05-14T21:10:00.000Z'),
      dispatchOrder: {
        loadOperation: {
          status: OperationStatus.PLAN_GENERATED,
          plans: [{ status: PlanStatus.GENERATED }],
        },
      },
    });

    await expect(service.authorizeExit(exitGate.id)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.transportExit.update).not.toHaveBeenCalled();
  });

  it('authorizes exit only after documents, scale, and approved loading plan are present', async () => {
    const { audit, prisma, service } = createService();
    const readyGate = {
      ...exitGate,
      status: TransportExitStatus.SCALED,
      docsReadyAt: new Date('2026-05-14T21:05:00.000Z'),
      scaledAt: new Date('2026-05-14T21:10:00.000Z'),
      dispatchOrder: {
        loadOperation: {
          status: OperationStatus.APPROVED,
          plans: [{ status: PlanStatus.APPROVED }],
        },
      },
    };
    prisma.transportExit.findUnique.mockResolvedValue(readyGate);
    prisma.transportExit.update.mockResolvedValue({ ...readyGate, status: TransportExitStatus.AUTHORIZED_EXIT, authorizedAt: new Date('2026-05-14T21:15:00.000Z'), dispatchOrder: { id: 'dispatch-1' } });

    await expect(service.authorizeExit(exitGate.id, 'gate@example.com')).resolves.toMatchObject({ status: TransportExitStatus.AUTHORIZED_EXIT });

    expect(prisma.transportExit.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: TransportExitStatus.AUTHORIZED_EXIT }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actor: 'gate@example.com', action: AuditAction.STATUS_CHANGED }));
  });

  it('blocks final dispatch until exit is authorized', async () => {
    const { prisma, service } = createService();
    prisma.transportExit.findUnique.mockResolvedValue({ ...exitGate, status: TransportExitStatus.SCALED });

    await expect(service.markDispatched(exitGate.id)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.transportExit.update).not.toHaveBeenCalled();
  });

  it('records final dispatch after exit authorization', async () => {
    const { audit, prisma, service } = createService();
    const dispatchedAt = new Date('2026-05-14T21:20:00.000Z');
    const authorizedGate = { ...exitGate, status: TransportExitStatus.AUTHORIZED_EXIT, authorizedAt: new Date('2026-05-14T21:15:00.000Z') };
    prisma.transportExit.findUnique.mockResolvedValue(authorizedGate);
    prisma.transportExit.update.mockResolvedValue({ ...authorizedGate, status: TransportExitStatus.DISPATCHED, dispatchedAt, dispatchOrder: { id: 'dispatch-1' } });

    await expect(service.markDispatched(exitGate.id, 'gate@example.com')).resolves.toMatchObject({ status: TransportExitStatus.DISPATCHED, dispatchedAt });

    expect(prisma.transportExit.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: TransportExitStatus.DISPATCHED }) }));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'gate@example.com',
        action: AuditAction.STATUS_CHANGED,
        entityType: 'TransportExit',
        entityId: exitGate.id,
        relatedEntityId: 'dispatch-1',
        after: expect.objectContaining({ status: TransportExitStatus.DISPATCHED, dispatchedAt: dispatchedAt.toISOString() }),
      }),
    );
  });
});
