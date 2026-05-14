import { PreparationStatus, ReservationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculatePreparationLine, canFeedLoading, canStartPreparation, resolvePreparationStatus } from './preparation-lifecycle';

describe('preparation lifecycle', () => {
  it('allows preparation only from fully reserved demand', () => {
    expect(canStartPreparation({ status: ReservationStatus.RESERVED, unreservedQuantity: 0 })).toBe(true);
    expect(canStartPreparation({ status: ReservationStatus.PARTIAL, unreservedQuantity: 2 })).toBe(false);
    expect(canStartPreparation({ status: ReservationStatus.RELEASED, unreservedQuantity: 0 })).toBe(false);
  });

  it('marks preparation ready when all reserved material is ready', () => {
    const summary = resolvePreparationStatus([
      calculatePreparationLine({ reservedQuantity: 4, readyQuantity: 4 }),
      calculatePreparationLine({ reservedQuantity: 3, readyQuantity: 3 }),
    ]);

    expect(summary).toEqual({ status: PreparationStatus.READY, reservedQuantity: 7, readyQuantity: 7, discrepancyQuantity: 0 });
    expect(canFeedLoading(summary)).toBe(true);
  });

  it('blocks loading readiness when discrepancies exist or quantities are missing', () => {
    const summary = resolvePreparationStatus([
      calculatePreparationLine({ reservedQuantity: 5, readyQuantity: 3, discrepancyQuantity: 1 }),
      calculatePreparationLine({ reservedQuantity: 2, readyQuantity: 2 }),
    ]);

    expect(summary).toEqual({ status: PreparationStatus.DISCREPANCY, reservedQuantity: 7, readyQuantity: 5, discrepancyQuantity: 2 });
    expect(canFeedLoading(summary)).toBe(false);
  });
});
