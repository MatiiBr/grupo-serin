import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperationProductAssignmentDto, CreateProductCatalogDto } from './dto/create-product.dto';
import { UpdateOperationProductAssignmentDto, UpdateProductCatalogDto } from './dto/update-product.dto';

type Decimalish = Prisma.Decimal | number | string | null | undefined;

function decimalToNumber(value: Decimalish) {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCatalog(dto: CreateProductCatalogDto) {
    try {
      const product = await this.prisma.productCatalog.create({ data: dto });
      return this.toCatalogResponse(product);
    } catch (error) {
      this.handleUniqueCodeError(error);
      throw error;
    }
  }

  async searchCatalog(q?: string) {
    const products = await this.prisma.productCatalog.findMany({
      where: q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });

    return products.map((product) => this.toCatalogResponse(product));
  }

  async updateCatalog(id: string, dto: UpdateProductCatalogDto) {
    await this.ensureCatalogExists(id);

    try {
      const updated = await this.prisma.productCatalog.update({ where: { id }, data: dto });
      return this.toCatalogResponse(updated);
    } catch (error) {
      this.handleUniqueCodeError(error);
      throw error;
    }
  }

  async removeCatalog(id: string) {
    await this.ensureCatalogExists(id);

    try {
      await this.prisma.productCatalog.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Product catalog record is assigned to an operation and cannot be deleted.');
      }

      throw error;
    }

    return { id, deleted: true };
  }

  async create(operationId: string, dto: CreateOperationProductAssignmentDto) {
    await this.ensureOperationExists(operationId);
    await this.ensureCatalogExists(dto.productCatalogId);
    await this.ensureDestinationBelongsToOperation(operationId, dto.operationDestinationId);

    const assignment = await this.prisma.operationProductAssignment.create({
      data: { ...dto, operationId },
      include: this.assignmentInclude(),
    });

    return this.toAssignmentResponse(assignment);
  }

  async findForOperation(operationId: string) {
    await this.ensureOperationExists(operationId);

    const assignments = await this.prisma.operationProductAssignment.findMany({
      where: { operationId },
      orderBy: { createdAt: 'asc' },
      include: this.assignmentInclude(),
    });

    return assignments.map((assignment) => this.toAssignmentResponse(assignment));
  }

  async update(id: string, dto: UpdateOperationProductAssignmentDto) {
    const assignment = await this.findAssignmentOrThrow(id);

    if (dto.productCatalogId !== undefined) await this.ensureCatalogExists(dto.productCatalogId);
    await this.ensureDestinationBelongsToOperation(assignment.operationId, dto.operationDestinationId);

    const updated = await this.prisma.operationProductAssignment.update({
      where: { id },
      data: dto,
      include: this.assignmentInclude(),
    });

    return this.toAssignmentResponse(updated);
  }

  async remove(id: string) {
    await this.findAssignmentOrThrow(id);

    try {
      await this.prisma.operationProductAssignment.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Product assignment is already referenced by a loading plan and cannot be deleted.');
      }

      throw error;
    }

    return { id, deleted: true };
  }

  private async ensureOperationExists(operationId: string) {
    const operation = await this.prisma.loadOperation.findUnique({ where: { id: operationId }, select: { id: true } });

    if (!operation) throw new NotFoundException('Operation not found.');
  }

  private async ensureCatalogExists(id: string) {
    const product = await this.prisma.productCatalog.findUnique({ where: { id }, select: { id: true } });

    if (!product) throw new NotFoundException('Product catalog record not found.');
  }

  private async ensureDestinationBelongsToOperation(operationId: string, operationDestinationId?: string | null) {
    if (operationDestinationId === undefined) return;
    if (operationDestinationId === null) return;

    const destination = await this.prisma.operationDestinationAssignment.findUnique({
      where: { id: operationDestinationId },
      select: { operationId: true },
    });

    if (!destination) throw new NotFoundException('Operation destination assignment not found.');
    if (destination.operationId !== operationId) throw new ConflictException('Destination assignment does not belong to this operation.');
  }

  private async findAssignmentOrThrow(id: string) {
    const assignment = await this.prisma.operationProductAssignment.findUnique({ where: { id } });

    if (!assignment) throw new NotFoundException('Product assignment not found.');
    return assignment;
  }

  private assignmentInclude() {
    return {
      catalog: true,
      operationDestination: { include: { catalog: true } },
    } satisfies Prisma.OperationProductAssignmentInclude;
  }

  private toCatalogResponse(product: Prisma.ProductCatalogGetPayload<Record<string, never>>) {
    return {
      ...product,
      weightKg: decimalToNumber(product.weightKg),
    };
  }

  private toAssignmentResponse(assignment: Prisma.OperationProductAssignmentGetPayload<{ include: ReturnType<ProductsService['assignmentInclude']> }>) {
    return {
      ...assignment,
      weightKgOverride: decimalToNumber(assignment.weightKgOverride),
      catalog: this.toCatalogResponse(assignment.catalog),
      operationDestination: assignment.operationDestination
        ? {
            ...assignment.operationDestination,
            catalog: assignment.operationDestination.catalog,
          }
        : null,
    };
  }

  private handleUniqueCodeError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A product catalog record with this code already exists.');
    }
  }
}
