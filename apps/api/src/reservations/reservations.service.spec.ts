import { BadRequestException } from '@nestjs/common';
import { AuditAction, AuditSource, ReservationStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

const dispatchOrder = {
  id: 'dispatch-1',
  items: [
    {
      id: 'dispatch-item-1',
      productCatalogId: 'product-1',
      productCodeSnapshot: 'SKU-1',
      quantity: 10,
      createdAt: new Date('2026-05-14T10:00:00.000Z'),
    },
    {
      id: 'dispatch-item-2',
      productCatalogId: 'product-2',
      productCodeSnapshot: 'SKU-2',
      quantity: 5,
      createdAt: new Date('2026-05-14T10:01:00.000Z'),
    },
  ],
};

const savedReservation = {
  id: 'reservation-1',
  dispatchOrderId: dispatchOrder.id,
  status: ReservationStatus.PARTIAL,
  requestedQuantity: 15,
  reservedQuantity: 11,
  unreservedQuantity: 4,
  releasedAt: null,
};

function createService() {
  const prisma = {
    dispatchOrder: { findUnique: vi.fn() },
    reservation: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  };
  const audit = { record: vi.fn() };
  const service = new ReservationsService(prisma as unknown as PrismaService, audit as unknown as AuditService);

  return { audit, prisma, service };
}

describe('ReservationsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a reservation from dispatch items, persists partial quantities, and audits the side effect', async () => {
    const { audit, prisma, service } = createService();
    prisma.dispatchOrder.findUnique.mockResolvedValue(dispatchOrder);
    prisma.reservation.create.mockResolvedValue(savedReservation);

    await expect(
      service.createReservation(
        {
          dispatchOrderId: dispatchOrder.id,
          availability: [
            { dispatchOrderItemId: 'dispatch-item-1', availableQuantity: 6 },
            { dispatchOrderItemId: 'dispatch-item-2', availableQuantity: 5 },
          ],
          externalRef: 'INV-RES-123',
          notes: 'Stock externo parcial',
        },
        'planner@example.com',
      ),
    ).resolves.toBe(savedReservation);

    expect(prisma.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dispatchOrderId: dispatchOrder.id,
          status: ReservationStatus.PARTIAL,
          requestedQuantity: 15,
          reservedQuantity: 11,
          unreservedQuantity: 4,
          items: {
            create: [
              expect.objectContaining({ dispatchOrderItemId: 'dispatch-item-1', requestedQuantity: 10, availableQuantity: 6, reservedQuantity: 6, unreservedQuantity: 4 }),
              expect.objectContaining({ dispatchOrderItemId: 'dispatch-item-2', requestedQuantity: 5, availableQuantity: 5, reservedQuantity: 5, unreservedQuantity: 0 }),
            ],
          },
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'planner@example.com',
        source: AuditSource.API,
        action: AuditAction.CREATED,
        entityType: 'Reservation',
        entityId: savedReservation.id,
        relatedEntityType: 'DispatchOrder',
        relatedEntityId: dispatchOrder.id,
        after: { status: ReservationStatus.PARTIAL, requestedQuantity: 15, reservedQuantity: 11, unreservedQuantity: 4 },
      }),
    );
  });

  it('rejects availability for items outside the dispatch order', async () => {
    const { prisma, service } = createService();
    prisma.dispatchOrder.findUnique.mockResolvedValue(dispatchOrder);

    await expect(
      service.createReservation({ dispatchOrderId: dispatchOrder.id, availability: [{ dispatchOrderItemId: 'other-item', availableQuantity: 3 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.reservation.create).not.toHaveBeenCalled();
  });

  it('lists only partial reservations for reprocess visibility', async () => {
    const { prisma, service } = createService();
    prisma.reservation.findMany.mockResolvedValue([savedReservation]);

    await expect(service.findReprocessReservations()).resolves.toEqual([savedReservation]);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: ReservationStatus.PARTIAL }, orderBy: { createdAt: 'asc' } }),
    );
  });

  it('releases a reservation and records before/after audit context', async () => {
    const { audit, prisma, service } = createService();
    const before = { ...savedReservation, releasedAt: null };
    const after = { ...savedReservation, status: ReservationStatus.RELEASED, releasedAt: new Date('2026-05-14T12:00:00.000Z') };
    prisma.reservation.findUnique.mockResolvedValue(before);
    prisma.reservation.update.mockResolvedValue(after);

    await expect(service.release(savedReservation.id, 'warehouse@example.com')).resolves.toBe(after);

    expect(prisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: savedReservation.id }, data: expect.objectContaining({ status: ReservationStatus.RELEASED }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'warehouse@example.com',
        action: AuditAction.STATUS_CHANGED,
        before: { status: ReservationStatus.PARTIAL, releasedAt: null },
        after: { status: ReservationStatus.RELEASED, releasedAt: '2026-05-14T12:00:00.000Z' },
      }),
    );
  });
});

describe('ReservationsController', () => {
  it('passes API actor headers through release endpoint behavior', async () => {
    const service = { release: vi.fn().mockResolvedValue(savedReservation) };
    const controller = new ReservationsController(service as unknown as ReservationsService);

    await expect(controller.release(savedReservation.id, 'api-user@example.com')).resolves.toBe(savedReservation);

    expect(service.release).toHaveBeenCalledWith(savedReservation.id, 'api-user@example.com');
  });
});
