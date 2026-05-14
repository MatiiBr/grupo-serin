import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditSource, DispatchOrderStatus, Prisma, TransportExitStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { authorizeTransportExit, blockTransportExit, canAuthorizeTransportExit, markTransportDispatched, markTransportDocsReady, recordTransportScale } from '../domain/transport/transport-exit-lifecycle';
import { PrismaService } from '../prisma/prisma.service';
import { BlockTransportExitDto, CreateTransportExitDto, MarkTransportDocsReadyDto, RecordTransportScaleDto } from './dto/transport-exit.dto';

type Decimalish = Prisma.Decimal | number | string | null | undefined;

function decimalToNumber(value: Decimalish) {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

@Injectable()
export class TransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createExit(dto: CreateTransportExitDto, actor?: string) {
    await this.ensureDispatchLinkedToLoadOperation(dto.dispatchOrderId);

    try {
      const exit = await this.prisma.transportExit.create({
        data: {
          dispatchOrderId: dto.dispatchOrderId,
          externalRef: dto.externalRef,
          notes: dto.notes,
        },
        include: this.exitInclude(),
      });

      await this.audit.record({
        actor,
        source: AuditSource.API,
        action: AuditAction.CREATED,
        entityType: 'TransportExit',
        entityId: exit.id,
        relatedEntityType: 'DispatchOrder',
        relatedEntityId: exit.dispatchOrderId,
        after: { status: exit.status, externalRef: exit.externalRef },
      });

      return this.toResponse(exit);
    } catch (error) {
      this.handleUniqueConstraint(error, 'A transport exit gate already exists for this dispatch order.');
      throw error;
    }
  }

  async markDocsReady(id: string, dto: MarkTransportDocsReadyDto, actor?: string) {
    const current = await this.findExitOrThrow(id);
    const updated = await this.prisma.transportExit.update({
      where: { id },
      data: { ...markTransportDocsReady(), externalRef: dto.externalRef ?? current.externalRef, notes: dto.notes ?? current.notes },
      include: this.exitInclude(),
    });
    await this.recordStatusChange(current, updated, actor, { docsReadyAt: updated.docsReadyAt?.toISOString() ?? null });
    return this.toResponse(updated);
  }

  async recordScale(id: string, dto: RecordTransportScaleDto, actor?: string) {
    const current = await this.findExitOrThrow(id);
    if (!current.docsReadyAt) throw new BadRequestException('Transport documents must be ready before recording scale result.');

    const updated = await this.prisma.transportExit.update({
      where: { id },
      data: { ...recordTransportScale(), scaleWeightKg: dto.scaleWeightKg, externalRef: dto.externalRef ?? current.externalRef, notes: dto.notes ?? current.notes },
      include: this.exitInclude(),
    });
    await this.recordStatusChange(current, updated, actor, { scaleWeightKg: dto.scaleWeightKg, scaledAt: updated.scaledAt?.toISOString() ?? null });
    return this.toResponse(updated);
  }

  async authorizeExit(id: string, actor?: string) {
    const current = await this.prisma.transportExit.findUnique({ where: { id }, include: this.authorizationInclude() });
    if (!current) throw new NotFoundException('Transport exit gate not found.');

    const currentPlan = current.dispatchOrder.loadOperation?.plans[0];
    if (
      !canAuthorizeTransportExit(
        { status: current.status, docsReadyAt: current.docsReadyAt, scaledAt: current.scaledAt },
        { operationStatus: current.dispatchOrder.loadOperation?.status, currentPlanStatus: currentPlan?.status },
      )
    ) {
      throw new BadRequestException('Approved loading plan, ready documents, and scale result are required before exit authorization.');
    }

    const updated = await this.prisma.transportExit.update({ where: { id }, data: authorizeTransportExit(), include: this.exitInclude() });
    await this.recordStatusChange(current, updated, actor, { authorizedAt: updated.authorizedAt?.toISOString() ?? null });
    return this.toResponse(updated);
  }

  async markDispatched(id: string, actor?: string) {
    const current = await this.findExitOrThrow(id);
    if (current.status !== TransportExitStatus.AUTHORIZED_EXIT) {
      throw new BadRequestException('Transport exit must be authorized before final dispatch can be recorded.');
    }

    const updated = await this.prisma.transportExit.update({ where: { id }, data: markTransportDispatched(), include: this.exitInclude() });
    await this.recordStatusChange(current, updated, actor, { dispatchedAt: updated.dispatchedAt?.toISOString() ?? null });
    return this.toResponse(updated);
  }

  async blockExit(id: string, dto: BlockTransportExitDto, actor?: string) {
    const current = await this.findExitOrThrow(id);
    const updated = await this.prisma.transportExit.update({ where: { id }, data: { ...blockTransportExit(dto.blockedReason), notes: dto.notes ?? current.notes }, include: this.exitInclude() });
    await this.recordStatusChange(current, updated, actor, { blockedReason: updated.blockedReason });
    return this.toResponse(updated);
  }

  async findExits() {
    const exits = await this.prisma.transportExit.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], include: this.exitInclude() });
    return exits.map((exit) => this.toResponse(exit));
  }

  private async ensureDispatchLinkedToLoadOperation(id: string) {
    const dispatchOrder = await this.prisma.dispatchOrder.findUnique({ where: { id }, select: { id: true, status: true, loadOperationId: true } });
    if (!dispatchOrder) throw new NotFoundException('Dispatch order not found.');
    if (dispatchOrder.status !== DispatchOrderStatus.LOAD_OPERATION_LINKED || !dispatchOrder.loadOperationId) {
      throw new BadRequestException('Transport exit gate requires a dispatch order linked to a load operation.');
    }
  }

  private async findExitOrThrow(id: string) {
    const exit = await this.prisma.transportExit.findUnique({ where: { id } });
    if (!exit) throw new NotFoundException('Transport exit gate not found.');
    return exit;
  }

  private async recordStatusChange(before: { id: string; status: TransportExitStatus; dispatchOrderId: string; externalRef?: string | null }, after: { id: string; status: TransportExitStatus; dispatchOrderId: string }, actor?: string, extraAfter?: Record<string, unknown>) {
    await this.audit.record({
      actor,
      source: AuditSource.API,
      action: AuditAction.STATUS_CHANGED,
      entityType: 'TransportExit',
      entityId: after.id,
      relatedEntityType: 'DispatchOrder',
      relatedEntityId: after.dispatchOrderId,
      before: { status: before.status, externalRef: before.externalRef ?? null },
      after: { status: after.status, ...extraAfter },
    });
  }

  private exitInclude() {
    return { dispatchOrder: true } satisfies Prisma.TransportExitInclude;
  }

  private authorizationInclude() {
    return {
      dispatchOrder: {
        include: {
          loadOperation: {
            include: {
              plans: { where: { isCurrent: true }, orderBy: { version: 'desc' }, take: 1 },
            },
          },
        },
      },
    } satisfies Prisma.TransportExitInclude;
  }

  private toResponse(exit: Prisma.TransportExitGetPayload<{ include: ReturnType<TransportService['exitInclude']> }>) {
    return { ...exit, scaleWeightKg: decimalToNumber(exit.scaleWeightKg) };
  }

  private handleUniqueConstraint(error: unknown, message: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
  }
}
