import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Decimalish = Prisma.Decimal | number | string | null | undefined;

function decimalToNumber(value: Decimalish) {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

function generateOperationCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OP-${date}-${suffix}`;
}

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { code?: string; name?: string; notes?: string; scheduledAt?: Date }) {
    try {
      const operation = await this.prisma.loadOperation.create({
        data: {
          code: data.code ?? generateOperationCode(),
          name: data.name,
          notes: data.notes,
          scheduledAt: data.scheduledAt,
        },
      });

      return this.toOperationSummary(operation);
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException('An operation with this code already exists.');
      }

      throw error;
    }
  }

  async findAll() {
    const operations = await this.prisma.loadOperation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { destinationAssignments: true, productAssignments: true, plans: true } },
      },
    });

    return operations.map((operation) => this.toOperationSummary(operation));
  }

  async findOne(id: string) {
    const operation = await this.prisma.loadOperation.findUnique({
      where: { id },
      include: {
        truck: { include: { zones: { orderBy: { type: 'asc' } } } },
        destinations: { orderBy: { unloadingOrder: 'asc' } },
        products: { orderBy: { createdAt: 'asc' } },
        vehicleAssignment: { include: { truck: true, trailer: true, zones: { orderBy: { type: 'asc' } } } },
        destinationAssignments: { orderBy: { unloadingOrder: 'asc' }, include: { catalog: true } },
        productAssignments: {
          orderBy: { createdAt: 'asc' },
          include: { catalog: true, operationDestination: { include: { catalog: true } } },
        },
        plans: {
          orderBy: [{ isCurrent: 'desc' }, { version: 'desc' }],
          take: 1,
          include: {
            metrics: true,
            alerts: { orderBy: { createdAt: 'desc' }, take: 10 },
            _count: { select: { placedItems: true, unplaced: true } },
          },
        },
      },
    });

    if (!operation) {
      throw new NotFoundException('Operation not found.');
    }

    const latestPlan = operation.plans[0];

    return {
      ...this.toOperationSummary(operation),
      truck: operation.truck
        ? {
            ...operation.truck,
            maxPayloadKg: decimalToNumber(operation.truck.maxPayloadKg),
            zones: operation.truck.zones.map((zone) => ({
              ...zone,
              maxWeightKg: decimalToNumber(zone.maxWeightKg),
            })),
          }
        : null,
      destinations: operation.destinations,
      products: operation.products.map((product) => ({
        ...product,
        weightKg: decimalToNumber(product.weightKg),
      })),
      vehicleAssignment: operation.vehicleAssignment
        ? {
            ...operation.vehicleAssignment,
            truck: {
              ...operation.vehicleAssignment.truck,
              maxPayloadKg: decimalToNumber(operation.vehicleAssignment.truck.maxPayloadKg),
            },
            trailer: operation.vehicleAssignment.trailer
              ? {
                  ...operation.vehicleAssignment.trailer,
                  maxPayloadKg: decimalToNumber(operation.vehicleAssignment.trailer.maxPayloadKg),
                }
              : null,
            zones: operation.vehicleAssignment.zones.map((zone) => ({
              ...zone,
              maxWeightKg: decimalToNumber(zone.maxWeightKg),
            })),
          }
        : null,
      destinationAssignments: operation.destinationAssignments,
      productAssignments: operation.productAssignments.map((assignment) => ({
        ...assignment,
        weightKgOverride: decimalToNumber(assignment.weightKgOverride),
        catalog: {
          ...assignment.catalog,
          weightKg: decimalToNumber(assignment.catalog.weightKg),
        },
      })),
      latestPlan: latestPlan
        ? {
            id: latestPlan.id,
            version: latestPlan.version,
            status: latestPlan.status,
            method: latestPlan.method,
            isCurrent: latestPlan.isCurrent,
            notes: latestPlan.notes,
            placedItemCount: latestPlan._count.placedItems,
            unplacedItemCount: latestPlan._count.unplaced,
            metrics: latestPlan.metrics
              ? {
                  ...latestPlan.metrics,
                  totalWeightKg: decimalToNumber(latestPlan.metrics.totalWeightKg),
                  placedWeightKg: decimalToNumber(latestPlan.metrics.placedWeightKg),
                  unplacedWeightKg: decimalToNumber(latestPlan.metrics.unplacedWeightKg),
                  usedVolumeM3: decimalToNumber(latestPlan.metrics.usedVolumeM3),
                  centerOfGravityX: decimalToNumber(latestPlan.metrics.centerOfGravityX),
                  centerOfGravityY: decimalToNumber(latestPlan.metrics.centerOfGravityY),
                  centerOfGravityZ: decimalToNumber(latestPlan.metrics.centerOfGravityZ),
                }
              : null,
            alerts: latestPlan.alerts,
            updatedAt: latestPlan.updatedAt,
          }
        : null,
    };
  }

  async ensureOperationExists(id: string) {
    const operation = await this.prisma.loadOperation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!operation) {
      throw new NotFoundException('Operation not found.');
    }
  }

  private toOperationSummary(operation: {
    id: string;
    code: string;
    status: string;
    name: string | null;
    notes: string | null;
    scheduledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { destinationAssignments?: number; productAssignments?: number; destinations?: number; products?: number; plans: number };
  }) {
    return {
      id: operation.id,
      code: operation.code,
      status: operation.status,
      name: operation.name,
      notes: operation.notes,
      scheduledAt: operation.scheduledAt,
      createdAt: operation.createdAt,
      updatedAt: operation.updatedAt,
      counts: operation._count
        ? {
            destinations: operation._count.destinationAssignments ?? operation._count.destinations ?? 0,
            products: operation._count.productAssignments ?? operation._count.products ?? 0,
            plans: operation._count.plans,
          }
        : undefined,
    };
  }

  private isUniqueConstraint(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
