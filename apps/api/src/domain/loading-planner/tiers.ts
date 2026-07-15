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
