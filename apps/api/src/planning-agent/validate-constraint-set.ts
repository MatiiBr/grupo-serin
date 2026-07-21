import 'reflect-metadata';
import type { HardRule } from '@camiones/shared';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ConstraintSetDto } from './dto/constraint-set.dto';
import type { CatalogContext } from './ports/agent.port';

/**
 * loading-agent-llm Phase 7 — validation gate. Sits between `AgentPort` and
 * `applyConstraints`. Runs the raw value an `AgentPort` implementation
 * resolved with (typed `ConstraintSet` at compile time, but re-validated
 * here as `unknown` at runtime — a mocked/misbehaving adapter can resolve
 * with anything) through two stages:
 *
 * 1. STRUCTURAL — `plainToInstance(ConstraintSetDto, raw)` + `validate()`.
 *    Failure here rejects the WHOLE set: no rule reaches `applyConstraints`,
 *    the solver is never invoked.
 * 2. SEMANTIC (catalog cross-reference) — every rule's `productCode` /
 *    `family` / `zone` must exist in the real operation catalog. Unknown
 *    references are DROPPED (not rejected) with a warning naming them —
 *    the rest of the set still applies.
 */

export class ConstraintSetStructuralError extends Error {
  constructor(
    message: string,
    readonly errors: ValidationError[],
  ) {
    super(message);
    this.name = 'ConstraintSetStructuralError';
  }
}

export interface DroppedRule {
  rule: HardRule;
  reason: string;
}

export interface ValidationGateResult {
  appliedRules: HardRule[];
  droppedRules: DroppedRule[];
}

function unknownReferenceReason(rule: HardRule, catalog: CatalogContext): string | undefined {
  const problems: string[] = [];

  if ('productCode' in rule && !catalog.productCodes.includes(rule.productCode)) {
    problems.push(`unknown product code "${rule.productCode}"`);
  }
  if (rule.type === 'FAMILY_PLACEMENT_BAN' && !catalog.families.includes(rule.family)) {
    problems.push(`unknown product family "${rule.family}"`);
  }
  if ((rule.type === 'ZONE_RESTRICTION' || rule.type === 'FAMILY_PLACEMENT_BAN') && !catalog.zones.includes(rule.zone)) {
    problems.push(`unknown truck zone "${rule.zone}"`);
  }

  if (problems.length === 0) return undefined;
  return `Rule ${rule.type} references ${problems.join(' and ')} not present in the operation catalog — dropped.`;
}

export async function validateConstraintSet(raw: unknown, catalog: CatalogContext): Promise<ValidationGateResult> {
  const instance = plainToInstance(ConstraintSetDto, raw);
  const errors = await validate(instance);

  if (errors.length > 0) {
    throw new ConstraintSetStructuralError('ConstraintSet failed structural validation.', errors);
  }

  const appliedRules: HardRule[] = [];
  const droppedRules: DroppedRule[] = [];

  for (const rule of instance.hardRules as unknown as HardRule[]) {
    const reason = unknownReferenceReason(rule, catalog);
    if (reason) {
      droppedRules.push({ rule, reason });
      continue;
    }
    appliedRules.push(rule);
  }

  return { appliedRules, droppedRules };
}
