import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TruckZoneType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrailerCatalogDto, CreateTruckCatalogDto, UpdateTrailerCatalogDto, UpdateTruckCatalogDto, UpsertOperationVehicleAssignmentDto } from './dto/upsert-truck.dto';

const DEFAULT_ZONES = [TruckZoneType.CABIN_SIDE, TruckZoneType.CENTER, TruckZoneType.DOOR_SIDE];

type Decimalish = Prisma.Decimal | number | string | null | undefined;

function decimalToNumber(value: Decimalish) {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

@Injectable()
export class TrucksService {
  constructor(private readonly prisma: PrismaService) {}

  async createTruckCatalog(dto: CreateTruckCatalogDto) {
    try {
      const truck = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.truckCatalog.create({ data: dto });
        await tx.zoneTemplate.createMany({
          data: DEFAULT_ZONES.map((type) => ({ truckCatalogId: saved.id, type, name: this.defaultZoneName(type) })),
        });
        return tx.truckCatalog.findUniqueOrThrow({ where: { id: saved.id }, include: { zoneTemplates: { orderBy: { type: 'asc' } } } });
      });
      return this.toTruckCatalogResponse(truck);
    } catch (error) {
      this.handleUniqueCatalogError(error, 'truck');
      throw error;
    }
  }

  async searchTruckCatalog(q?: string) {
    const trucks = await this.prisma.truckCatalog.findMany({
      where: q
        ? { OR: [{ plate: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }
        : undefined,
      orderBy: [{ isActive: 'desc' }, { plate: 'asc' }],
      include: { zoneTemplates: { orderBy: { type: 'asc' } } },
    });

    return trucks.map((truck) => this.toTruckCatalogResponse(truck));
  }

  async updateTruckCatalog(id: string, dto: UpdateTruckCatalogDto) {
    await this.ensureTruckCatalogExists(id);

    try {
      const truck = await this.prisma.truckCatalog.update({
        where: { id },
        data: dto,
        include: { zoneTemplates: { orderBy: { type: 'asc' } } },
      });
      return this.toTruckCatalogResponse(truck);
    } catch (error) {
      this.handleUniqueCatalogError(error, 'truck');
      throw error;
    }
  }

  async removeTruckCatalog(id: string) {
    await this.ensureTruckCatalogExists(id);
    try {
      await this.prisma.truckCatalog.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Truck catalog record is assigned to an operation and cannot be deleted.');
      }
      throw error;
    }
    return { id, deleted: true };
  }

  async createTrailerCatalog(dto: CreateTrailerCatalogDto) {
    try {
      const trailer = await this.prisma.trailerCatalog.create({ data: dto });
      return this.toTrailerCatalogResponse(trailer);
    } catch (error) {
      this.handleUniqueCatalogError(error, 'trailer');
      throw error;
    }
  }

  async searchTrailerCatalog(q?: string) {
    const trailers = await this.prisma.trailerCatalog.findMany({
      where: q
        ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }
        : undefined,
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
    return trailers.map((trailer) => this.toTrailerCatalogResponse(trailer));
  }

  async updateTrailerCatalog(id: string, dto: UpdateTrailerCatalogDto) {
    await this.ensureTrailerCatalogExists(id);
    try {
      const trailer = await this.prisma.trailerCatalog.update({ where: { id }, data: dto });
      return this.toTrailerCatalogResponse(trailer);
    } catch (error) {
      this.handleUniqueCatalogError(error, 'trailer');
      throw error;
    }
  }

  async removeTrailerCatalog(id: string) {
    await this.ensureTrailerCatalogExists(id);
    try {
      await this.prisma.trailerCatalog.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Trailer catalog record is assigned to an operation and cannot be deleted.');
      }
      throw error;
    }
    return { id, deleted: true };
  }

  async upsertForOperation(operationId: string, dto: UpsertOperationVehicleAssignmentDto) {
    await this.ensureOperationExists(operationId);
    await this.ensureTruckCatalogExists(dto.truckCatalogId);
    if (dto.trailerCatalogId) await this.ensureTrailerCatalogExists(dto.trailerCatalogId);

    const assignment = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.operationVehicleAssignment.upsert({
        where: { operationId },
        create: { operationId, ...dto },
        update: dto,
      });

      const templates = await tx.zoneTemplate.findMany({ where: { truckCatalogId: dto.truckCatalogId } });
      for (const type of DEFAULT_ZONES) {
        const template = templates.find((zone) => zone.type === type);
        await tx.operationTruckZone.upsert({
          where: { vehicleAssignmentId_type: { vehicleAssignmentId: saved.id, type } },
          create: {
            vehicleAssignmentId: saved.id,
            zoneTemplateId: template?.id,
            type,
            name: template?.name ?? this.defaultZoneName(type),
            maxWeightKg: template?.maxWeightKg,
            startXMm: template?.startXMm,
            endXMm: template?.endXMm,
            startYMm: template?.startYMm,
            endYMm: template?.endYMm,
          },
          update: {},
        });
      }

      return tx.operationVehicleAssignment.findUniqueOrThrow({
        where: { id: saved.id },
        include: { truck: true, trailer: true, zones: { orderBy: { type: 'asc' } } },
      });
    });

    return this.toVehicleAssignmentResponse(assignment);
  }

  async findForOperation(operationId: string) {
    await this.ensureOperationExists(operationId);

    const assignment = await this.prisma.operationVehicleAssignment.findUnique({
      where: { operationId },
      include: { truck: true, trailer: true, zones: { orderBy: { type: 'asc' } } },
    });

    if (!assignment) throw new NotFoundException('Vehicle assignment not found for this operation.');
    return this.toVehicleAssignmentResponse(assignment);
  }

  private async ensureOperationExists(operationId: string) {
    const operation = await this.prisma.loadOperation.findUnique({ where: { id: operationId }, select: { id: true } });
    if (!operation) throw new NotFoundException('Operation not found.');
  }

  private async ensureTruckCatalogExists(id: string) {
    const truck = await this.prisma.truckCatalog.findUnique({ where: { id }, select: { id: true } });
    if (!truck) throw new NotFoundException('Truck catalog record not found.');
  }

  private async ensureTrailerCatalogExists(id: string) {
    const trailer = await this.prisma.trailerCatalog.findUnique({ where: { id }, select: { id: true } });
    if (!trailer) throw new NotFoundException('Trailer catalog record not found.');
  }

  private defaultZoneName(type: TruckZoneType) {
    return type
      .toLowerCase()
      .split('_')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  private toTruckCatalogResponse(truck: Prisma.TruckCatalogGetPayload<{ include: { zoneTemplates: true } }>) {
    return {
      ...truck,
      maxPayloadKg: decimalToNumber(truck.maxPayloadKg),
      zoneTemplates: truck.zoneTemplates.map((zone) => ({ ...zone, maxWeightKg: decimalToNumber(zone.maxWeightKg) })),
    };
  }

  private toTrailerCatalogResponse(trailer: Prisma.TrailerCatalogGetPayload<Record<string, never>>) {
    return { ...trailer, maxPayloadKg: decimalToNumber(trailer.maxPayloadKg) };
  }

  private toVehicleAssignmentResponse(assignment: Prisma.OperationVehicleAssignmentGetPayload<{ include: { truck: true; trailer: true; zones: true } }>) {
    return {
      ...assignment,
      truck: { ...assignment.truck, maxPayloadKg: decimalToNumber(assignment.truck.maxPayloadKg) },
      trailer: assignment.trailer ? this.toTrailerCatalogResponse(assignment.trailer) : null,
      zones: assignment.zones.map((zone) => ({ ...zone, maxWeightKg: decimalToNumber(zone.maxWeightKg) })),
    };
  }

  private handleUniqueCatalogError(error: unknown, resource: 'truck' | 'trailer') {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(`A ${resource} catalog record with this identifier already exists.`);
    }
  }
}
