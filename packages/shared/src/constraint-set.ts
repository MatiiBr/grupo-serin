import { ProductFamily, TruckZoneType } from './enums';

/**
 * Autonomous loading plan — the hard-rule contract the LLM agent layer
 * produces (`AgentPort.planConstraints`) and the API-layer validation gate +
 * constraint pre-pass consume. Pure and framework-free (no class-validator
 * here), so it is safe to import from `apps/web` as well; the class-validator
 * DTO that structurally validates a raw LLM response against this shape lives
 * in the `planning-agent` module.
 *
 * The LLM only ever emits a `ConstraintSet`; it never computes geometry. The
 * deterministic engine (multi-candidate search + `LoadingPlanEvaluator`) still
 * guarantees the plan, so a constraint set can only SHAPE the search, never
 * bypass the physical checks.
 *
 * Note on soft objectives: low center of gravity / lateral balance / etc. are
 * expressed as `LoadingPlanEvaluator` penalty weights on the engine side, NOT
 * as a second declarative contract here — there is one scorer.
 */

export const HARD_RULE_TYPES = [
  'STACKING_PROHIBITION',
  'FRAGILE_ON_TOP',
  'ZONE_RESTRICTION',
  'TIER_RESTRICTION',
  'FAMILY_PLACEMENT_BAN',
  'PRODUCT_ZONE_BAN',
] as const;

export type HardRuleType = (typeof HARD_RULE_TYPES)[number];

export interface StackingProhibitionRule {
  type: 'STACKING_PROHIBITION';
  productCode: string;
}

export interface FragileOnTopRule {
  type: 'FRAGILE_ON_TOP';
  productCode: string;
}

export interface ZoneRestrictionRule {
  type: 'ZONE_RESTRICTION';
  productCode: string;
  zone: TruckZoneType;
}

export interface TierRestrictionRule {
  type: 'TIER_RESTRICTION';
  productCode: string;
  maxTier: number;
}

export interface FamilyPlacementBanRule {
  type: 'FAMILY_PLACEMENT_BAN';
  family: ProductFamily;
  zone: TruckZoneType;
}

/**
 * Bans a single product FROM a zone (the product may go anywhere else).
 * Mirrors `FamilyPlacementBanRule` but scoped to `productCode` instead of
 * `family`. Distinct from `ZoneRestrictionRule`, which CONFINES a product TO
 * a zone — the two are semantic opposites and must not be conflated (the LLM
 * system prompt disambiguates them explicitly).
 */
export interface ProductZoneBanRule {
  type: 'PRODUCT_ZONE_BAN';
  productCode: string;
  zone: TruckZoneType;
}

export type HardRule =
  | StackingProhibitionRule
  | FragileOnTopRule
  | ZoneRestrictionRule
  | TierRestrictionRule
  | FamilyPlacementBanRule
  | ProductZoneBanRule;

export interface ConstraintSet {
  version: 1;
  hardRules: HardRule[];
  notes?: string;
}
