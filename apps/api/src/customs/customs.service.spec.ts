import { NotFoundException } from '@nestjs/common';
import { AuditAction, AuditSource, CustomsReleaseStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomsController } from './customs.controller';
import { CustomsService } from './customs.service';

const dispatchOrder = { id: 'dispatch-1', code: 'DSP-1' };
const pendingRelease = {
  id: 'customs-1',
  dispatchOrderId: dispatchOrder.id,
  status: CustomsReleaseStatus.PENDING,
  externalRef: 'ADU-1',
  blockedReason: null,
  notes: null,
  clearedAt: null,
};

function createService() {
  const prisma = {
    dispatchOrder: { findUnique: vi.fn() },
    customsRelease: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  };
  const audit = { record: vi.fn() };
  const service = new CustomsService(prisma as unknown as PrismaService, audit as unknown as AuditService);

  return { audit, prisma, service };
}

describe('CustomsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers a pending customs release gate for a dispatch order and audits it', async () => {
    const { audit, prisma, service } = createService();
    prisma.dispatchOrder.findUnique.mockResolvedValue(dispatchOrder);
    prisma.customsRelease.create.mockResolvedValue(pendingRelease);

    await expect(service.createRelease({ dispatchOrderId: dispatchOrder.id, externalRef: 'ADU-1' }, 'customs@example.com')).resolves.toBe(pendingRelease);

    expect(prisma.customsRelease.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { dispatchOrderId: dispatchOrder.id, externalRef: 'ADU-1', notes: undefined },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'customs@example.com',
        source: AuditSource.API,
        action: AuditAction.STATUS_CHANGED,
        entityType: 'CustomsRelease',
        relatedEntityType: 'DispatchOrder',
        relatedEntityId: dispatchOrder.id,
        after: { status: CustomsReleaseStatus.PENDING, externalRef: 'ADU-1' },
      }),
    );
  });

  it('rejects customs release registration for unknown dispatch orders', async () => {
    const { prisma, service } = createService();
    prisma.dispatchOrder.findUnique.mockResolvedValue(null);

    await expect(service.createRelease({ dispatchOrderId: dispatchOrder.id })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('clears a customs release and preserves the external reference when not replaced', async () => {
    const { audit, prisma, service } = createService();
    const clearedAt = new Date('2026-05-14T20:00:00.000Z');
    prisma.customsRelease.findUnique.mockResolvedValue(pendingRelease);
    prisma.customsRelease.update.mockResolvedValue({ ...pendingRelease, status: CustomsReleaseStatus.CLEARED, clearedAt });

    await expect(service.clearRelease(pendingRelease.id, { notes: 'Liberado' }, 'customs@example.com')).resolves.toMatchObject({ status: CustomsReleaseStatus.CLEARED });

    expect(prisma.customsRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: CustomsReleaseStatus.CLEARED, externalRef: 'ADU-1', blockedReason: null, notes: 'Liberado' }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actor: 'customs@example.com', after: expect.objectContaining({ status: CustomsReleaseStatus.CLEARED }) }));
  });

  it('blocks a customs release with visible reason for pending dispatch follow-up', async () => {
    const { prisma, service } = createService();
    prisma.customsRelease.findUnique.mockResolvedValue(pendingRelease);
    prisma.customsRelease.update.mockResolvedValue({ ...pendingRelease, status: CustomsReleaseStatus.BLOCKED, blockedReason: 'Documentación incompleta' });

    await expect(service.blockRelease(pendingRelease.id, { blockedReason: 'Documentación incompleta' })).resolves.toMatchObject({ status: CustomsReleaseStatus.BLOCKED });

    expect(prisma.customsRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: CustomsReleaseStatus.BLOCKED, blockedReason: 'Documentación incompleta', clearedAt: null }) }),
    );
  });

  it('lists pending and blocked checkpoints explicitly', async () => {
    const { prisma, service } = createService();
    prisma.customsRelease.findMany.mockResolvedValue([pendingRelease]);

    await expect(service.findPendingReleases()).resolves.toHaveLength(1);

    expect(prisma.customsRelease.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: { in: [CustomsReleaseStatus.PENDING, CustomsReleaseStatus.BLOCKED] } } }));
  });
});

describe('CustomsController', () => {
  it('passes API actor headers through customs release creation and clearance', async () => {
    const service = {
      createRelease: vi.fn().mockResolvedValue(pendingRelease),
      clearRelease: vi.fn().mockResolvedValue({ ...pendingRelease, status: CustomsReleaseStatus.CLEARED }),
    };
    const controller = new CustomsController(service as unknown as CustomsService);
    const dto = { dispatchOrderId: dispatchOrder.id };

    await expect(controller.createRelease(dto, 'customs@example.com')).resolves.toBe(pendingRelease);
    await expect(controller.clearRelease(pendingRelease.id, {}, 'customs@example.com')).resolves.toMatchObject({ status: CustomsReleaseStatus.CLEARED });

    expect(service.createRelease).toHaveBeenCalledWith(dto, 'customs@example.com');
    expect(service.clearRelease).toHaveBeenCalledWith(pendingRelease.id, {}, 'customs@example.com');
  });
});
