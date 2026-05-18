import { AlertSeverity, AlertType } from '@prisma/client';
import type { LoadingPlannerInput, LoadingPlannerResult, PlannerAlert, PlannerEvaluation, PlannerEvaluationPenalty, TruckZoneTypeValue } from './loading-planner.types';

const BASE_SCORE = 1000;
const HARD_VIOLATION_PENALTY = 250;
const UNPLACED_ITEM_PENALTY = 200;
const WARNING_PENALTY = 50;
const LOAD_LENGTH_DIVISOR = 1000;

export class LoadingPlanEvaluator {
  evaluate(input: LoadingPlannerInput, result: Omit<LoadingPlannerResult, 'evaluation'>): PlannerEvaluation {
    const alerts = this.zoneMaxWeightAlerts(input, result);
    const hardViolationCount = result.alerts.filter((alert) => alert.severity === AlertSeverity.CRITICAL).length + alerts.length;
    const penalties = this.penalties(result);
    const softPenaltyTotal = penalties.reduce((sum, penalty) => sum + penalty.points, 0);
    const placedReward = result.placedItems.length * 25;
    const score = Math.max(0, BASE_SCORE + placedReward - hardViolationCount * HARD_VIOLATION_PENALTY - softPenaltyTotal);

    return {
      score,
      hardViolationCount,
      softPenaltyTotal,
      penalties,
      alerts,
    };
  }

  private zoneMaxWeightAlerts(input: LoadingPlannerInput, result: Omit<LoadingPlannerResult, 'evaluation'>): PlannerAlert[] {
    const zonesByType = new Map(input.truck.zones.map((zone) => [zone.type, zone]));
    const weightsByZone = result.placedItems.reduce((weights, item) => {
      weights.set(item.zoneType, (weights.get(item.zoneType) ?? 0) + item.weightKg);
      return weights;
    }, new Map<TruckZoneTypeValue, number>());

    return [...weightsByZone.entries()].flatMap(([zoneType, weightKg]) => {
      const zone = zonesByType.get(zoneType);
      if (zone?.maxWeightKg === undefined || weightKg <= zone.maxWeightKg) return [];

      return [{
        severity: AlertSeverity.CRITICAL,
        type: AlertType.MAX_WEIGHT_EXCEEDED,
        message: `La ${zoneTypeLabel(zoneType)} carga ${formatKg(weightKg)} y supera el maximo de zona ${formatKg(zone.maxWeightKg)}.`,
      }];
    });
  }

  private penalties(result: Omit<LoadingPlannerResult, 'evaluation'>): PlannerEvaluationPenalty[] {
    const penalties: PlannerEvaluationPenalty[] = [];

    if (result.unplacedItems.length > 0) {
      penalties.push({
        code: 'unplaced-items',
        points: result.unplacedItems.length * UNPLACED_ITEM_PENALTY,
        message: `${result.unplacedItems.length} item(s) were not placed.`,
      });
    }

    if (result.alerts.some((alert) => alert.severity === AlertSeverity.WARNING && alert.type === AlertType.WEIGHT_IMBALANCE)) {
      penalties.push({ code: 'weight-imbalance', points: WARNING_PENALTY, message: 'Weight imbalance warning present.' });
    }

    if (result.metrics.loadLengthMm > 0) {
      penalties.push({
        code: 'load-length',
        points: Math.floor(result.metrics.loadLengthMm / LOAD_LENGTH_DIVISOR),
        message: `Load uses ${result.metrics.loadLengthMm}mm of truck length.`,
      });
    }

    return penalties;
  }
}

function formatKg(value: number) {
  return `${value.toFixed(1)} kg`;
}

function zoneTypeLabel(zoneType: TruckZoneTypeValue) {
  const labels: Record<TruckZoneTypeValue, string> = {
    CABIN_SIDE: 'zona cabina',
    CENTER: 'zona central',
    DOOR_SIDE: 'zona puerta',
  };

  return labels[zoneType] ?? zoneType;
}
