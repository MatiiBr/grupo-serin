import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, AuditSource, Prisma } from '@prisma/client';
import { normalizeAuditActor } from '../domain/audit/audit-event';
import { PrismaService } from '../prisma/prisma.service';

type AuditClient = PrismaService | Prisma.TransactionClient;

export interface RecordAuditEventInput {
  actor?: string | null;
  source?: AuditSource;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityCode?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordAuditEventInput) {
    return this.recordWithClient(this.prisma, input);
  }

  recordWithClient(client: AuditClient, input: RecordAuditEventInput) {
    return client.auditEvent.create({
      data: {
        actor: normalizeAuditActor(input.actor),
        source: input.source ?? AuditSource.SYSTEM,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityCode: input.entityCode,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        before: input.before,
        after: input.after,
        metadata: input.metadata,
      },
    });
  }

  async findByEntity(entityType?: string, entityId?: string) {
    if (!entityType || !entityId) {
      throw new BadRequestException('entityType and entityId query parameters are required.');
    }

    return this.prisma.auditEvent.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
