import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertSeverity, AlertType, OperationStatus, PlanStatus, Prisma, TruckZoneType } from '@prisma/client';
import { HeuristicLoadingPlanner } from '../domain/loading-planner/heuristic-loading-planner';
import { Bounds, isWithinBounds, overlaps } from '../domain/loading-planner/geometry';
import { LoadingPlannerInput, LoadingPlannerResult } from '../domain/loading-planner/loading-planner.types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlacedItemDto } from './dto/update-placed-item.dto';

const loadingPlanInclude = Prisma.validator<Prisma.LoadingPlanInclude>()({
  operation: { select: { id: true, code: true, status: true } },
  placedItems: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: { include: { destination: true } },
      truckZone: true,
    },
  },
  unplaced: {
    orderBy: { createdAt: 'asc' },
    include: { product: { include: { destination: true } } },
  },
  steps: { orderBy: { sequence: 'asc' } },
  alerts: { orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }] },
  metrics: true,
});

const reportPlanInclude = Prisma.validator<Prisma.LoadingPlanInclude>()({
  ...loadingPlanInclude,
  operation: {
    include: {
      truck: { include: { zones: { orderBy: { type: 'asc' } } } },
      destinations: { orderBy: { unloadingOrder: 'asc' } },
      products: { include: { destination: true }, orderBy: { createdAt: 'asc' } },
    },
  },
});

type LoadingPlanWithRelations = Prisma.LoadingPlanGetPayload<{ include: typeof loadingPlanInclude }>;
type ReportPlanWithRelations = Prisma.LoadingPlanGetPayload<{ include: typeof reportPlanInclude }>;
type Decimalish = Prisma.Decimal | number | string | null | undefined;
type RecalculationPlan = Prisma.LoadingPlanGetPayload<{
  include: {
    operation: { include: { truck: { include: { zones: true } } } };
    placedItems: { include: { product: true; truckZone: true } };
    unplaced: { include: { product: true } };
  };
}>;
type RecalculatedAlert = Omit<Prisma.LoadAlertCreateManyInput, 'planId'>;
type RecalculationTruckZone = NonNullable<RecalculationPlan['operation']['truck']>['zones'][number];

@Injectable()
export class LoadingPlansService {
  private readonly planner = new HeuristicLoadingPlanner();

  constructor(private readonly prisma: PrismaService) {}

  async generate(operationId: string) {
    const operation = await this.prisma.loadOperation.findUnique({
      where: { id: operationId },
      include: {
        truck: { include: { zones: true } },
        destinations: { orderBy: { unloadingOrder: 'asc' } },
        products: { include: { destination: true }, orderBy: { createdAt: 'asc' } },
        plans: { orderBy: { version: 'desc' }, take: 1, select: { version: true } },
      },
    });

    if (!operation) {
      throw new NotFoundException('Operation not found.');
    }

    if (!operation.truck) {
      throw new BadRequestException('Operation must have a truck before generating a loading plan.');
    }

    if (!operation.truck.lengthMm || !operation.truck.widthMm || !operation.truck.heightMm) {
      throw new BadRequestException('Truck length, width, and height are required for automatic planning.');
    }

    if (operation.products.length === 0) {
      throw new BadRequestException('Operation must have at least one product before generating a loading plan.');
    }

    const result = this.planner.generate(this.toPlannerInput(operation));
    const version = (operation.plans[0]?.version ?? 0) + 1;

    const plan = await this.prisma.$transaction(async (tx) => {
      await tx.loadingPlan.updateMany({
        where: { operationId, isCurrent: true },
        data: { isCurrent: false },
      });

      const createdPlan = await tx.loadingPlan.create({
        data: {
          operationId,
          version,
          status: PlanStatus.GENERATED,
          method: operation.truck!.loadingMethod,
          isCurrent: true,
        },
      });

      const placedItemIdByUnit = new Map<string, string>();
      for (const item of result.placedItems) {
        const placed = await tx.placedItem.create({
          data: {
            planId: createdPlan.id,
            productId: item.productId,
            unitIndex: item.unitIndex,
            truckZoneId: item.truckZoneId,
            xMm: item.xMm,
            yMm: item.yMm,
            zMm: item.zMm,
            rotationDeg: item.rotationDeg,
            lengthMm: item.lengthMm,
            widthMm: item.widthMm,
            heightMm: item.heightMm,
          },
        });

        placedItemIdByUnit.set(this.unitKey(item.productId, item.unitIndex), placed.id);
      }

      if (result.unplacedItems.length > 0) {
        await tx.unplacedItem.createMany({
          data: result.unplacedItems.map((item) => ({
            planId: createdPlan.id,
            productId: item.productId,
            unitIndex: item.unitIndex,
            reason: item.reason,
            message: item.message,
          })),
        });
      }

      if (result.steps.length > 0) {
        await tx.loadingStep.createMany({
          data: result.steps.map((step) => ({
            planId: createdPlan.id,
            placedItemId: placedItemIdByUnit.get(this.unitKey(step.productId, step.unitIndex)),
            sequence: step.sequence,
            title: step.title,
            instructions: step.instructions,
          })),
        });
      }

      if (result.alerts.length > 0) {
        await tx.loadAlert.createMany({
          data: result.alerts.map((alert) => ({
            planId: createdPlan.id,
            productId: alert.productId,
            severity: alert.severity,
            type: alert.type,
            message: alert.message,
          })),
        });
      }

      await tx.planMetrics.create({
        data: {
          planId: createdPlan.id,
          ...this.toMetricsCreateInput(result),
        },
      });

      await tx.loadOperation.update({
        where: { id: operationId },
        data: { status: OperationStatus.PLAN_GENERATED },
      });

      return tx.loadingPlan.findUniqueOrThrow({ where: { id: createdPlan.id }, include: loadingPlanInclude });
    });

    return this.toDto(plan);
  }

  async findCurrent(operationId: string) {
    await this.ensureOperationExists(operationId);

    const plan = await this.prisma.loadingPlan.findFirst({
      where: { operationId, isCurrent: true },
      orderBy: { version: 'desc' },
      include: loadingPlanInclude,
    });

    if (!plan) {
      throw new NotFoundException('Current loading plan not found for this operation.');
    }

    return this.toDto(plan);
  }

  async findOne(id: string) {
    const plan = await this.prisma.loadingPlan.findUnique({ where: { id }, include: loadingPlanInclude });

    if (!plan) {
      throw new NotFoundException('Loading plan not found.');
    }

    return this.toDto(plan);
  }

  async approve(planId: string) {
    const plan = await this.prisma.loadingPlan.findUnique({ where: { id: planId }, include: loadingPlanInclude });

    if (!plan) {
      throw new NotFoundException('Loading plan not found.');
    }

    const criticalAlertCount = plan.alerts.filter((alert) => alert.severity === AlertSeverity.CRITICAL).length;
    if (criticalAlertCount > 0) {
      throw new BadRequestException('Loading plan has critical alerts and cannot be approved.');
    }

    const approvedPlan = await this.prisma.$transaction(async (tx) => {
      await tx.loadingPlan.update({
        where: { id: planId },
        data: { status: PlanStatus.APPROVED, approvedAt: new Date() },
      });

      await tx.loadOperation.update({
        where: { id: plan.operationId },
        data: { status: OperationStatus.APPROVED },
      });

      return tx.loadingPlan.findUniqueOrThrow({ where: { id: planId }, include: loadingPlanInclude });
    });

    return this.toDto(approvedPlan);
  }

  async report(planId: string) {
    const plan = await this.prisma.loadingPlan.findUnique({ where: { id: planId }, include: reportPlanInclude });

    if (!plan) {
      throw new NotFoundException('Loading plan not found.');
    }

    return this.toReportDto(plan);
  }

  async updatePlacedItem(planId: string, placedItemId: string, dto: UpdatePlacedItemDto) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one placement field is required.');
    }

    const plan = await this.prisma.loadingPlan.findUnique({
      where: { id: planId },
      include: {
        operation: { include: { truck: { include: { zones: true } } } },
        placedItems: { include: { product: true, truckZone: true } },
        unplaced: { include: { product: true } },
      },
    });

    if (!plan) {
      throw new NotFoundException('Loading plan not found.');
    }

    if (plan.status === PlanStatus.APPROVED) {
      throw new BadRequestException('Approved loading plans cannot be modified.');
    }

    const currentItem = plan.placedItems.find((item) => item.id === placedItemId);
    if (!currentItem) {
      throw new NotFoundException('Placed item not found in this loading plan.');
    }

    const rotationDeg = dto.rotationDeg ?? currentItem.rotationDeg;
    if (rotationDeg % 90 !== 0) {
      throw new BadRequestException('rotationDeg must be a 90 degree increment.');
    }
    if (rotationDeg % 180 !== 0 && currentItem.product.rotationAllowed === false) {
      throw new BadRequestException('Product does not allow rotation.');
    }

    const orientedDimensions = this.orientedDimensions(currentItem.product, rotationDeg, currentItem);
    const adjustedItems = plan.placedItems.map((item) => {
      if (item.id !== placedItemId) return item;
      return {
        ...item,
        xMm: dto.xMm ?? item.xMm,
        yMm: dto.yMm ?? item.yMm,
        zMm: dto.zMm ?? item.zMm,
        rotationDeg,
        lengthMm: orientedDimensions.lengthMm,
        widthMm: orientedDimensions.widthMm,
        heightMm: orientedDimensions.heightMm,
        locked: dto.locked ?? item.locked,
        manuallyAdjusted: true,
      };
    });
    const updatedItem = adjustedItems.find((item) => item.id === placedItemId)!;
    const truckZoneId = this.zoneForItem(plan, updatedItem);
    const validation = this.recalculatePlan(plan, adjustedItems);

    const updatedPlan = await this.prisma.$transaction(async (tx) => {
      await tx.placedItem.update({
        where: { id: placedItemId },
        data: {
          xMm: updatedItem.xMm,
          yMm: updatedItem.yMm,
          zMm: updatedItem.zMm,
          rotationDeg: updatedItem.rotationDeg,
          lengthMm: updatedItem.lengthMm,
          widthMm: updatedItem.widthMm,
          heightMm: updatedItem.heightMm,
          locked: updatedItem.locked,
          manuallyAdjusted: true,
          truckZoneId,
        },
      });

      await tx.loadAlert.deleteMany({ where: { planId } });
      if (validation.alerts.length > 0) {
        await tx.loadAlert.createMany({ data: validation.alerts.map((alert) => ({ ...alert, planId })) });
      }

      await tx.planMetrics.upsert({
        where: { planId },
        create: { planId, ...validation.metrics },
        update: validation.metrics,
      });

      await tx.loadingPlan.update({ where: { id: planId }, data: { status: PlanStatus.MODIFIED } });
      return tx.loadingPlan.findUniqueOrThrow({ where: { id: planId }, include: loadingPlanInclude });
    });

    return this.toDto(updatedPlan);
  }

  private toPlannerInput(operation: Prisma.LoadOperationGetPayload<{
    include: {
      truck: { include: { zones: true } };
      destinations: true;
      products: { include: { destination: true } };
      plans: { select: { version: true } };
    };
  }>): LoadingPlannerInput {
    return {
      truck: {
        id: operation.truck!.id,
        loadingMethod: operation.truck!.loadingMethod,
        maxPayloadKg: decimalToNumber(operation.truck!.maxPayloadKg),
        lengthMm: operation.truck!.lengthMm ?? undefined,
        widthMm: operation.truck!.widthMm ?? undefined,
        heightMm: operation.truck!.heightMm ?? undefined,
        zones: operation.truck!.zones.map((zone) => ({
          id: zone.id,
          type: zone.type,
          maxWeightKg: decimalToNumber(zone.maxWeightKg),
          startXMm: zone.startXMm ?? undefined,
          endXMm: zone.endXMm ?? undefined,
          startYMm: zone.startYMm ?? undefined,
          endYMm: zone.endYMm ?? undefined,
        })),
      },
      destinations: operation.destinations.map((destination) => ({
        id: destination.id,
        name: destination.name,
        unloadingOrder: destination.unloadingOrder,
      })),
      products: operation.products.map((product) => ({
        id: product.id,
        code: product.code,
        family: product.family,
        description: product.description ?? undefined,
        destinationId: product.destinationId ?? undefined,
        quantity: product.quantity,
        weightKg: decimalToNumber(product.weightKg),
        lengthMm: product.lengthMm ?? undefined,
        widthMm: product.widthMm ?? undefined,
        heightMm: product.heightMm ?? undefined,
        stackable: product.stackable,
        rotationAllowed: product.rotationAllowed,
      })),
    };
  }

  private toMetricsCreateInput(result: LoadingPlannerResult) {
    return {
      totalWeightKg: result.metrics.totalWeightKg,
      placedWeightKg: result.metrics.placedWeightKg,
      unplacedWeightKg: result.metrics.unplacedWeightKg,
      usedVolumeM3: result.metrics.usedVolumeM3,
      volumeUtilizationPct: result.metrics.volumeUtilizationPct,
      placedItemCount: result.metrics.placedItemCount,
      unplacedItemCount: result.metrics.unplacedItemCount,
      leftWeightKg: result.metrics.leftWeightKg,
      rightWeightKg: result.metrics.rightWeightKg,
      cabinSideWeightKg: result.metrics.cabinSideWeightKg,
      centerWeightKg: result.metrics.centerWeightKg,
      doorSideWeightKg: result.metrics.doorSideWeightKg,
      criticalAlertCount: result.metrics.criticalAlertCount,
      warningAlertCount: result.metrics.warningAlertCount,
      loadLengthMm: result.metrics.loadLengthMm,
      maxHeightMm: result.metrics.maxHeightMm,
      centerOfGravityX: result.metrics.centerOfGravityX,
      centerOfGravityY: result.metrics.centerOfGravityY,
      centerOfGravityZ: result.metrics.centerOfGravityZ,
    };
  }

  private async ensureOperationExists(operationId: string) {
    const operation = await this.prisma.loadOperation.findUnique({ where: { id: operationId }, select: { id: true } });
    if (!operation) {
      throw new NotFoundException('Operation not found.');
    }
  }

  private orientedDimensions(
    product: RecalculationPlan['placedItems'][number]['product'],
    rotationDeg: number,
    currentItem: Pick<RecalculationPlan['placedItems'][number], 'lengthMm' | 'widthMm' | 'heightMm'>,
  ) {
    const baseLengthMm = product.lengthMm ?? currentItem.lengthMm ?? 0;
    const baseWidthMm = product.widthMm ?? currentItem.widthMm ?? 0;
    const heightMm = product.heightMm ?? currentItem.heightMm ?? 0;
    const isQuarterTurn = Math.abs(rotationDeg / 90) % 2 === 1;

    return {
      lengthMm: isQuarterTurn ? baseWidthMm : baseLengthMm,
      widthMm: isQuarterTurn ? baseLengthMm : baseWidthMm,
      heightMm,
    };
  }

  private zoneForItem(plan: RecalculationPlan, item: Pick<RecalculationPlan['placedItems'][number], 'xMm' | 'yMm' | 'lengthMm' | 'widthMm'>) {
    const truck = plan.operation.truck;
    if (!truck) return null;

    const centerX = item.xMm + (item.lengthMm ?? 0) / 2;
    const centerY = item.yMm + (item.widthMm ?? 0) / 2;
    const zone = truck.zones.find((candidate) => {
      const bounds = this.zoneBounds(candidate, truck.lengthMm ?? 0, truck.widthMm ?? 0);
      return centerX >= bounds.startXMm && centerX <= bounds.endXMm && centerY >= bounds.startYMm && centerY <= bounds.endYMm;
    });

    return zone?.id ?? null;
  }

  private zoneTypeForItem(plan: RecalculationPlan, item: Pick<RecalculationPlan['placedItems'][number], 'xMm' | 'yMm' | 'lengthMm' | 'widthMm'>) {
    const truck = plan.operation.truck;
    const centerX = item.xMm + (item.lengthMm ?? 0) / 2;
    const centerY = item.yMm + (item.widthMm ?? 0) / 2;
    const zone = truck?.zones.find((candidate) => {
      const bounds = this.zoneBounds(candidate, truck.lengthMm ?? 0, truck.widthMm ?? 0);
      return centerX >= bounds.startXMm && centerX <= bounds.endXMm && centerY >= bounds.startYMm && centerY <= bounds.endYMm;
    });
    if (zone) return zone.type;

    const truckLengthMm = truck?.lengthMm ?? 0;
    if (truckLengthMm <= 0) return TruckZoneType.CENTER;
    if (centerX <= truckLengthMm / 3) return TruckZoneType.CABIN_SIDE;
    if (centerX >= (truckLengthMm / 3) * 2) return TruckZoneType.DOOR_SIDE;
    return TruckZoneType.CENTER;
  }

  private recalculatePlan(plan: RecalculationPlan, placedItems: RecalculationPlan['placedItems']) {
    const truck = plan.operation.truck;
    if (!truck) {
      throw new BadRequestException('Loading plan operation must have a truck before manual adjustment.');
    }
    if (!truck.lengthMm || !truck.widthMm || !truck.heightMm) {
      throw new BadRequestException('Truck length, width, and height are required for manual adjustment validation.');
    }

    const alerts: RecalculatedAlert[] = plan.unplaced.map((item) => ({
      productId: item.productId,
      severity: AlertSeverity.CRITICAL,
      type: AlertType.UNPLACED_ITEM,
      message: `Product ${item.product.code} unit ${item.unitIndex} was not placed: ${item.message ?? item.reason}`,
    }));

    const truckBounds: Bounds = { startXMm: 0, endXMm: truck.lengthMm, startYMm: 0, endYMm: truck.widthMm };
    for (const item of placedItems) {
      const lengthMm = item.lengthMm ?? 0;
      const widthMm = item.widthMm ?? 0;
      const heightMm = item.heightMm ?? 0;
      if (!isWithinBounds({ xMm: item.xMm, yMm: item.yMm, lengthMm, widthMm }, truckBounds) || item.zMm + heightMm > truck.heightMm) {
        alerts.push({
          productId: item.productId,
          placedItemId: item.id,
          severity: AlertSeverity.CRITICAL,
          type: AlertType.OUT_OF_BOUNDS,
          message: `Product ${item.product.code} unit ${item.unitIndex} is outside truck bounds.`,
        });
      }
    }

    for (let index = 0; index < placedItems.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < placedItems.length; otherIndex += 1) {
        const item = placedItems[index];
        const other = placedItems[otherIndex];
        const xyOverlap = overlaps(
          { xMm: item.xMm, yMm: item.yMm, lengthMm: item.lengthMm ?? 0, widthMm: item.widthMm ?? 0 },
          { xMm: other.xMm, yMm: other.yMm, lengthMm: other.lengthMm ?? 0, widthMm: other.widthMm ?? 0 },
        );
        const zOverlap = item.zMm < other.zMm + (other.heightMm ?? 0) && other.zMm < item.zMm + (item.heightMm ?? 0);
        if (xyOverlap && zOverlap) {
          alerts.push({
            productId: item.productId,
            placedItemId: item.id,
            severity: AlertSeverity.CRITICAL,
            type: AlertType.OVERLAP,
            message: `Product ${item.product.code} unit ${item.unitIndex} overlaps ${other.product.code} unit ${other.unitIndex}.`,
          });
          alerts.push({
            productId: other.productId,
            placedItemId: other.id,
            severity: AlertSeverity.CRITICAL,
            type: AlertType.OVERLAP,
            message: `Product ${other.product.code} unit ${other.unitIndex} overlaps ${item.product.code} unit ${item.unitIndex}.`,
          });
        }
      }
    }

    const placedWeightKg = placedItems.reduce((sum, item) => sum + (decimalToNumber(item.product.weightKg) ?? 0), 0);
    const unplacedWeightKg = plan.unplaced.reduce((sum, item) => sum + (decimalToNumber(item.product.weightKg) ?? 0), 0);
    const totalWeightKg = placedWeightKg + unplacedWeightKg;

    if (truck.maxPayloadKg !== null && totalWeightKg > Number(truck.maxPayloadKg)) {
      alerts.push({
        severity: AlertSeverity.CRITICAL,
        type: AlertType.MAX_WEIGHT_EXCEEDED,
        message: `Total load ${totalWeightKg.toFixed(3)}kg exceeds truck payload ${Number(truck.maxPayloadKg).toFixed(3)}kg.`,
      });
    }

    const leftWeightKg = this.sideWeight(placedItems, truck.widthMm, 'left');
    const rightWeightKg = this.sideWeight(placedItems, truck.widthMm, 'right');
    const lateralWeightKg = leftWeightKg + rightWeightKg;
    if (lateralWeightKg > 0 && Math.abs(leftWeightKg - rightWeightKg) / lateralWeightKg > 0.2) {
      alerts.push({
        severity: AlertSeverity.WARNING,
        type: AlertType.WEIGHT_IMBALANCE,
        message: `Lateral load differs by more than 20%: left ${leftWeightKg.toFixed(3)}kg, right ${rightWeightKg.toFixed(3)}kg.`,
      });
    }

    const zoneWeights = placedItems.reduce(
      (sum, item) => {
        const weightKg = decimalToNumber(item.product.weightKg) ?? 0;
        const zoneType = this.zoneTypeForItem(plan, item);
        return {
          cabin: sum.cabin + (zoneType === TruckZoneType.CABIN_SIDE ? weightKg : 0),
          center: sum.center + (zoneType === TruckZoneType.CENTER ? weightKg : 0),
          door: sum.door + (zoneType === TruckZoneType.DOOR_SIDE ? weightKg : 0),
        };
      },
      { cabin: 0, center: 0, door: 0 },
    );
    const usedVolumeM3 = placedItems.reduce(
      (sum, item) => sum + ((item.lengthMm ?? 0) * (item.widthMm ?? 0) * (item.heightMm ?? 0)) / 1_000_000_000,
      0,
    );
    const truckVolumeM3 = (truck.lengthMm * truck.widthMm * truck.heightMm) / 1_000_000_000;
    const weightMoments = placedItems.reduce(
      (sum, item) => {
        const weightKg = decimalToNumber(item.product.weightKg) ?? 0;
        return {
          x: sum.x + (item.xMm + (item.lengthMm ?? 0) / 2) * weightKg,
          y: sum.y + (item.yMm + (item.widthMm ?? 0) / 2) * weightKg,
          z: sum.z + (item.zMm + (item.heightMm ?? 0) / 2) * weightKg,
        };
      },
      { x: 0, y: 0, z: 0 },
    );

    return {
      alerts,
      metrics: {
        totalWeightKg,
        placedWeightKg,
        unplacedWeightKg,
        usedVolumeM3,
        volumeUtilizationPct: truckVolumeM3 > 0 ? (usedVolumeM3 / truckVolumeM3) * 100 : 0,
        placedItemCount: placedItems.length,
        unplacedItemCount: plan.unplaced.length,
        leftWeightKg,
        rightWeightKg,
        cabinSideWeightKg: zoneWeights.cabin,
        centerWeightKg: zoneWeights.center,
        doorSideWeightKg: zoneWeights.door,
        criticalAlertCount: alerts.filter((alert) => alert.severity === AlertSeverity.CRITICAL).length,
        warningAlertCount: alerts.filter((alert) => alert.severity === AlertSeverity.WARNING).length,
        loadLengthMm: placedItems.reduce((max, item) => Math.max(max, item.xMm + (item.lengthMm ?? 0)), 0),
        maxHeightMm: placedItems.reduce((max, item) => Math.max(max, item.zMm + (item.heightMm ?? 0)), 0),
        centerOfGravityX: placedWeightKg > 0 ? weightMoments.x / placedWeightKg : undefined,
        centerOfGravityY: placedWeightKg > 0 ? weightMoments.y / placedWeightKg : undefined,
        centerOfGravityZ: placedWeightKg > 0 ? weightMoments.z / placedWeightKg : undefined,
      },
    };
  }

  private zoneBounds(zone: RecalculationTruckZone, truckLengthMm: number, truckWidthMm: number): Bounds {
    return {
      startXMm: zone.startXMm ?? 0,
      endXMm: zone.endXMm ?? truckLengthMm,
      startYMm: zone.startYMm ?? 0,
      endYMm: zone.endYMm ?? truckWidthMm,
    };
  }

  private sideWeight(placedItems: RecalculationPlan['placedItems'], truckWidth: number, side: 'left' | 'right') {
    const centerY = truckWidth / 2;
    return placedItems.reduce((sum, item) => {
      const itemCenterY = item.yMm + (item.widthMm ?? 0) / 2;
      const weightKg = decimalToNumber(item.product.weightKg) ?? 0;
      if (side === 'left' && itemCenterY <= centerY) return sum + weightKg;
      if (side === 'right' && itemCenterY > centerY) return sum + weightKg;
      return sum;
    }, 0);
  }

  private toDto(plan: LoadingPlanWithRelations) {
    return {
      id: plan.id,
      operationId: plan.operationId,
      operationCode: plan.operation.code,
      operationStatus: plan.operation.status,
      version: plan.version,
      planStatus: plan.status,
      loadingMethod: plan.method,
      isCurrent: plan.isCurrent,
      notes: plan.notes,
      approvedAt: plan.approvedAt,
      placedItems: plan.placedItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        unitIndex: item.unitIndex,
        productCode: item.product.code,
        productName: item.product.description ?? item.product.code,
        productFamily: item.product.family,
        destinationId: item.product.destinationId,
        destinationName: item.product.destination?.name,
        truckZoneId: item.truckZoneId,
        zoneType: item.truckZone?.type,
        xMm: item.xMm,
        yMm: item.yMm,
        zMm: item.zMm,
        rotationDeg: item.rotationDeg,
        lengthMm: item.lengthMm,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        locked: item.locked,
        manuallyAdjusted: item.manuallyAdjusted,
      })),
      unplacedItems: plan.unplaced.map((item) => ({
        id: item.id,
        productId: item.productId,
        unitIndex: item.unitIndex,
        productCode: item.product.code,
        productName: item.product.description ?? item.product.code,
        productFamily: item.product.family,
        destinationId: item.product.destinationId,
        destinationName: item.product.destination?.name,
        reason: item.reason,
        message: item.message,
      })),
      steps: plan.steps,
      alerts: plan.alerts.map((alert) => ({
        id: alert.id,
        productId: alert.productId,
        placedItemId: alert.placedItemId,
        severity: alert.severity,
        type: alert.type,
        message: alert.message,
        createdAt: alert.createdAt,
      })),
      metrics: plan.metrics
        ? {
            totalWeightKg: decimalToNumber(plan.metrics.totalWeightKg),
            placedWeightKg: decimalToNumber(plan.metrics.placedWeightKg),
            unplacedWeightKg: decimalToNumber(plan.metrics.unplacedWeightKg),
            usedVolumeM3: decimalToNumber(plan.metrics.usedVolumeM3),
            volumeUtilizationPct: decimalToNumber(plan.metrics.volumeUtilizationPct),
            placedItemCount: plan.metrics.placedItemCount,
            unplacedItemCount: plan.metrics.unplacedItemCount,
            leftWeightKg: decimalToNumber(plan.metrics.leftWeightKg),
            rightWeightKg: decimalToNumber(plan.metrics.rightWeightKg),
            cabinSideWeightKg: decimalToNumber(plan.metrics.cabinSideWeightKg),
            centerWeightKg: decimalToNumber(plan.metrics.centerWeightKg),
            doorSideWeightKg: decimalToNumber(plan.metrics.doorSideWeightKg),
            criticalAlertCount: plan.metrics.criticalAlertCount,
            warningAlertCount: plan.metrics.warningAlertCount,
            loadLengthMm: plan.metrics.loadLengthMm,
            maxHeightMm: plan.metrics.maxHeightMm,
            centerOfGravityX: decimalToNumber(plan.metrics.centerOfGravityX),
            centerOfGravityY: decimalToNumber(plan.metrics.centerOfGravityY),
            centerOfGravityZ: decimalToNumber(plan.metrics.centerOfGravityZ),
          }
        : null,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      alertCounts: {
        critical: plan.alerts.filter((alert) => alert.severity === AlertSeverity.CRITICAL).length,
        warning: plan.alerts.filter((alert) => alert.severity === AlertSeverity.WARNING).length,
      },
    };
  }

  private toReportDto(plan: ReportPlanWithRelations) {
    return {
      operation: {
        id: plan.operation.id,
        code: plan.operation.code,
        status: plan.operation.status,
        name: plan.operation.name,
        notes: plan.operation.notes,
        scheduledAt: plan.operation.scheduledAt,
        createdAt: plan.operation.createdAt,
        updatedAt: plan.operation.updatedAt,
      },
      truck: plan.operation.truck
        ? {
            ...plan.operation.truck,
            maxPayloadKg: decimalToNumber(plan.operation.truck.maxPayloadKg),
            zones: plan.operation.truck.zones.map((zone) => ({
              ...zone,
              maxWeightKg: decimalToNumber(zone.maxWeightKg),
            })),
          }
        : null,
      destinations: plan.operation.destinations,
      products: plan.operation.products.map((product) => ({
        ...product,
        weightKg: decimalToNumber(product.weightKg),
        destinationName: product.destination?.name,
      })),
      plan: this.toDto(plan),
    };
  }

  private unitKey(productId: string, unitIndex: number) {
    return `${productId}:${unitIndex}`;
  }
}

function decimalToNumber(value: Decimalish) {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}
