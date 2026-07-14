import { AlertSeverity, AlertType, LoadingMethod, ProductFamily, TruckZoneType, UnplacedReason } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { LoadingPlanEvaluator } from './loading-plan-evaluator';
import type { LoadingPlannerInput, LoadingPlannerResult, PlannerPlacedItem } from './loading-planner.types';

const input: LoadingPlannerInput = {
  truck: {
    id: 'truck-1',
    loadingMethod: LoadingMethod.REAR,
    maxPayloadKg: 10_000,
    lengthMm: 9000,
    widthMm: 2000,
    heightMm: 2500,
    zones: [
      { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 3000, startYMm: 0, endYMm: 2000, maxWeightKg: 1000 },
      { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 3000, endXMm: 6000, startYMm: 0, endYMm: 2000 },
      { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 6000, endXMm: 9000, startYMm: 0, endYMm: 2000 },
    ],
  },
  destinations: [{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }],
  products: [{ id: 'product-1', code: 'P-1', family: ProductFamily.GENERIC_PACKAGE, destinationId: 'destination-1', quantity: 1, weightKg: 500, lengthMm: 1000, widthMm: 500, heightMm: 400, stackable: false, rotationAllowed: true }],
};

function placed(overrides: Partial<PlannerPlacedItem> = {}): PlannerPlacedItem {
  return {
    productId: 'product-1',
    unitIndex: 1,
    truckZoneId: 'zone-cabin',
    zoneType: TruckZoneType.CABIN_SIDE,
    xMm: 0,
    yMm: 0,
    zMm: 0,
    rotationDeg: 0,
    lengthMm: 1000,
    widthMm: 500,
    heightMm: 400,
    weightKg: 500,
    sequence: 1,
    ...overrides,
  };
}

function result(overrides: Partial<Omit<LoadingPlannerResult, 'evaluation'>> = {}): Omit<LoadingPlannerResult, 'evaluation'> {
  return {
    loadingLayers: [],
    placedItems: [placed()],
    unplacedItems: [],
    steps: [],
    alerts: [],
    metrics: {
      totalWeightKg: 500,
      placedWeightKg: 500,
      unplacedWeightKg: 0,
      usedVolumeM3: 0.2,
      volumeUtilizationPct: 1,
      placedItemCount: 1,
      unplacedItemCount: 0,
      leftWeightKg: 500,
      rightWeightKg: 0,
      cabinSideWeightKg: 500,
      centerWeightKg: 0,
      doorSideWeightKg: 0,
      criticalAlertCount: 0,
      warningAlertCount: 0,
      loadLengthMm: 1000,
      maxHeightMm: 400,
    },
    axleLoadSnapshots: [],
    ...overrides,
  };
}

describe('LoadingPlanEvaluator', () => {
  it('returns a positive score with inspectable penalties for a valid placed plan', () => {
    const evaluation = new LoadingPlanEvaluator().evaluate(input, result());

    expect(evaluation.score).toBeGreaterThan(0);
    expect(evaluation.hardViolationCount).toBe(0);
    expect(evaluation.softPenaltyTotal).toBeGreaterThanOrEqual(0);
    expect(evaluation.penalties.every((penalty) => penalty.code && penalty.points > 0 && penalty.message)).toBe(true);
  });

  it('adds a critical alert when a zone exceeds max weight', () => {
    const evaluation = new LoadingPlanEvaluator().evaluate(input, result({ placedItems: [placed({ weightKg: 1200 })] }));

    expect(evaluation.hardViolationCount).toBe(1);
    expect(evaluation.alerts).toContainEqual(expect.objectContaining({
      severity: AlertSeverity.CRITICAL,
      type: AlertType.MAX_WEIGHT_EXCEEDED,
      message: 'La zona cabina carga 1200.0 kg y supera el maximo de zona 1000.0 kg.',
    }));
  });

  it('scores warning conditions lower than a comparable balanced plan', () => {
    const balanced = new LoadingPlanEvaluator().evaluate(input, result({
      placedItems: [placed({ yMm: 0, weightKg: 250 }), placed({ productId: 'product-2', yMm: 1500, weightKg: 250, sequence: 2 })],
      metrics: { ...result().metrics, leftWeightKg: 250, rightWeightKg: 250, placedWeightKg: 500 },
    }));
    const imbalanced = new LoadingPlanEvaluator().evaluate(input, result({
      placedItems: [placed({ weightKg: 500 })],
      alerts: [{ severity: AlertSeverity.WARNING, type: AlertType.WEIGHT_IMBALANCE, message: 'Lateral load differs by more than 20%.' }],
    }));

    expect(imbalanced.score).toBeLessThan(balanced.score);
    expect(imbalanced.penalties).toContainEqual(expect.objectContaining({ code: 'weight-imbalance' }));
  });

  it('counts existing unplaced item alerts as hard violations', () => {
    const evaluation = new LoadingPlanEvaluator().evaluate(input, result({
      placedItems: [],
      unplacedItems: [{ productId: 'product-1', unitIndex: 1, reason: UnplacedReason.NO_AVAILABLE_SPACE, message: 'No space.' }],
      alerts: [{ productId: 'product-1', severity: AlertSeverity.CRITICAL, type: AlertType.UNPLACED_ITEM, message: 'No space.' }],
    }));

    expect(evaluation.hardViolationCount).toBe(1);
    expect(evaluation.score).toBeLessThan(1000);
  });

  it('keeps a comparable nonzero score for invalid plans that place significant load', () => {
    const placedItems = Array.from({ length: 8 }, (_, index) => placed({
      productId: `placed-${index + 1}`,
      unitIndex: 1,
      xMm: index * 500,
      sequence: index + 1,
    }));
    const unplacedItems = Array.from({ length: 4 }, (_, index) => ({
      productId: `unplaced-${index + 1}`,
      unitIndex: 1,
      reason: UnplacedReason.NO_AVAILABLE_SPACE,
      message: 'No space.',
    }));

    const evaluation = new LoadingPlanEvaluator().evaluate(input, result({
      placedItems,
      unplacedItems,
      alerts: unplacedItems.map((item) => ({
        productId: item.productId,
        severity: AlertSeverity.CRITICAL,
        type: AlertType.UNPLACED_ITEM,
        message: item.message,
      })),
      metrics: { ...result().metrics, placedItemCount: 8, unplacedItemCount: 4, placedWeightKg: 4000, unplacedWeightKg: 2000, loadLengthMm: 4000 },
    }));

    expect(evaluation.hardViolationCount).toBeGreaterThanOrEqual(4);
    expect(evaluation.score).toBeGreaterThan(0);
    expect(evaluation.score).toBeLessThan(1000);
  });
});
