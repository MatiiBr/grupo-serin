import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditSource, PreparationStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { calculatePreparationLine, canStartPreparation, resolvePreparationStatus } from '../domain/preparation/preparation-lifecycle';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePreparationDto } from './dto/create-preparation.dto';

@Injectable()
export class PreparationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createPreparation(dto: CreatePreparationDto, actor?: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      include: { items: { orderBy: { createdAt: 'asc' } }, dispatchOrder: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found.');
    if (!canStartPreparation({ status: reservation.status, unreservedQuantity: reservation.unreservedQuantity })) {
      throw new BadRequestException('Only fully reserved demand can start warehouse preparation.');
    }
    if (reservation.items.length === 0) throw new BadRequestException('Reservation must have items before warehouse preparation.');

    const readinessByReservationItemId = new Map(dto.items.map((item) => [item.reservationItemId, item]));
    const unknownItem = dto.items.find((item) => !reservation.items.some((reservationItem) => reservationItem.id === item.reservationItemId));
    if (unknownItem) throw new BadRequestException('Preparation items must reference items from the reservation.');

    const preparationLines = reservation.items.map((item) => {
      const readiness = readinessByReservationItemId.get(item.id);
      return {
        reservationItemId: item.id,
        productCodeSnapshot: item.productCodeSnapshot,
        discrepancyReason: readiness?.discrepancyReason,
        ...calculatePreparationLine({
          reservedQuantity: item.reservedQuantity,
          readyQuantity: readiness?.readyQuantity ?? 0,
          discrepancyQuantity: readiness?.discrepancyQuantity,
        }),
      };
    });
    const totals = resolvePreparationStatus(preparationLines);

    const preparation = await this.prisma.preparation.create({
      data: {
        reservationId: reservation.id,
        dispatchOrderId: reservation.dispatchOrderId,
        status: totals.status,
        requestedQuantity: reservation.requestedQuantity,
        reservedQuantity: totals.reservedQuantity,
        readyQuantity: totals.readyQuantity,
        discrepancyQuantity: totals.discrepancyQuantity,
        completedAt: totals.status === PreparationStatus.READY ? new Date() : undefined,
        notes: dto.notes,
        items: { create: preparationLines },
      },
      include: this.preparationInclude(),
    });

    await this.audit.record({
      actor,
      source: AuditSource.API,
      action: preparation.status === 'READY' ? AuditAction.READY_TO_LOAD : AuditAction.STATUS_CHANGED,
      entityType: 'Preparation',
      entityId: preparation.id,
      relatedEntityType: 'Reservation',
      relatedEntityId: preparation.reservationId,
      after: {
        status: preparation.status,
        reservedQuantity: preparation.reservedQuantity,
        readyQuantity: preparation.readyQuantity,
        discrepancyQuantity: preparation.discrepancyQuantity,
      },
    });

    return preparation;
  }

  async findPreparations() {
    return this.prisma.preparation.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], include: this.preparationInclude() });
  }

  async findDiscrepancies() {
    return this.prisma.preparation.findMany({ where: { status: 'DISCREPANCY' }, orderBy: { createdAt: 'asc' }, include: this.preparationInclude() });
  }

  private preparationInclude() {
    return {
      reservation: true,
      dispatchOrder: true,
      items: { orderBy: { createdAt: 'asc' } },
    } satisfies Prisma.PreparationInclude;
  }
}
