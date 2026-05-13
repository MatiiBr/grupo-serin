import { Injectable, NotFoundException } from '@nestjs/common';
import { TruckZoneType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertTruckDto } from './dto/upsert-truck.dto';

const DEFAULT_ZONES = [TruckZoneType.CABIN_SIDE, TruckZoneType.CENTER, TruckZoneType.DOOR_SIDE];

@Injectable()
export class TrucksService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertForOperation(operationId: string, dto: UpsertTruckDto) {
    await this.ensureOperationExists(operationId);

    const truck = await this.prisma.$transaction(async (tx) => {
      const savedTruck = await tx.truck.upsert({
        where: { operationId },
        create: {
          operationId,
          plate: dto.plate,
          description: dto.description,
          loadingMethod: dto.loadingMethod,
          maxPayloadKg: dto.maxPayloadKg,
          lengthMm: dto.lengthMm,
          widthMm: dto.widthMm,
          heightMm: dto.heightMm,
        },
        update: {
          plate: dto.plate,
          description: dto.description,
          loadingMethod: dto.loadingMethod,
          maxPayloadKg: dto.maxPayloadKg,
          lengthMm: dto.lengthMm,
          widthMm: dto.widthMm,
          heightMm: dto.heightMm,
        },
      });

      for (const type of DEFAULT_ZONES) {
        await tx.truckZone.upsert({
          where: { truckId_type: { truckId: savedTruck.id, type } },
          create: { truckId: savedTruck.id, type, name: this.defaultZoneName(type) },
          update: {},
        });
      }

      return tx.truck.findUniqueOrThrow({
        where: { id: savedTruck.id },
        include: { zones: { orderBy: { type: 'asc' } } },
      });
    });

    return this.toTruckResponse(truck);
  }

  async findForOperation(operationId: string) {
    await this.ensureOperationExists(operationId);

    const truck = await this.prisma.truck.findUnique({
      where: { operationId },
      include: { zones: { orderBy: { type: 'asc' } } },
    });

    if (!truck) {
      throw new NotFoundException('Truck not found for this operation.');
    }

    return this.toTruckResponse(truck);
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

  private defaultZoneName(type: TruckZoneType) {
    return type
      .toLowerCase()
      .split('_')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  private toTruckResponse(truck: {
    id: string;
    operationId: string;
    plate: string;
    description: string | null;
    loadingMethod: string;
    maxPayloadKg: { toString(): string } | null;
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
    createdAt: Date;
    updatedAt: Date;
    zones: Array<{
      id: string;
      truckId: string;
      type: string;
      name: string | null;
      maxWeightKg: { toString(): string } | null;
      startXMm: number | null;
      endXMm: number | null;
      startYMm: number | null;
      endYMm: number | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }) {
    return {
      ...truck,
      maxPayloadKg: truck.maxPayloadKg === null ? undefined : Number(truck.maxPayloadKg),
      zones: truck.zones.map((zone) => ({
        ...zone,
        maxWeightKg: zone.maxWeightKg === null ? undefined : Number(zone.maxWeightKg),
      })),
    };
  }
}
