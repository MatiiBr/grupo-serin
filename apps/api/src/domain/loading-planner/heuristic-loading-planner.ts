import { AlertSeverity, AlertType, TruckZoneType, UnplacedReason } from '@prisma/client';
import { Bounds, isWithinBounds, overlaps, Rect } from './geometry';
import { LoadingPlanEvaluator } from './loading-plan-evaluator';
import {
  LoadingPlannerInput,
  LoadingPlannerResult,
  PlannerPlacedItem,
  PlannerProductInput,
  PlannerTruckZoneInput,
} from './loading-planner.types';

interface Unit extends PlannerProductInput {
  unitIndex: number;
  destinationOrder: number;
  targetZone: TruckZoneType;
}

interface ZoneCandidate {
  id?: string;
  type: TruckZoneType;
  bounds: Bounds;
}

interface CandidateResult {
  index: number;
  result: LoadingPlannerResult;
}

const ZONE_ORDER = [TruckZoneType.CABIN_SIDE, TruckZoneType.CENTER, TruckZoneType.DOOR_SIDE];

export class HeuristicLoadingPlanner {
  private readonly evaluator = new LoadingPlanEvaluator();

  generate(input: LoadingPlannerInput): LoadingPlannerResult {
    const truckLength = input.truck.lengthMm ?? 0;
    const truckWidth = input.truck.widthMm ?? 0;
    const truckHeight = input.truck.heightMm ?? 0;
    const zones = this.buildZones(input.truck.zones, truckLength, truckWidth);
    const units = this.expandUnits(input.products, input.destinations);

    return this.selectBestCandidate(this.candidateOrderings(units).map((candidateUnits, index) => ({
      index,
      result: this.generateCandidate(input, candidateUnits, zones, truckHeight),
    })));
  }

  private generateCandidate(input: LoadingPlannerInput, units: Unit[], zones: ZoneCandidate[], truckHeight: number): LoadingPlannerResult {
    const placedItems: PlannerPlacedItem[] = [];
    const unplacedItems: LoadingPlannerResult['unplacedItems'] = [];

    for (const unit of units) {
      const placement = this.placeUnit(unit, zones, placedItems, truckHeight);

      if (placement) {
        placedItems.push({ ...placement, sequence: placedItems.length + 1 });
        continue;
      }

      unplacedItems.push({
        productId: unit.id,
        unitIndex: unit.unitIndex,
        reason: this.hasRequiredDimensions(unit) ? UnplacedReason.NO_AVAILABLE_SPACE : UnplacedReason.MANUAL_REVIEW_REQUIRED,
        message: this.hasRequiredDimensions(unit)
          ? 'No floor space available in the target zone or fallback zones.'
          : 'Product has missing or invalid dimensions for automatic planning.',
      });
    }

    const steps = placedItems.map((item) => ({
      sequence: item.sequence,
      productId: item.productId,
      unitIndex: item.unitIndex,
      title: `Load unit ${item.unitIndex}`,
      instructions: `Place product ${item.productId} in ${item.zoneType} at x=${item.xMm}mm, y=${item.yMm}mm.`,
    }));
    const baseAlerts = this.buildAlerts(input, placedItems, unplacedItems);
    const metrics = this.buildMetrics(input, placedItems, unplacedItems, baseAlerts);
    const baseResult = { placedItems, unplacedItems, steps, alerts: baseAlerts, metrics };
    const evaluation = this.evaluator.evaluate(input, baseResult);
    const alerts = [...baseAlerts, ...evaluation.alerts];
    const finalMetrics = {
      ...metrics,
      criticalAlertCount: alerts.filter((alert) => alert.severity === AlertSeverity.CRITICAL).length,
      warningAlertCount: alerts.filter((alert) => alert.severity === AlertSeverity.WARNING).length,
    };

    return { placedItems, unplacedItems, steps, alerts, metrics: finalMetrics, evaluation };
  }

  private expandUnits(products: PlannerProductInput[], destinations: LoadingPlannerInput['destinations']) {
    const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));
    const orders = destinations.map((destination) => destination.unloadingOrder).sort((a, b) => a - b);
    const units: Unit[] = [];

    for (const product of products) {
      const destinationOrder = product.destinationId ? destinationById.get(product.destinationId)?.unloadingOrder ?? 0 : 0;
      for (let unitIndex = 1; unitIndex <= product.quantity; unitIndex += 1) {
        units.push({
          ...product,
          unitIndex,
          destinationOrder,
          targetZone: this.targetZoneForOrder(destinationOrder, orders),
        });
      }
    }

    return this.sortCurrent(units);
  }

  private candidateOrderings(units: Unit[]) {
    return this.uniqueOrderings([
      this.sortCurrent(units),
      this.sortLightFirst(units),
      this.sortVolumeFirst(units),
      this.sortTargetZone(units),
    ]);
  }

  private sortCurrent(units: Unit[]) {
    return [...units].sort((a, b) => {
      const orderDiff = b.destinationOrder - a.destinationOrder;
      if (orderDiff !== 0) return orderDiff;

      const weightDiff = (b.weightKg ?? 0) - (a.weightKg ?? 0);
      if (weightDiff !== 0) return weightDiff;

      return this.volumeMm3(b) - this.volumeMm3(a);
    });
  }

  private sortLightFirst(units: Unit[]) {
    return [...units].sort((a, b) => {
      const orderDiff = b.destinationOrder - a.destinationOrder;
      if (orderDiff !== 0) return orderDiff;

      const weightDiff = (a.weightKg ?? 0) - (b.weightKg ?? 0);
      if (weightDiff !== 0) return weightDiff;

      return this.volumeMm3(a) - this.volumeMm3(b);
    });
  }

  private sortVolumeFirst(units: Unit[]) {
    return [...units].sort((a, b) => {
      const orderDiff = b.destinationOrder - a.destinationOrder;
      if (orderDiff !== 0) return orderDiff;

      const volumeDiff = this.volumeMm3(b) - this.volumeMm3(a);
      if (volumeDiff !== 0) return volumeDiff;

      return (b.weightKg ?? 0) - (a.weightKg ?? 0);
    });
  }

  private sortTargetZone(units: Unit[]) {
    return [...units].sort((a, b) => {
      const zoneDiff = ZONE_ORDER.indexOf(a.targetZone) - ZONE_ORDER.indexOf(b.targetZone);
      if (zoneDiff !== 0) return zoneDiff;

      return this.sortCurrent([a, b])[0] === a ? -1 : 1;
    });
  }

  private uniqueOrderings(orderings: Unit[][]) {
    const seen = new Set<string>();
    return orderings.filter((ordering) => {
      const key = ordering.map((unit) => `${unit.id}:${unit.unitIndex}`).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private selectBestCandidate(candidates: CandidateResult[]) {
    return candidates.reduce((best, candidate) => (this.isCandidateBetter(candidate, best) ? candidate : best)).result;
  }

  private isCandidateBetter(candidate: CandidateResult, best: CandidateResult) {
    const candidateEvaluation = candidate.result.evaluation;
    const bestEvaluation = best.result.evaluation;
    if (candidateEvaluation.score !== bestEvaluation.score) return candidateEvaluation.score > bestEvaluation.score;
    if (candidateEvaluation.hardViolationCount !== bestEvaluation.hardViolationCount) return candidateEvaluation.hardViolationCount < bestEvaluation.hardViolationCount;
    if (candidate.result.placedItems.length !== best.result.placedItems.length) return candidate.result.placedItems.length > best.result.placedItems.length;
    return candidate.index < best.index;
  }

  private buildZones(truckZones: PlannerTruckZoneInput[], truckLength: number, truckWidth: number): ZoneCandidate[] {
    const fallbackLength = Math.floor(truckLength / 3);

    return ZONE_ORDER.map((type, index) => {
      const zone = truckZones.find((candidate) => candidate.type === type);
      const startXMm = zone?.startXMm ?? index * fallbackLength;
      const endXMm = zone?.endXMm ?? (index === ZONE_ORDER.length - 1 ? truckLength : (index + 1) * fallbackLength);

      return {
        id: zone?.id,
        type,
        bounds: {
          startXMm,
          endXMm,
          startYMm: zone?.startYMm ?? 0,
          endYMm: zone?.endYMm ?? truckWidth,
        },
      };
    });
  }

  private targetZoneForOrder(order: number, orders: number[]) {
    if (orders.length === 0 || order === 0) return TruckZoneType.CENTER;

    const index = orders.indexOf(order);
    if (index < 0) return TruckZoneType.CENTER;

    const ratio = index / Math.max(orders.length - 1, 1);
    if (ratio <= 0.33) return TruckZoneType.DOOR_SIDE;
    if (ratio >= 0.67) return TruckZoneType.CABIN_SIDE;
    return TruckZoneType.CENTER;
  }

  private placeUnit(unit: Unit, zones: ZoneCandidate[], placedItems: PlannerPlacedItem[], truckHeight: number) {
    if (!this.hasRequiredDimensions(unit)) return undefined;
    if (truckHeight > 0 && (unit.heightMm ?? 0) > truckHeight) return undefined;

    const targetZone = zones.find((zone) => zone.type === unit.targetZone);
    const fallbackZones = zones.filter((zone) => zone.type !== unit.targetZone);
    const candidateZones = targetZone ? [targetZone, ...fallbackZones] : fallbackZones;
    const orientations = this.orientations(unit);

    for (const zone of candidateZones) {
      for (const orientation of orientations) {
        const placement = this.findFloorPosition(zone.bounds, orientation, placedItems);
        if (!placement) continue;

        return {
          productId: unit.id,
          unitIndex: unit.unitIndex,
          truckZoneId: zone.id,
          zoneType: zone.type,
          xMm: placement.xMm,
          yMm: placement.yMm,
          zMm: 0,
          rotationDeg: orientation.rotationDeg,
          lengthMm: orientation.lengthMm,
          widthMm: orientation.widthMm,
          heightMm: unit.heightMm ?? 0,
          weightKg: unit.weightKg ?? 0,
          sequence: 0,
        };
      }
    }

    return undefined;
  }

  private findFloorPosition(bounds: Bounds, item: { lengthMm: number; widthMm: number }, placedItems: PlannerPlacedItem[]) {
    const yCandidates = [bounds.startYMm, ...placedItems.map((item) => item.yMm + item.widthMm)].sort((a, b) => a - b);
    const xCandidates = [bounds.startXMm, ...placedItems.map((item) => item.xMm + item.lengthMm)].sort((a, b) => a - b);

    for (const yMm of yCandidates) {
      for (const xMm of xCandidates) {
        const rect = { xMm, yMm, lengthMm: item.lengthMm, widthMm: item.widthMm };
        if (!isWithinBounds(rect, bounds)) continue;
        if (placedItems.some((placed) => overlaps(rect, this.toRect(placed)))) continue;

        return { xMm, yMm };
      }
    }

    return undefined;
  }

  private orientations(unit: Unit) {
    const lengthMm = unit.lengthMm ?? 0;
    const widthMm = unit.widthMm ?? 0;
    const orientations = [{ lengthMm, widthMm, rotationDeg: 0 }];

    if (unit.rotationAllowed !== false && lengthMm !== widthMm) {
      orientations.push({ lengthMm: widthMm, widthMm: lengthMm, rotationDeg: 90 });
    }

    return orientations;
  }

  private buildAlerts(
    input: LoadingPlannerInput,
    placedItems: PlannerPlacedItem[],
    unplacedItems: LoadingPlannerResult['unplacedItems'],
  ) {
    const alerts: LoadingPlannerResult['alerts'] = unplacedItems.map((item) => ({
      productId: item.productId,
      severity: AlertSeverity.CRITICAL,
      type: AlertType.UNPLACED_ITEM,
      message: `Product ${item.productId} unit ${item.unitIndex} was not placed: ${item.message}`,
    }));
    const totalWeightKg = this.totalInputWeight(input.products);

    if (input.truck.maxPayloadKg !== undefined && totalWeightKg > input.truck.maxPayloadKg) {
      alerts.push({
        severity: AlertSeverity.CRITICAL,
        type: AlertType.MAX_WEIGHT_EXCEEDED,
        message: `Total load ${totalWeightKg.toFixed(3)}kg exceeds truck payload ${input.truck.maxPayloadKg.toFixed(3)}kg.`,
      });
    }

    const leftWeightKg = this.sideWeight(placedItems, input.truck.widthMm ?? 0, 'left');
    const rightWeightKg = this.sideWeight(placedItems, input.truck.widthMm ?? 0, 'right');
    const lateralWeightKg = leftWeightKg + rightWeightKg;
    if (lateralWeightKg > 0 && Math.abs(leftWeightKg - rightWeightKg) / lateralWeightKg > 0.2) {
      alerts.push({
        severity: AlertSeverity.WARNING,
        type: AlertType.WEIGHT_IMBALANCE,
        message: `Lateral load differs by more than 20%: left ${leftWeightKg.toFixed(3)}kg, right ${rightWeightKg.toFixed(3)}kg.`,
      });
    }

    const zoneWeights = this.zoneWeights(placedItems);
    const averageZoneWeight = (zoneWeights.cabin + zoneWeights.center + zoneWeights.door) / 3;
    if (averageZoneWeight > 0 && Math.max(zoneWeights.cabin, zoneWeights.center, zoneWeights.door) / averageZoneWeight > 1.6) {
      alerts.push({
        severity: AlertSeverity.WARNING,
        type: AlertType.WEIGHT_IMBALANCE,
        message: 'Zone load is concentrated in one third of the truck.',
      });
    }

    return alerts;
  }

  private buildMetrics(
    input: LoadingPlannerInput,
    placedItems: PlannerPlacedItem[],
    unplacedItems: LoadingPlannerResult['unplacedItems'],
    alerts: LoadingPlannerResult['alerts'],
  ) {
    const placedWeightKg = placedItems.reduce((sum, item) => sum + item.weightKg, 0);
    const totalWeightKg = this.totalInputWeight(input.products);
    const usedVolumeM3 = placedItems.reduce((sum, item) => sum + this.itemVolumeM3(item), 0);
    const truckVolumeM3 = ((input.truck.lengthMm ?? 0) * (input.truck.widthMm ?? 0) * (input.truck.heightMm ?? 0)) / 1_000_000_000;
    const zoneWeights = this.zoneWeights(placedItems);
    const weightMoments = placedItems.reduce(
      (sum, item) => ({
        x: sum.x + (item.xMm + item.lengthMm / 2) * item.weightKg,
        y: sum.y + (item.yMm + item.widthMm / 2) * item.weightKg,
        z: sum.z + (item.zMm + item.heightMm / 2) * item.weightKg,
      }),
      { x: 0, y: 0, z: 0 },
    );

    return {
      totalWeightKg,
      placedWeightKg,
      unplacedWeightKg: Math.max(totalWeightKg - placedWeightKg, 0),
      usedVolumeM3,
      volumeUtilizationPct: truckVolumeM3 > 0 ? (usedVolumeM3 / truckVolumeM3) * 100 : 0,
      placedItemCount: placedItems.length,
      unplacedItemCount: unplacedItems.length,
      leftWeightKg: this.sideWeight(placedItems, input.truck.widthMm ?? 0, 'left'),
      rightWeightKg: this.sideWeight(placedItems, input.truck.widthMm ?? 0, 'right'),
      cabinSideWeightKg: zoneWeights.cabin,
      centerWeightKg: zoneWeights.center,
      doorSideWeightKg: zoneWeights.door,
      criticalAlertCount: alerts.filter((alert) => alert.severity === AlertSeverity.CRITICAL).length,
      warningAlertCount: alerts.filter((alert) => alert.severity === AlertSeverity.WARNING).length,
      loadLengthMm: placedItems.reduce((max, item) => Math.max(max, item.xMm + item.lengthMm), 0),
      maxHeightMm: placedItems.reduce((max, item) => Math.max(max, item.zMm + item.heightMm), 0),
      centerOfGravityX: placedWeightKg > 0 ? weightMoments.x / placedWeightKg : undefined,
      centerOfGravityY: placedWeightKg > 0 ? weightMoments.y / placedWeightKg : undefined,
      centerOfGravityZ: placedWeightKg > 0 ? weightMoments.z / placedWeightKg : undefined,
    };
  }

  private hasRequiredDimensions(product: PlannerProductInput) {
    return (product.lengthMm ?? 0) > 0 && (product.widthMm ?? 0) > 0 && (product.heightMm ?? 0) > 0;
  }

  private totalInputWeight(products: PlannerProductInput[]) {
    return products.reduce((sum, product) => sum + (product.weightKg ?? 0) * product.quantity, 0);
  }

  private volumeMm3(product: PlannerProductInput) {
    return (product.lengthMm ?? 0) * (product.widthMm ?? 0) * (product.heightMm ?? 0);
  }

  private itemVolumeM3(item: { lengthMm: number; widthMm: number; heightMm: number }) {
    return (item.lengthMm * item.widthMm * item.heightMm) / 1_000_000_000;
  }

  private toRect(item: PlannerPlacedItem): Rect {
    return { xMm: item.xMm, yMm: item.yMm, lengthMm: item.lengthMm, widthMm: item.widthMm };
  }

  private sideWeight(placedItems: PlannerPlacedItem[], truckWidth: number, side: 'left' | 'right') {
    const centerY = truckWidth / 2;
    return placedItems.reduce((sum, item) => {
      const itemCenterY = item.yMm + item.widthMm / 2;
      if (side === 'left' && itemCenterY <= centerY) return sum + item.weightKg;
      if (side === 'right' && itemCenterY > centerY) return sum + item.weightKg;
      return sum;
    }, 0);
  }

  private zoneWeights(placedItems: PlannerPlacedItem[]) {
    return placedItems.reduce(
      (sum, item) => ({
        cabin: sum.cabin + (item.zoneType === TruckZoneType.CABIN_SIDE ? item.weightKg : 0),
        center: sum.center + (item.zoneType === TruckZoneType.CENTER ? item.weightKg : 0),
        door: sum.door + (item.zoneType === TruckZoneType.DOOR_SIDE ? item.weightKg : 0),
      }),
      { cabin: 0, center: 0, door: 0 },
    );
  }
}
