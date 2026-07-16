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

export type HardRule = StackingProhibitionRule | FragileOnTopRule | ZoneRestrictionRule | TierRestrictionRule | FamilyPlacementBanRule;

export interface ConstraintSet {
  version: 1;
  hardRules: HardRule[];
  notes?: string;
}
