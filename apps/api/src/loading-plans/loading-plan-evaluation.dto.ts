import { AlertSeverity, AlertType } from '@prisma/client';

const BASE_SCORE = 1000;
const HARD_VIOLATION_PENALTY = 250;
const UNPLACED_ITEM_PENALTY = 200;
const WARNING_PENALTY = 50;
const LOAD_LENGTH_DIVISOR = 1000;

interface EvaluationMetricsInput {
  placedItemCount?: number | null;
  unplacedItemCount?: number | null;
  loadLengthMm?: number | null;
}

interface EvaluationAlertInput {
  severity: AlertSeverity;
  type: AlertType;
  message: string;
}

export function buildLoadingPlanEvaluationDto(metrics: EvaluationMetricsInput, alerts: EvaluationAlertInput[]) {
  const hardViolationCount = alerts.filter((alert) => alert.severity === AlertSeverity.CRITICAL).length;
  const penalties = [];
  const unplacedItemCount = metrics.unplacedItemCount ?? 0;
  const loadLengthMm = metrics.loadLengthMm ?? 0;

  if (unplacedItemCount > 0) {
    penalties.push({ code: 'unplaced-items', points: unplacedItemCount * UNPLACED_ITEM_PENALTY, message: `${unplacedItemCount} item(s) were not placed.` });
  }

  if (alerts.some((alert) => alert.severity === AlertSeverity.WARNING && alert.type === AlertType.WEIGHT_IMBALANCE)) {
    penalties.push({ code: 'weight-imbalance', points: WARNING_PENALTY, message: 'Weight imbalance warning present.' });
  }

  if (loadLengthMm > 0) {
    penalties.push({ code: 'load-length', points: Math.floor(loadLengthMm / LOAD_LENGTH_DIVISOR), message: `Load uses ${loadLengthMm}mm of truck length.` });
  }

  const softPenaltyTotal = penalties.reduce((sum, penalty) => sum + penalty.points, 0);
  const placedReward = (metrics.placedItemCount ?? 0) * 25;
  const score = Math.max(0, BASE_SCORE + placedReward - hardViolationCount * HARD_VIOLATION_PENALTY - softPenaltyTotal);

  return { score, hardViolationCount, softPenaltyTotal, penalties };
}

export function buildLoadingPlanCandidateDiagnosticsDto<T>(diagnostics?: T) {
  if (!diagnostics) return undefined;

  return diagnostics;
}
