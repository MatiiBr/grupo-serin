import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditSource, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { calculateReservationLine, releaseReservation, resolveReservationStatus } from '../domain/reservations/reservation-lifecycle';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createReservation(dto: CreateReservationDto, actor?: string) {
    const dispatchOrder = await this.prisma.dispatchOrder.findUnique({
      where: { id: dto.dispatchOrderId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!dispatchOrder) throw new NotFoundException('Dispatch order not found.');
    if (dispatchOrder.items.length === 0) throw new BadRequestException('Dispatch order must have items before reservation.');

    const availabilityByItemId = new Map(dto.availability.map((item) => [item.dispatchOrderItemId, item.availableQuantity]));
    const unknownItem = dto.availability.find((item) => !dispatchOrder.items.some((dispatchItem) => dispatchItem.id === item.dispatchOrderItemId));
    if (unknownItem) throw new BadRequestException('Reservation availability must reference items from the dispatch order.');

    const reservationLines = dispatchOrder.items.map((item) => ({
      dispatchOrderItemId: item.id,
      productCatalogId: item.productCatalogId,
      productCodeSnapshot: item.productCodeSnapshot,
      ...calculateReservationLine({ requestedQuantity: item.quantity, availableQuantity: availabilityByItemId.get(item.id) ?? 0 }),
    }));
    const totals = resolveReservationStatus(reservationLines);

    const reservation = await this.prisma.reservation.create({
      data: {
        dispatchOrderId: dispatchOrder.id,
        status: totals.status,
        requestedQuantity: totals.requestedQuantity,
        reservedQuantity: totals.reservedQuantity,
        unreservedQuantity: totals.unreservedQuantity,
        externalRef: dto.externalRef,
        notes: dto.notes,
        items: { create: reservationLines },
      },
      include: this.reservationInclude(),
    });

    await this.audit.record({
      actor,
      source: AuditSource.API,
      action: AuditAction.CREATED,
      entityType: 'Reservation',
      entityId: reservation.id,
      relatedEntityType: 'DispatchOrder',
      relatedEntityId: reservation.dispatchOrderId,
      after: { status: reservation.status, requestedQuantity: reservation.requestedQuantity, reservedQuantity: reservation.reservedQuantity, unreservedQuantity: reservation.unreservedQuantity },
    });

    return reservation;
  }

  async findReservations() {
    return this.prisma.reservation.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], include: this.reservationInclude() });
  }

  async findReprocessReservations() {
    return this.prisma.reservation.findMany({ where: { status: 'PARTIAL' }, orderBy: { createdAt: 'asc' }, include: this.reservationInclude() });
  }

  async release(id: string, actor?: string) {
    const before = await this.prisma.reservation.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Reservation not found.');

    const reservation = await this.prisma.reservation.update({ where: { id }, data: releaseReservation(), include: this.reservationInclude() });
    await this.audit.record({
      actor,
      source: AuditSource.API,
      action: AuditAction.STATUS_CHANGED,
      entityType: 'Reservation',
      entityId: reservation.id,
      relatedEntityType: 'DispatchOrder',
      relatedEntityId: reservation.dispatchOrderId,
      before: { status: before.status, releasedAt: before.releasedAt?.toISOString() ?? null },
      after: { status: reservation.status, releasedAt: reservation.releasedAt?.toISOString() ?? null },
    });
    return reservation;
  }

  private reservationInclude() {
    return {
      dispatchOrder: true,
      items: { orderBy: { createdAt: 'asc' } },
    } satisfies Prisma.ReservationInclude;
  }
}
