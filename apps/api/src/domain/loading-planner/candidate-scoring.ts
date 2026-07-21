import type { ProductFamily as SharedProductFamily, SoftPreference, TruckZoneType as SharedTruckZoneType } from '@camiones/shared';
import type { ProductFamilyValue, TruckZoneTypeValue } from './loading-planner.types';

/**
 * solver-soft-preferences Phase 2 — pure per-zone candidate scorer, consumed
 * by `chooseZoneCandidate` (Phase 4) only when `softPreferences` is
 * non-empty. Never filters: it only RANKS candidates that already passed
 * every hard constraint in `evaluateCandidate`/`applyConstraints`. Every
 * term is normalized to `[0,1]` and every divide-by-zero edge case is
 * guarded so the combined score is never `NaN`. Framework-free (covered by
 * `no-llm-imports.spec.ts`).
 */

export interface CandidateScoringContext {
  candidateZone: TruckZoneTypeValue;
  candidateZMm: number;
  candidateTier: number;
  candidateYMm: number;
  candidateWidthMm: number;
  unit: {
    code: string;
    family: ProductFamilyValue;
    fragile: boolean;
    weightKg: number;
  };
  /** Lateral weight already on each side of the truck, BEFORE this candidate is added. */
  leftWeightKg: number;
  rightWeightKg: number;
  truckWidthMm: number;
  /** Truck ceiling height — normalizes LOW_CENTER_OF_GRAVITY. */
  maxZMm: number;
  /** Highest configured tier level — normalizes FRAGILE_UPPER_TIER. */
  maxTier: number;
}

export interface LateralBalanceInputs {
  leftWeightKg: number;
  rightWeightKg: number;
  unitWeightKg: number;
  itemCenterYMm: number;
  truckWidthMm: number;
}

/**
 * Lateral (left/right) weight imbalance ratio in `[0,1]` that results from
 * adding a candidate to whichever side its center falls on. `0` = perfectly
 * balanced, `1` = fully imbalanced. Guards `total <= 0` (no weight anywhere)
 * to `0`, never `NaN`. Mirrors the inline helper `chooseZoneCandidate` used
 * before this extraction (loading-agent-llm soft rule 1b.13).
 */
export function imbalanceOf(inputs: LateralBalanceInputs): number {
  const centerY = inputs.truckWidthMm / 2;
  const onLeft = inputs.itemCenterYMm <= centerY;
  const left = inputs.leftWeightKg + (onLeft ? inputs.unitWeightKg : 0);
  const right = inputs.rightWeightKg + (onLeft ? 0 : inputs.unitWeightKg);
  const total = left + right;
  return total > 0 ? Math.abs(left - right) / total : 0;
}

function lateralBalanceTerm(ctx: CandidateScoringContext): number {
  const itemCenterYMm = ctx.candidateYMm + ctx.candidateWidthMm / 2;
  const ratio = imbalanceOf({
    leftWeightKg: ctx.leftWeightKg,
    rightWeightKg: ctx.rightWeightKg,
    unitWeightKg: ctx.unit.weightKg,
    itemCenterYMm,
    truckWidthMm: ctx.truckWidthMm,
  });
  return 1 - ratio;
}

function lowCenterOfGravityTerm(ctx: CandidateScoringContext): number {
  if (ctx.maxZMm <= 0) return 1;
  return 1 - ctx.candidateZMm / ctx.maxZMm;
}

function fragileUpperTierTerm(ctx: CandidateScoringContext): number {
  if (!ctx.unit.fragile || ctx.maxTier <= 0) return 0;
  return ctx.candidateTier / ctx.maxTier;
}

/** Bridges the shared (LLM-facing) `TruckZoneType` enum to the prisma-derived solver value — same string, different nominal type (see `constraint-application.ts`'s `toZoneValue`). */
function toZoneValue(zone: SharedTruckZoneType): TruckZoneTypeValue {
  return zone as unknown as TruckZoneTypeValue;
}

/** Bridges the shared (LLM-facing) `ProductFamily` enum to the prisma-derived solver value. */
function toFamilyValue(family: SharedProductFamily): ProductFamilyValue {
  return family as unknown as ProductFamilyValue;
}

/** A `ZONE_AFFINITY` preference applies to a unit when unscoped, or when its `productCode`/`family` scope matches. */
function appliesToUnit(pref: Extract<SoftPreference, { type: 'ZONE_AFFINITY' }>, unit: CandidateScoringContext['unit']): boolean {
  if (pref.productCode === undefined && pref.family === undefined) return true;
  if (pref.productCode !== undefined && pref.productCode === unit.code) return true;
  if (pref.family !== undefined && toFamilyValue(pref.family) === unit.family) return true;
  return false;
}

function zoneAffinityTerm(pref: Extract<SoftPreference, { type: 'ZONE_AFFINITY' }>, ctx: CandidateScoringContext): number {
  if (!appliesToUnit(pref, ctx.unit)) return 0;
  return ctx.candidateZone === toZoneValue(pref.zone) ? 1 : 0;
}

function termFor(pref: SoftPreference, ctx: CandidateScoringContext): number {
  switch (pref.type) {
    case 'LATERAL_BALANCE':
      return lateralBalanceTerm(ctx);
    case 'LOW_CENTER_OF_GRAVITY':
      return lowCenterOfGravityTerm(ctx);
    case 'FRAGILE_UPPER_TIER':
      return fragileUpperTierTerm(ctx);
    case 'ZONE_AFFINITY':
      return zoneAffinityTerm(pref, ctx);
  }
}

/**
 * `Σ (weight × normalizedTerm)` across every preference, each term in
 * `[0,1]`. Higher score wins (argmax in Phase 4's `chooseZoneCandidate`).
 * An empty `preferences` array scores `0` for every candidate (never called
 * on the bypass path — see design.md's "Scorer bypass is the default").
 */
export function scoreZoneCandidate(ctx: CandidateScoringContext, preferences: SoftPreference[]): number {
  return preferences.reduce((sum, pref) => sum + pref.weight * termFor(pref, ctx), 0);
}
