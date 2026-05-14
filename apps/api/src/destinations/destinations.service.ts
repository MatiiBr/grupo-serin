import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDestinationCatalogDto, CreateOperationDestinationAssignmentDto } from './dto/create-destination.dto';
import { UpdateDestinationCatalogDto, UpdateOperationDestinationAssignmentDto } from './dto/update-destination.dto';

@Injectable()
export class DestinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCatalog(dto: CreateDestinationCatalogDto) {
    try {
      return await this.prisma.destinationCatalog.create({ data: dto });
    } catch (error) {
      this.handleUniqueCatalogError(error);
      throw error;
    }
  }

  async searchCatalog(q?: string) {
    return this.prisma.destinationCatalog.findMany({
      where: q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { address: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async updateCatalog(id: string, dto: UpdateDestinationCatalogDto) {
    await this.ensureCatalogExists(id);

    try {
      return await this.prisma.destinationCatalog.update({ where: { id }, data: dto });
    } catch (error) {
      this.handleUniqueCatalogError(error);
      throw error;
    }
  }

  async removeCatalog(id: string) {
    await this.ensureCatalogExists(id);

    try {
      await this.prisma.destinationCatalog.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Destination catalog record is assigned to an operation and cannot be deleted.');
      }

      throw error;
    }

    return { id, deleted: true };
  }

  async create(operationId: string, dto: CreateOperationDestinationAssignmentDto) {
    await this.ensureOperationExists(operationId);
    await this.ensureCatalogExists(dto.destinationCatalogId);
    await this.ensureUnloadingOrderAvailable(operationId, dto.unloadingOrder);

    try {
      const assignment = await this.prisma.operationDestinationAssignment.create({
        data: { ...dto, operationId },
        include: { catalog: true },
      });
      return assignment;
    } catch (error) {
      this.handleAssignmentConstraintError(error);
      throw error;
    }
  }

  async findForOperation(operationId: string) {
    await this.ensureOperationExists(operationId);

    return this.prisma.operationDestinationAssignment.findMany({
      where: { operationId },
      orderBy: { unloadingOrder: 'asc' },
      include: { catalog: true },
    });
  }

  async update(id: string, dto: UpdateOperationDestinationAssignmentDto) {
    const assignment = await this.findAssignmentOrThrow(id);

    if (dto.destinationCatalogId !== undefined) await this.ensureCatalogExists(dto.destinationCatalogId);
    if (dto.unloadingOrder !== undefined) await this.ensureUnloadingOrderAvailable(assignment.operationId, dto.unloadingOrder, id);

    try {
      return await this.prisma.operationDestinationAssignment.update({
        where: { id },
        data: dto,
        include: { catalog: true },
      });
    } catch (error) {
      this.handleAssignmentConstraintError(error);
      throw error;
    }
  }

  async reorder(operationId: string, ids: string[]) {
    await this.ensureOperationExists(operationId);
    const assignments = await this.prisma.operationDestinationAssignment.findMany({
      where: { operationId },
      select: { id: true },
    });

    const knownIds = new Set(assignments.map((assignment) => assignment.id));
    const uniqueIds = new Set(ids);

    if (ids.length !== assignments.length || uniqueIds.size !== ids.length || ids.some((id) => !knownIds.has(id))) {
      throw new BadRequestException('Reorder payload must include every destination assignment exactly once.');
    }

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(ids.map((id, index) => tx.operationDestinationAssignment.update({
        where: { id },
        data: { unloadingOrder: -(index + 1) },
      })));

      await Promise.all(ids.map((id, index) => tx.operationDestinationAssignment.update({
        where: { id },
        data: { unloadingOrder: index + 1 },
      })));
    });

    return this.findForOperation(operationId);
  }

  async remove(id: string) {
    await this.findAssignmentOrThrow(id);
    await this.prisma.operationDestinationAssignment.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async ensureOperationExists(operationId: string) {
    const operation = await this.prisma.loadOperation.findUnique({ where: { id: operationId }, select: { id: true } });
    if (!operation) throw new NotFoundException('Operation not found.');
  }

  private async ensureCatalogExists(id: string) {
    const destination = await this.prisma.destinationCatalog.findUnique({ where: { id }, select: { id: true } });
    if (!destination) throw new NotFoundException('Destination catalog record not found.');
  }

  private async findAssignmentOrThrow(id: string) {
    const assignment = await this.prisma.operationDestinationAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Destination assignment not found.');
    return assignment;
  }

  private async ensureUnloadingOrderAvailable(operationId: string, unloadingOrder: number, excludeId?: string) {
    const existing = await this.prisma.operationDestinationAssignment.findFirst({
      where: { operationId, unloadingOrder, id: excludeId ? { not: excludeId } : undefined },
      select: { id: true },
    });

    if (existing) throw new ConflictException(`Unloading order ${unloadingOrder} is already used in this operation.`);
  }

  private handleUniqueCatalogError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A destination catalog record with this code already exists.');
    }
  }

  private handleAssignmentConstraintError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Destination assignment must be unique within the operation.');
    }
  }
}
