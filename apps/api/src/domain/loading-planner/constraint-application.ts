import type { ConstraintSet, HardRule, ProductFamily as SharedProductFamily, TruckZoneType as SharedTruckZoneType } from '@camiones/shared';
import { LoadingPlannerInput, PlannerProductInput, ProductFamilyValue, TruckZoneTypeValue } from './loading-planner.types';

/**
 * loading-agent-llm Phase 3 — pure pre-pass that applies a validated
 * `ConstraintSet` onto a CLONE of `LoadingPlannerInput`, before handing it
 * to the unchanged `HeuristicLoadingPlanner.generate()`. Total: every
 * `HardRule` maps onto an existing (or Phase-1-additive) per-product field
 * per the mutation table in design.md. Never mutates the input in place.
 * Framework-free (no LLM/provider imports); covered by
 * `no-llm-imports.spec.ts`.
 *
 * `ConstraintSet.hardRules` references `@camiones/shared`'s `TruckZoneType`/
 * `ProductFamily` enums (the LLM-facing contract), while `PlannerProductInput`
 * uses `@prisma/client`-derived template-literal types (the solver-facing
 * contract). Both enums are generated from the same Prisma schema values, so
 * they are always runtime-identical strings — `toZoneValue`/`toFamilyValue`
 * below bridge the two nominal types explicitly, once, in one place.
 */

const ALL_ZONE_TYPES: TruckZoneTypeValue[] = ['CABIN_SIDE', 'CENTER', 'DOOR_SIDE'];

function toZoneValue(zone: SharedTruckZoneType): TruckZoneTypeValue {
  return zone as unknown as TruckZoneTypeValue;
}

function toFamilyValue(family: SharedProductFamily): ProductFamilyValue {
  return family as unknown as ProductFamilyValue;
}

function cloneInput(input: LoadingPlannerInput): LoadingPlannerInput {
  return {
    truck: {
      ...input.truck,
      zones: input.truck.zones.map((zone) => ({ ...zone })),
      tiers: input.truck.tiers.map((tier) => ({ ...tier })),
    },
    destinations: input.destinations.map((destination) => ({ ...destination })),
    products: input.products.map((product) => ({ ...product })),
  };
}

/** Most-restrictive-wins: no prior restriction = the new one; otherwise the intersection (never throws, may be empty). */
function intersectZones(current: TruckZoneTypeValue[] | undefined, restriction: TruckZoneTypeValue[]): TruckZoneTypeValue[] {
  if (!current) return [...restriction];
  return current.filter((zone) => restriction.includes(zone));
}

function applyProductRule(product: PlannerProductInput, rule: Exclude<HardRule, { type: 'FAMILY_PLACEMENT_BAN' }>): void {
  switch (rule.type) {
    case 'STACKING_PROHIBITION':
      product.stackable = false;
      return;
    case 'FRAGILE_ON_TOP':
      product.fragile = true;
      return;
    case 'ZONE_RESTRICTION':
      // Confines the product TO this zone (opposite of PRODUCT_ZONE_BAN).
      product.allowedZones = intersectZones(product.allowedZones, [toZoneValue(rule.zone)]);
      return;
    case 'TIER_RESTRICTION':
      // Most-restrictive-wins: the lower maxTier caps.
      product.maxTier = product.maxTier !== undefined ? Math.min(product.maxTier, rule.maxTier) : rule.maxTier;
      return;
    case 'PRODUCT_ZONE_BAN':
      // Bans the product FROM this zone (opposite of ZONE_RESTRICTION) — it
      // may go anywhere else. Same allZones-minus-zone mechanism as
      // applyFamilyBan, scoped to a single product instead of a family.
      product.allowedZones = intersectZones(product.allowedZones, zonesExcluding(rule.zone));
      return;
  }
}

function zonesExcluding(bannedZone: SharedTruckZoneType): TruckZoneTypeValue[] {
  const banned = toZoneValue(bannedZone);
  return ALL_ZONE_TYPES.filter((zone) => zone !== banned);
}

function applyFamilyBan(products: PlannerProductInput[], family: SharedProductFamily, bannedZone: SharedTruckZoneType): void {
  const remaining = zonesExcluding(bannedZone);
  const targetFamily = toFamilyValue(family);

  for (const product of products) {
    if (product.family !== targetFamily) continue;
    product.allowedZones = intersectZones(product.allowedZones, remaining);
  }
}

/**
 * Applies every hard rule in `constraintSet` onto a clone of `input`. Total
 * and side-effect-free on its arguments: `input` is never mutated, and an
 * empty `hardRules` list still returns a fresh clone (identity by value).
 */
export function applyConstraints(input: LoadingPlannerInput, constraintSet: ConstraintSet): LoadingPlannerInput {
  const cloned = cloneInput(input);
  const productsByCode = new Map(cloned.products.map((product) => [product.code, product]));

  for (const rule of constraintSet.hardRules) {
    if (rule.type === 'FAMILY_PLACEMENT_BAN') {
      applyFamilyBan(cloned.products, rule.family, rule.zone);
      continue;
    }

    const product = productsByCode.get(rule.productCode);
    if (!product) continue;
    applyProductRule(product, rule);
  }

  return cloned;
}
