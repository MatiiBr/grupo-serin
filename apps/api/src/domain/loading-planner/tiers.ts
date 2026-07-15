import { PlannerTruckTierInput } from './loading-planner.types';

const DEFAULT_TIER_LEVELS = [1, 2, 3];

/**
 * Resolves the ordered list of vertical tiers a truck exposes to the planner.
 *
 * When the truck has no explicitly configured `TruckTier` rows, synthesizes
 * 3 default levels bounded only by the truck's overall height — mirrors the
 * existing `buildZones` fallback pattern so no tier data migration/backfill
 * is required for trucks created before the tier model existed.
 */
export function buildTiers(tiers: PlannerTruckTierInput[], truckHeightMm: number): PlannerTruckTierInput[] {
  if (tiers.length > 0) {
    return [...tiers].sort((a, b) => a.level - b.level);
  }

  return DEFAULT_TIER_LEVELS.map((level) => ({
    level,
    maxHeightMm: truckHeightMm > 0 ? truckHeightMm : undefined,
    maxWeightKg: undefined,
  }));
}

/**
 * Validates an EXPLICITLY configured tier stack against the truck's overall
 * height: the summed `maxHeightMm` of all configured tiers must not exceed
 * `truck.heightMm`.
 *
 * Deliberately only evaluates tiers the caller has actually configured
 * (`input.truck.tiers`, pre-`buildTiers`). Synthesized default tiers (see
 * `buildTiers`) each get the FULL truck height as their own cap — a single
 * tier may legitimately use the whole height — so summing synthesized tiers
 * would always "exceed" truck height and must never be treated as a
 * misconfiguration.
 */
export function tierHeightsExceedTruck(configuredTiers: PlannerTruckTierInput[], truckHeightMm: number): boolean {
  if (configuredTiers.length === 0 || truckHeightMm <= 0) {
    return false;
  }

  const summedHeightMm = configuredTiers.reduce((sum, tier) => sum + (tier.maxHeightMm ?? 0), 0);
  return summedHeightMm > truckHeightMm;
}
