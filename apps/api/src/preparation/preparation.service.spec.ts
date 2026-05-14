import { BadRequestException } from '@nestjs/common';
import { AuditAction, AuditSource, PreparationStatus, ReservationStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PreparationController } from './preparation.controller';
import { PreparationService } from './preparation.service';

const reservation = {
  id: 'reservation-1',
  dispatchOrderId: 'dispatch-1',
  status: ReservationStatus.RESERVED,
  requestedQuantity: 10,
  reservedQuantity: 10,
  unreservedQuantity: 0,
  dispatchOrder: { id: 'dispatch-1', code: 'DSP-1' },
  items: [
    { id: 'reservation-item-1', productCodeSnapshot: 'SKU-1', reservedQuantity: 6, createdAt: new Date('2026-05-14T10:00:00.000Z') },
    { id: 'reservation-item-2', productCodeSnapshot: 'SKU-2', reservedQuantity: 4, createdAt: new Date('2026-05-14T10:01:00.000Z') },
  ],
};

const readyPreparation = {
  id: 'preparation-1',
  reservationId: reservation.id,
  dispatchOrderId: reservation.dispatchOrderId,
  status: PreparationStatus.READY,
  requestedQuantity: 10,
  reservedQuantity: 10,
  readyQuantity: 10,
  discrepancyQuantity: 0,
};

function createService() {
  const prisma = {
    reservation: { findUnique: vi.fn() },
    preparation: { create: vi.fn(), findMany: vi.fn() },
  };
  const audit = { record: vi.fn() };
  const service = new PreparationService(prisma as unknown as PrismaService, audit as unknown as AuditService);

  return { audit, prisma, service };
}

describe('PreparationService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates ready preparation from fully reserved demand and audits readiness', async () => {
    const { audit, prisma, service } = createService();
    prisma.reservation.findUnique.mockResolvedValue(reservation);
    prisma.preparation.create.mockResolvedValue(readyPreparation);

    await expect(
      service.createPreparation(
        {
          reservationId: reservation.id,
          items: [
            { reservationItemId: 'reservation-item-1', readyQuantity: 6 },
            { reservationItemId: 'reservation-item-2', readyQuantity: 4 },
          ],
          notes: 'Preparado completo',
        },
        'warehouse@example.com',
      ),
    ).resolves.toBe(readyPreparation);

    expect(prisma.preparation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reservationId: reservation.id,
          dispatchOrderId: reservation.dispatchOrderId,
          status: PreparationStatus.READY,
          requestedQuantity: 10,
          reservedQuantity: 10,
          readyQuantity: 10,
          discrepancyQuantity: 0,
          items: {
            create: [
              expect.objectContaining({ reservationItemId: 'reservation-item-1', reservedQuantity: 6, readyQuantity: 6, discrepancyQuantity: 0 }),
              expect.objectContaining({ reservationItemId: 'reservation-item-2', reservedQuantity: 4, readyQuantity: 4, discrepancyQuantity: 0 }),
            ],
          },
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'warehouse@example.com',
        source: AuditSource.API,
        action: AuditAction.READY_TO_LOAD,
        entityType: 'Preparation',
        relatedEntityType: 'Reservation',
        relatedEntityId: reservation.id,
        after: { status: PreparationStatus.READY, reservedQuantity: 10, readyQuantity: 10, discrepancyQuantity: 0 },
      }),
    );
  });

  it('captures discrepancies and keeps them visible for blocked loading readiness', async () => {
    const { prisma, service } = createService();
    prisma.reservation.findUnique.mockResolvedValue(reservation);
    prisma.preparation.create.mockResolvedValue({ ...readyPreparation, status: PreparationStatus.DISCREPANCY, readyQuantity: 8, discrepancyQuantity: 2 });

    await service.createPreparation({ reservationId: reservation.id, items: [{ reservationItemId: 'reservation-item-1', readyQuantity: 4, discrepancyReason: 'Faltante físico' }] });

    expect(prisma.preparation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PreparationStatus.DISCREPANCY,
          readyQuantity: 4,
          discrepancyQuantity: 6,
          items: {
            create: [
              expect.objectContaining({ reservationItemId: 'reservation-item-1', readyQuantity: 4, discrepancyQuantity: 2, discrepancyReason: 'Faltante físico' }),
              expect.objectContaining({ reservationItemId: 'reservation-item-2', readyQuantity: 0, discrepancyQuantity: 4 }),
            ],
          },
        }),
      }),
    );
  });

  it('rejects partial reservations before warehouse preparation', async () => {
    const { prisma, service } = createService();
    prisma.reservation.findUnique.mockResolvedValue({ ...reservation, status: ReservationStatus.PARTIAL, unreservedQuantity: 2 });

    await expect(service.createPreparation({ reservationId: reservation.id, items: [{ reservationItemId: 'reservation-item-1', readyQuantity: 6 }] })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.preparation.create).not.toHaveBeenCalled();
  });

  it('lists discrepancy preparations explicitly', async () => {
    const { prisma, service } = createService();
    prisma.preparation.findMany.mockResolvedValue([{ ...readyPreparation, status: PreparationStatus.DISCREPANCY }]);

    await expect(service.findDiscrepancies()).resolves.toHaveLength(1);

    expect(prisma.preparation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: PreparationStatus.DISCREPANCY }, orderBy: { createdAt: 'asc' } }));
  });
});

describe('PreparationController', () => {
  it('passes API actor headers through preparation creation', async () => {
    const service = { createPreparation: vi.fn().mockResolvedValue(readyPreparation) };
    const controller = new PreparationController(service as unknown as PreparationService);
    const dto = { reservationId: reservation.id, items: [{ reservationItemId: 'reservation-item-1', readyQuantity: 6 }] };

    await expect(controller.createPreparation(dto, 'api-user@example.com')).resolves.toBe(readyPreparation);

    expect(service.createPreparation).toHaveBeenCalledWith(dto, 'api-user@example.com');
  });
});
