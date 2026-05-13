import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(operationId: string, dto: CreateProductDto) {
    await this.ensureOperationExists(operationId);
    await this.ensureDestinationBelongsToOperation(operationId, dto.destinationId);

    const product = await this.prisma.loadProduct.create({
      data: {
        operationId,
        destinationId: dto.destinationId,
        code: dto.code,
        family: dto.family,
        description: dto.description,
        quantity: dto.quantity,
        weightKg: dto.weightKg,
        lengthMm: dto.lengthMm,
        widthMm: dto.widthMm,
        heightMm: dto.heightMm,
        stackable: dto.stackable,
        rotationAllowed: dto.rotationAllowed,
      },
    });

    return this.toProductResponse(product);
  }

  async findForOperation(operationId: string) {
    await this.ensureOperationExists(operationId);

    const products = await this.prisma.loadProduct.findMany({
      where: { operationId },
      orderBy: { createdAt: 'asc' },
    });

    return products.map((product) => this.toProductResponse(product));
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findProductOrThrow(id);
    await this.ensureDestinationBelongsToOperation(product.operationId, dto.destinationId);

    const updated = await this.prisma.loadProduct.update({
      where: { id },
      data: dto,
    });

    return this.toProductResponse(updated);
  }

  async remove(id: string) {
    await this.findProductOrThrow(id);

    try {
      await this.prisma.loadProduct.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Product is already referenced by a loading plan and cannot be deleted.');
      }

      throw error;
    }

    return { id, deleted: true };
  }

  async duplicate(id: string) {
    const product = await this.findProductOrThrow(id);

    const duplicated = await this.prisma.loadProduct.create({
      data: {
        operationId: product.operationId,
        destinationId: product.destinationId,
        code: `${product.code}-COPY`,
        family: product.family,
        description: product.description,
        quantity: product.quantity,
        weightKg: product.weightKg,
        lengthMm: product.lengthMm,
        widthMm: product.widthMm,
        heightMm: product.heightMm,
        stackable: product.stackable,
        rotationAllowed: product.rotationAllowed,
      },
    });

    return this.toProductResponse(duplicated);
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

  private async ensureDestinationBelongsToOperation(operationId: string, destinationId?: string | null) {
    if (!destinationId) return;

    const destination = await this.prisma.destination.findUnique({
      where: { id: destinationId },
      select: { operationId: true },
    });

    if (!destination) {
      throw new NotFoundException('Destination not found.');
    }

    if (destination.operationId !== operationId) {
      throw new ConflictException('Destination does not belong to this operation.');
    }
  }

  private async findProductOrThrow(id: string) {
    const product = await this.prisma.loadProduct.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return product;
  }

  private toProductResponse(product: {
    id: string;
    operationId: string;
    destinationId: string | null;
    code: string;
    family: string;
    description: string | null;
    quantity: number;
    weightKg: { toString(): string } | null;
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
    stackable: boolean;
    rotationAllowed: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...product,
      weightKg: product.weightKg === null ? undefined : Number(product.weightKg),
    };
  }
}
