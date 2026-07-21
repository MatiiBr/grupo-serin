import { describe, expect, it } from 'vitest';
import { buildTiers, tierHeightsExceedTruck } from './tiers';
import { PlannerTruckTierInput } from './loading-planner.types';

describe('buildTiers', () => {
  it('synthesizes 3 default levels bounded by truck height when the truck has no configured tiers', () => {
    const tiers = buildTiers([], 2400);

    expect(tiers).toEqual([
      { level: 1, maxHeightMm: 2400, maxWeightKg: undefined },
      { level: 2, maxHeightMm: 2400, maxWeightKg: undefined },
      { level: 3, maxHeightMm: 2400, maxWeightKg: undefined },
    ]);
  });

  it('leaves an explicitly configured tier list untouched, sorted by level', () => {
    const configured: PlannerTruckTierInput[] = [
      { id: 'tier-b', level: 2, maxHeightMm: 900, maxWeightKg: 4000 },
      { id: 'tier-a', level: 1, maxHeightMm: 600 },
    ];

    const tiers = buildTiers(configured, 2400);

    expect(tiers).toEqual([
      { id: 'tier-a', level: 1, maxHeightMm: 600 },
      { id: 'tier-b', level: 2, maxHeightMm: 900, maxWeightKg: 4000 },
    ]);
  });

  it('omits maxHeightMm on synthesized tiers when the truck has no known height', () => {
    const tiers = buildTiers([], 0);

    expect(tiers[0]).toEqual({ level: 1, maxHeightMm: undefined, maxWeightKg: undefined });
  });
});

describe('tierHeightsExceedTruck', () => {
  it('rejects an explicitly configured tier stack whose summed maxHeightMm exceeds truck.heightMm', () => {
    const configured: PlannerTruckTierInput[] = [
      { id: 'tier-a', level: 1, maxHeightMm: 900 },
      { id: 'tier-b', level: 2, maxHeightMm: 900 },
      { id: 'tier-c', level: 3, maxHeightMm: 900 },
    ];

    expect(tierHeightsExceedTruck(configured, 2400)).toBe(true);
  });

  it('accepts an explicitly configured tier stack whose summed maxHeightMm fits within truck.heightMm', () => {
    const configured: PlannerTruckTierInput[] = [
      { id: 'tier-a', level: 1, maxHeightMm: 800 },
      { id: 'tier-b', level: 2, maxHeightMm: 800 },
      { id: 'tier-c', level: 3, maxHeightMm: 800 },
    ];

    expect(tierHeightsExceedTruck(configured, 2400)).toBe(false);
  });

  it('never flags synthesized default tiers (no explicit configuration) as exceeding truck height', () => {
    // buildTiers([], 2400) synthesizes 3 tiers each capped at the FULL truck
    // height (a single tier may use the whole height) — summing them would
    // trivially "exceed" truck height, but that is not a real misconfiguration.
    expect(tierHeightsExceedTruck([], 2400)).toBe(false);
  });

  it('does not flag when the truck has no known height', () => {
    const configured: PlannerTruckTierInput[] = [
      { id: 'tier-a', level: 1, maxHeightMm: 900 },
      { id: 'tier-b', level: 2, maxHeightMm: 900 },
    ];

    expect(tierHeightsExceedTruck(configured, 0)).toBe(false);
  });
});
