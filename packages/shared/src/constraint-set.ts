import { ProductFamily, TruckZoneType } from './enums';

/**
 * loading-agent-llm — hard-rule contract produced by `AgentPort.planConstraints`
 * and consumed by the API-layer validation gate + `applyConstraints` pure
 * pre-pass (see `apps/api/src/domain/loading-planner/constraint-application.ts`).
 * Pure, framework-free (no class-validator here) so it stays safe to import
 * from `apps/web` — the class-validator DTO that structurally validates a
 * raw LLM response against this shape lives in
 * `apps/api/src/planning-agent/dto/constraint-set.dto.ts`.
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
 * a zone — the two are semantic opposites and must not be conflated (see
 * `SYSTEM_PROMPT_HEADER` in `deepseek-json.adapter.ts` for the disambiguation
 * given to the LLM).
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

/**
 * solver-soft-preferences — declarative, weighted soft-objective contract
 * that RANKS candidates the solver already deemed hard-constraint-valid
 * (see `apps/api/src/domain/loading-planner/candidate-scoring.ts`). Mirrors
 * `HardRule`'s shape, but soft preferences never filter — only order —
 * candidates, so they can neither admit an invalid placement nor drop an
 * otherwise-placeable unit. Pure, framework-free (no class-validator here),
 * same split as `HardRule`: the DTO that structurally validates a raw LLM
 * response is deferred to the LLM-extraction follow-up change.
 */

export const SOFT_PREFERENCE_TYPES = ['LOW_CENTER_OF_GRAVITY', 'LATERAL_BALANCE', 'ZONE_AFFINITY', 'FRAGILE_UPPER_TIER'] as const;

export type SoftPreferenceType = (typeof SOFT_PREFERENCE_TYPES)[number];

export interface LowCenterOfGravityPreference {
  type: 'LOW_CENTER_OF_GRAVITY';
  weight: number;
}

export interface LateralBalancePreference {
  type: 'LATERAL_BALANCE';
  weight: number;
}

export interface ZoneAffinityPreference {
  type: 'ZONE_AFFINITY';
  productCode?: string;
  family?: ProductFamily;
  zone: TruckZoneType;
  weight: number;
}

export interface FragileUpperTierPreference {
  type: 'FRAGILE_UPPER_TIER';
  weight: number;
}

export type SoftPreference = LowCenterOfGravityPreference | LateralBalancePreference | ZoneAffinityPreference | FragileUpperTierPreference;

export interface ConstraintSet {
  version: 1;
  hardRules: HardRule[];
  softPreferences?: SoftPreference[];
  notes?: string;
}
