import { ReservationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateReservationLine, canFeedWarehousePreparation, releaseReservation, resolveReservationStatus } from './reservation-lifecycle';

describe('reservation lifecycle', () => {
  it('reserves only available quantity and leaves shortages visible for reprocess', () => {
    const line = calculateReservationLine({ requestedQuantity: 10, availableQuantity: 6 });

    expect(line).toEqual({ requestedQuantity: 10, availableQuantity: 6, reservedQuantity: 6, unreservedQuantity: 4 });
  });

  it('marks a reservation partial when any requested quantity is unmet', () => {
    const status = resolveReservationStatus([
      calculateReservationLine({ requestedQuantity: 10, availableQuantity: 10 }),
      calculateReservationLine({ requestedQuantity: 5, availableQuantity: 2 }),
    ]);

    expect(status).toEqual({ status: ReservationStatus.PARTIAL, requestedQuantity: 15, reservedQuantity: 12, unreservedQuantity: 3 });
  });

  it('allows warehouse preparation only for fully reserved demand', () => {
    expect(canFeedWarehousePreparation({ status: ReservationStatus.RESERVED, unreservedQuantity: 0 })).toBe(true);
    expect(canFeedWarehousePreparation({ status: ReservationStatus.PARTIAL, unreservedQuantity: 3 })).toBe(false);
    expect(canFeedWarehousePreparation({ status: ReservationStatus.RELEASED, unreservedQuantity: 0 })).toBe(false);
  });

  it('keeps release as an explicit reservation transition', () => {
    expect(releaseReservation()).toMatchObject({ status: ReservationStatus.RELEASED });
  });
});
