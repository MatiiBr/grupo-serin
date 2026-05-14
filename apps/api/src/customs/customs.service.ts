import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditSource, CustomsReleaseStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { blockCustomsRelease, clearCustomsRelease } from '../domain/customs/customs-release-lifecycle';
import { PrismaService } from '../prisma/prisma.service';
import { BlockCustomsReleaseDto, ClearCustomsReleaseDto, CreateCustomsReleaseDto } from './dto/customs-release.dto';

@Injectable()
export class CustomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createRelease(dto: CreateCustomsReleaseDto, actor?: string) {
    await this.ensureDispatchOrderExists(dto.dispatchOrderId);
    try {
      const release = await this.prisma.customsRelease.create({
        data: {
          dispatchOrderId: dto.dispatchOrderId,
          externalRef: dto.externalRef,
          notes: dto.notes,
        },
        include: this.releaseInclude(),
      });

      await this.audit.record({
        actor,
        source: AuditSource.API,
        action: AuditAction.STATUS_CHANGED,
        entityType: 'CustomsRelease',
        entityId: release.id,
        relatedEntityType: 'DispatchOrder',
        relatedEntityId: release.dispatchOrderId,
        after: { status: release.status, externalRef: release.externalRef },
      });

      return release;
    } catch (error) {
      this.handleUniqueConstraint(error, 'A customs release already exists for this dispatch order.');
      throw error;
    }
  }

  async clearRelease(id: string, dto: ClearCustomsReleaseDto, actor?: string) {
    const current = await this.findReleaseOrThrow(id);
    const release = await this.prisma.customsRelease.update({
      where: { id },
      data: { ...clearCustomsRelease(), externalRef: dto.externalRef ?? current.externalRef, notes: dto.notes ?? current.notes },
      include: this.releaseInclude(),
    });
    await this.audit.record({
      actor,
      source: AuditSource.API,
      action: AuditAction.STATUS_CHANGED,
      entityType: 'CustomsRelease',
      entityId: release.id,
      relatedEntityType: 'DispatchOrder',
      relatedEntityId: release.dispatchOrderId,
      before: { status: current.status, externalRef: current.externalRef },
      after: { status: release.status, externalRef: release.externalRef, clearedAt: release.clearedAt?.toISOString() ?? null },
    });
    return release;
  }

  async blockRelease(id: string, dto: BlockCustomsReleaseDto, actor?: string) {
    const current = await this.findReleaseOrThrow(id);
    const release = await this.prisma.customsRelease.update({
      where: { id },
      data: { ...blockCustomsRelease(dto.blockedReason), notes: dto.notes ?? current.notes },
      include: this.releaseInclude(),
    });
    await this.audit.record({
      actor,
      source: AuditSource.API,
      action: AuditAction.STATUS_CHANGED,
      entityType: 'CustomsRelease',
      entityId: release.id,
      relatedEntityType: 'DispatchOrder',
      relatedEntityId: release.dispatchOrderId,
      before: { status: current.status },
      after: { status: release.status, blockedReason: release.blockedReason },
    });
    return release;
  }

  async findReleases() {
    return this.prisma.customsRelease.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], include: this.releaseInclude() });
  }

  async findPendingReleases() {
    return this.prisma.customsRelease.findMany({ where: { status: { in: [CustomsReleaseStatus.PENDING, CustomsReleaseStatus.BLOCKED] } }, orderBy: { createdAt: 'asc' }, include: this.releaseInclude() });
  }

  private async ensureDispatchOrderExists(id: string) {
    const dispatchOrder = await this.prisma.dispatchOrder.findUnique({ where: { id }, select: { id: true } });
    if (!dispatchOrder) throw new NotFoundException('Dispatch order not found.');
  }

  private async findReleaseOrThrow(id: string) {
    const release = await this.prisma.customsRelease.findUnique({ where: { id } });
    if (!release) throw new NotFoundException('Customs release not found.');
    return release;
  }

  private releaseInclude() {
    return { dispatchOrder: true } satisfies Prisma.CustomsReleaseInclude;
  }

  private handleUniqueConstraint(error: unknown, message: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
  }
}
