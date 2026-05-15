import { describe, expect, it } from 'vitest';
import { buildPlacedItemAdjustmentPayload } from './planner-ui';

describe('planner item adjustment form mapping', () => {
  it('maps numeric adjustment values to integers', () => {
    expect(buildPlacedItemAdjustmentPayload({ xMm: '10', yMm: '20', zMm: '30', rotationDeg: '90', locked: false })).toEqual({
      xMm: 10,
      yMm: 20,
      zMm: 30,
      rotationDeg: 90,
      locked: false,
    });
  });

  it('maps the locked checkbox value to true', () => {
    expect(buildPlacedItemAdjustmentPayload({ xMm: '1', yMm: '2', zMm: '3', rotationDeg: '180', locked: true })).toEqual({
      xMm: 1,
      yMm: 2,
      zMm: 3,
      rotationDeg: 180,
      locked: true,
    });
  });
});
