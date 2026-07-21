import { ProductFamily as SharedProductFamily, TruckZoneType as SharedTruckZoneType, type SoftPreference } from '@camiones/shared';
import { ProductFamily, TruckZoneType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { imbalanceOf, scoreZoneCandidate, type CandidateScoringContext } from './candidate-scoring';

/**
 * solver-soft-preferences Phase 2 — pure `scoreZoneCandidate(ctx, prefs)`.
 * Each term is normalized to [0,1]; the combined score is `Σ weight × term`
 * and must never be `NaN`, even under the documented divide-by-zero guards.
 * Pure domain, no mocks — framework-free (covered by `no-llm-imports.spec.ts`).
 */

function createContext(overrides: Partial<CandidateScoringContext> = {}): CandidateScoringContext {
  return {
    candidateZone: TruckZoneType.CENTER,
    candidateZMm: 0,
    candidateTier: 1,
    candidateYMm: 0,
    candidateWidthMm: 500,
    unit: { code: 'P-1', family: ProductFamily.GENERIC_PACKAGE, fragile: false, weightKg: 500 },
    leftWeightKg: 0,
    rightWeightKg: 0,
    truckWidthMm: 2000,
    maxZMm: 2500,
    maxTier: 3,
    ...overrides,
  };
}

function pref(overrides: Partial<SoftPreference> & { type: SoftPreference['type'] }): SoftPreference {
  return { weight: 1, ...overrides } as SoftPreference;
}

describe('imbalanceOf', () => {
  it('returns 0 (perfectly balanced) when adding the candidate equalizes both sides', () => {
    // left already 500kg; candidate (500kg) lands on the right (itemCenterY > centerY) -> left=500, right=500
    expect(imbalanceOf({ leftWeightKg: 500, rightWeightKg: 0, unitWeightKg: 500, itemCenterYMm: 1500, truckWidthMm: 2000 })).toBe(0);
  });

  it('returns 1 (fully imbalanced) when the candidate stacks entirely onto the already-heavier side', () => {
    // left already 1000kg; candidate (500kg) also lands on the left -> left=1500, right=0
    expect(imbalanceOf({ leftWeightKg: 1000, rightWeightKg: 0, unitWeightKg: 500, itemCenterYMm: 500, truckWidthMm: 2000 })).toBe(1);
  });

  it('guards total <= 0 (no weight anywhere) by returning 0, never NaN', () => {
    expect(imbalanceOf({ leftWeightKg: 0, rightWeightKg: 0, unitWeightKg: 0, itemCenterYMm: 500, truckWidthMm: 2000 })).toBe(0);
  });
});

describe('scoreZoneCandidate — LATERAL_BALANCE term', () => {
  it('scores 1 (weight 1) when the candidate perfectly balances the truck', () => {
    const ctx = createContext({ leftWeightKg: 500, rightWeightKg: 0, candidateYMm: 1500, unit: { ...createContext().unit, weightKg: 500 } });
    expect(scoreZoneCandidate(ctx, [pref({ type: 'LATERAL_BALANCE', weight: 1 })])).toBe(1);
  });

  it('scores 0 (weight 1) when the candidate fully imbalances the truck', () => {
    const ctx = createContext({ leftWeightKg: 1000, rightWeightKg: 0, candidateYMm: 0, unit: { ...createContext().unit, weightKg: 500 } });
    expect(scoreZoneCandidate(ctx, [pref({ type: 'LATERAL_BALANCE', weight: 1 })])).toBe(0);
  });

  it('guards total weight <= 0 by scoring 1 (neutral), never NaN', () => {
    const ctx = createContext({ leftWeightKg: 0, rightWeightKg: 0, unit: { ...createContext().unit, weightKg: 0 } });
    const score = scoreZoneCandidate(ctx, [pref({ type: 'LATERAL_BALANCE', weight: 1 })]);
    expect(score).toBe(1);
    expect(Number.isNaN(score)).toBe(false);
  });
});

describe('scoreZoneCandidate — LOW_CENTER_OF_GRAVITY term', () => {
  it('scores 1 (weight 1) for a floor-level candidate (zMm = 0)', () => {
    const ctx = createContext({ candidateZMm: 0, maxZMm: 2500 });
    expect(scoreZoneCandidate(ctx, [pref({ type: 'LOW_CENTER_OF_GRAVITY', weight: 1 })])).toBe(1);
  });

  it('scores 0 (weight 1) for a candidate resting at the truck ceiling (zMm = maxZMm)', () => {
    const ctx = createContext({ candidateZMm: 2500, maxZMm: 2500 });
    expect(scoreZoneCandidate(ctx, [pref({ type: 'LOW_CENTER_OF_GRAVITY', weight: 1 })])).toBe(0);
  });

  it('scores an intermediate height proportionally', () => {
    const ctx = createContext({ candidateZMm: 625, maxZMm: 2500 });
    expect(scoreZoneCandidate(ctx, [pref({ type: 'LOW_CENTER_OF_GRAVITY', weight: 1 })])).toBe(0.75);
  });

  it('guards maxZMm <= 0 by scoring 1 (neutral), never NaN', () => {
    const ctx = createContext({ candidateZMm: 500, maxZMm: 0 });
    const score = scoreZoneCandidate(ctx, [pref({ type: 'LOW_CENTER_OF_GRAVITY', weight: 1 })]);
    expect(score).toBe(1);
    expect(Number.isNaN(score)).toBe(false);
  });
});

describe('scoreZoneCandidate — FRAGILE_UPPER_TIER term', () => {
  it('scores 1 (weight 1) for a fragile unit on the topmost configured tier', () => {
    const ctx = createContext({ unit: { ...createContext().unit, fragile: true }, candidateTier: 3, maxTier: 3 });
    expect(scoreZoneCandidate(ctx, [pref({ type: 'FRAGILE_UPPER_TIER', weight: 1 })])).toBe(1);
  });

  it('scores 0 for a non-fragile unit even on the topmost tier', () => {
    const ctx = createContext({ unit: { ...createContext().unit, fragile: false }, candidateTier: 3, maxTier: 3 });
    expect(scoreZoneCandidate(ctx, [pref({ type: 'FRAGILE_UPPER_TIER', weight: 1 })])).toBe(0);
  });

  it('scores proportionally for a fragile unit at a middle tier', () => {
    const ctx = createContext({ unit: { ...createContext().unit, fragile: true }, candidateTier: 1, maxTier: 3 });
    expect(scoreZoneCandidate(ctx, [pref({ type: 'FRAGILE_UPPER_TIER', weight: 1 })])).toBeCloseTo(1 / 3);
  });

  it('guards maxTier <= 0 (fragile unit) by scoring 0, never NaN', () => {
    const ctx = createContext({ unit: { ...createContext().unit, fragile: true }, candidateTier: 1, maxTier: 0 });
    const score = scoreZoneCandidate(ctx, [pref({ type: 'FRAGILE_UPPER_TIER', weight: 1 })]);
    expect(score).toBe(0);
    expect(Number.isNaN(score)).toBe(false);
  });
});

describe('scoreZoneCandidate — ZONE_AFFINITY term', () => {
  it('scores 1 for an unscoped preference whose zone matches the candidate zone', () => {
    const ctx = createContext({ candidateZone: TruckZoneType.CABIN_SIDE });
    expect(scoreZoneCandidate(ctx, [pref({ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CABIN_SIDE, weight: 1 })])).toBe(1);
  });

  it('scores 0 for an unscoped preference whose zone does not match', () => {
    const ctx = createContext({ candidateZone: TruckZoneType.DOOR_SIDE });
    expect(scoreZoneCandidate(ctx, [pref({ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CABIN_SIDE, weight: 1 })])).toBe(0);
  });

  it('scores 1 when scoped to the matching productCode and the zone matches', () => {
    const ctx = createContext({ candidateZone: TruckZoneType.CENTER, unit: { ...createContext().unit, code: 'P-42' } });
    expect(
      scoreZoneCandidate(ctx, [pref({ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CENTER, productCode: 'P-42', weight: 1 })]),
    ).toBe(1);
  });

  it('scores 0 when scoped to a different productCode, even if the zone matches', () => {
    const ctx = createContext({ candidateZone: TruckZoneType.CENTER, unit: { ...createContext().unit, code: 'P-1' } });
    expect(
      scoreZoneCandidate(ctx, [pref({ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CENTER, productCode: 'P-42', weight: 1 })]),
    ).toBe(0);
  });

  it('scores 1 when scoped to the matching family and the zone matches', () => {
    const ctx = createContext({ candidateZone: TruckZoneType.DOOR_SIDE, unit: { ...createContext().unit, family: ProductFamily.SHEET } });
    expect(
      scoreZoneCandidate(ctx, [pref({ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.DOOR_SIDE, family: SharedProductFamily.SHEET, weight: 1 })]),
    ).toBe(1);
  });
});

describe('scoreZoneCandidate — weighted combination', () => {
  it('sums Σ(weight × term) across multiple preferences', () => {
    const ctx = createContext({ candidateZMm: 0, maxZMm: 2500, candidateZone: TruckZoneType.CABIN_SIDE });
    const score = scoreZoneCandidate(ctx, [
      pref({ type: 'LOW_CENTER_OF_GRAVITY', weight: 2 }), // term 1 -> 2
      pref({ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CABIN_SIDE, weight: 3 }), // term 1 -> 3
    ]);
    expect(score).toBe(5);
  });

  it('a higher weight lets its term dominate a competing lower-weighted term', () => {
    // Candidate A: perfect CoG (favored by LOW_CENTER_OF_GRAVITY weight 5), wrong zone (ZONE_AFFINITY weight 1 -> 0)
    const candidateA = createContext({ candidateZMm: 0, maxZMm: 2500, candidateZone: TruckZoneType.DOOR_SIDE });
    // Candidate B: worst CoG (term 0), correct zone (ZONE_AFFINITY term 1)
    const candidateB = createContext({ candidateZMm: 2500, maxZMm: 2500, candidateZone: TruckZoneType.CABIN_SIDE });
    const preferences: SoftPreference[] = [
      pref({ type: 'LOW_CENTER_OF_GRAVITY', weight: 5 }),
      pref({ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CABIN_SIDE, weight: 1 }),
    ];

    const scoreA = scoreZoneCandidate(candidateA, preferences);
    const scoreB = scoreZoneCandidate(candidateB, preferences);

    expect(scoreA).toBeGreaterThan(scoreB); // 5*1 + 1*0 = 5  >  5*0 + 1*1 = 1
  });

  it('equal weights combine additively, favoring the higher SUMMED score, not either lone favorite', () => {
    // Candidate A: strongly favored by LOW_CENTER_OF_GRAVITY (term 1), mildly by ZONE_AFFINITY (term 0)
    const candidateA = createContext({ candidateZMm: 0, maxZMm: 2500, candidateZone: TruckZoneType.DOOR_SIDE });
    // Candidate B: mildly favored by LOW_CENTER_OF_GRAVITY (term 0.6), strongly by ZONE_AFFINITY (term 1)
    const candidateB = createContext({ candidateZMm: 1000, maxZMm: 2500, candidateZone: TruckZoneType.CABIN_SIDE });
    const preferences: SoftPreference[] = [
      pref({ type: 'LOW_CENTER_OF_GRAVITY', weight: 1 }),
      pref({ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CABIN_SIDE, weight: 1 }),
    ];

    const scoreA = scoreZoneCandidate(candidateA, preferences); // 1*1 + 1*0 = 1
    const scoreB = scoreZoneCandidate(candidateB, preferences); // 1*0.6 + 1*1 = 1.6

    expect(scoreB).toBeGreaterThan(scoreA);
  });

  it('a zero-weight preference contributes 0 and never sways the outcome', () => {
    const ctx = createContext({ candidateZMm: 2500, maxZMm: 2500, candidateZone: TruckZoneType.DOOR_SIDE });
    const score = scoreZoneCandidate(ctx, [
      pref({ type: 'LOW_CENTER_OF_GRAVITY', weight: 0 }), // term 0, weight 0 -> 0
      pref({ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CABIN_SIDE, weight: 0 }), // term 0, weight 0 -> 0
    ]);
    expect(score).toBe(0);
  });

  it('never produces NaN even when every divide-by-zero guard is triggered at once', () => {
    const ctx = createContext({
      candidateZMm: 100,
      maxZMm: 0,
      maxTier: 0,
      candidateTier: 1,
      unit: { ...createContext().unit, fragile: true, weightKg: 0 },
      leftWeightKg: 0,
      rightWeightKg: 0,
    });
    const score = scoreZoneCandidate(ctx, [
      pref({ type: 'LOW_CENTER_OF_GRAVITY', weight: 1 }),
      pref({ type: 'LATERAL_BALANCE', weight: 1 }),
      pref({ type: 'FRAGILE_UPPER_TIER', weight: 1 }),
      pref({ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CENTER, weight: 1 }),
    ]);
    expect(Number.isNaN(score)).toBe(false);
  });

  it('returns 0 for an empty preferences array', () => {
    expect(scoreZoneCandidate(createContext(), [])).toBe(0);
  });
});
