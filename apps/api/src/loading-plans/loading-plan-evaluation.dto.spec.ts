import { AlertSeverity, AlertType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildLoadingPlanEvaluationDto } from './loading-plan-evaluation.dto';

describe('buildLoadingPlanEvaluationDto', () => {
  it('builds score and penalties from persisted metrics and alerts', () => {
    const evaluation = buildLoadingPlanEvaluationDto(
      { placedItemCount: 3, unplacedItemCount: 1, loadLengthMm: 2400 },
      [{ severity: AlertSeverity.WARNING, type: AlertType.WEIGHT_IMBALANCE, message: 'Balance warning' }],
    );

    expect(evaluation.score).toBeGreaterThan(0);
    expect(evaluation.hardViolationCount).toBe(0);
    expect(evaluation.softPenaltyTotal).toBeGreaterThan(0);
    expect(evaluation.penalties).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unplaced-items', points: 200 }),
      expect.objectContaining({ code: 'weight-imbalance', points: 50 }),
      expect.objectContaining({ code: 'load-length', points: 2 }),
    ]));
  });

  it('counts critical alerts as hard violations', () => {
    const evaluation = buildLoadingPlanEvaluationDto(
      { placedItemCount: 0, unplacedItemCount: 1, loadLengthMm: 0 },
      [{ severity: AlertSeverity.CRITICAL, type: AlertType.UNPLACED_ITEM, message: 'Not placed' }],
    );

    expect(evaluation.hardViolationCount).toBe(1);
    expect(evaluation.score).toBeLessThan(1000);
  });
});
