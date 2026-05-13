import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

@Injectable()
export class DestinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(operationId: string, dto: CreateDestinationDto) {
    await this.ensureOperationExists(operationId);
    await this.ensureUnloadingOrderAvailable(operationId, dto.unloadingOrder);

    try {
      return await this.prisma.destination.create({
        data: {
          operationId,
          code: dto.code,
          name: dto.name,
          unloadingOrder: dto.unloadingOrder,
          address: dto.address,
          notes: dto.notes,
        },
      });
    } catch (error) {
      this.handleUniqueOrderError(error);
      throw error;
    }
  }

  async findForOperation(operationId: string) {
    await this.ensureOperationExists(operationId);

    return this.prisma.destination.findMany({
      where: { operationId },
      orderBy: { unloadingOrder: 'asc' },
    });
  }

  async update(id: string, dto: UpdateDestinationDto) {
    const destination = await this.prisma.destination.findUnique({ where: { id } });

    if (!destination) {
      throw new NotFoundException('Destination not found.');
    }

    if (dto.unloadingOrder !== undefined) {
      await this.ensureUnloadingOrderAvailable(destination.operationId, dto.unloadingOrder, id);
    }

    try {
      return await this.prisma.destination.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      this.handleUniqueOrderError(error);
      throw error;
    }
  }

  async remove(id: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!destination) {
      throw new NotFoundException('Destination not found.');
    }

    await this.prisma.destination.delete({ where: { id } });

    return { id, deleted: true };
  }

  private async ensureOperationExists(operationId: string) {
    const operation = await this.prisma.loadOperation.findUnique({
      where: { id: operationId },
      select: { id: true },
    });

    if (!operation) {
      throw new NotFoundException('Operation not found.');
    }
  }

  private async ensureUnloadingOrderAvailable(operationId: string, unloadingOrder: number, excludeId?: string) {
    const existing = await this.prisma.destination.findFirst({
      where: {
        operationId,
        unloadingOrder,
        id: excludeId ? { not: excludeId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`Unloading order ${unloadingOrder} is already used in this operation.`);
    }
  }

  private handleUniqueOrderError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Unloading order must be unique within the operation.');
    }
  }
}
