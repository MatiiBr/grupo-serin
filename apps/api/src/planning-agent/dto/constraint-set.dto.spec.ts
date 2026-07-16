import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ConstraintSetDto } from './constraint-set.dto';

/**
 * loading-agent-llm Phase 2 — ConstraintSet contract (structural validation).
 * The pure shape (`ConstraintSet`, `HardRule` discriminated union) lives in
 * `@camiones/shared` (framework-free, safe for the web bundle); this DTO is
 * the class-validator gate the API layer runs a raw LLM JSON response
 * through before any rule reaches `applyConstraints`. Tested here (not in
 * `packages/shared`) because that package has no wired test runner in this
 * repo — `npm run test:api` is the only active Vitest target.
 */

function validConstraintSet() {
  return {
    version: 1,
    hardRules: [
      { type: 'STACKING_PROHIBITION', productCode: 'P-1' },
      { type: 'FRAGILE_ON_TOP', productCode: 'P-2' },
      { type: 'ZONE_RESTRICTION', productCode: 'P-3', zone: 'DOOR_SIDE' },
      { type: 'TIER_RESTRICTION', productCode: 'P-4', maxTier: 2 },
      { type: 'FAMILY_PLACEMENT_BAN', family: 'COIL', zone: 'CABIN_SIDE' },
      { type: 'PRODUCT_ZONE_BAN', productCode: 'P-6', zone: 'CABIN_SIDE' },
    ],
    notes: 'From rulesText',
  };
}

describe('ConstraintSetDto — structural validation gate (loading-agent-llm 2.1/2.2)', () => {
  it('validates a ConstraintSet containing one rule of each of the 6 hard-rule types with zero errors', async () => {
    const instance = plainToInstance(ConstraintSetDto, validConstraintSet());
    const errors = await validate(instance);

    expect(errors).toEqual([]);
    expect(instance.hardRules).toHaveLength(6);
  });

  it('validates a ConstraintSet with empty hardRules (no rules extracted) with zero errors', async () => {
    const instance = plainToInstance(ConstraintSetDto, { version: 1, hardRules: [] });
    const errors = await validate(instance);

    expect(errors).toEqual([]);
  });

  it('rejects a ZONE_RESTRICTION rule missing its required "zone" field', async () => {
    const instance = plainToInstance(ConstraintSetDto, {
      version: 1,
      hardRules: [{ type: 'ZONE_RESTRICTION', productCode: 'P-3' }],
    });
    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('hardRules');
  });

  it('rejects a TIER_RESTRICTION rule whose maxTier is not a number', async () => {
    const instance = plainToInstance(ConstraintSetDto, {
      version: 1,
      hardRules: [{ type: 'TIER_RESTRICTION', productCode: 'P-4', maxTier: 'two' }],
    });
    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('validates a PRODUCT_ZONE_BAN rule (bans a product FROM a zone) with zero errors', async () => {
    const instance = plainToInstance(ConstraintSetDto, {
      version: 1,
      hardRules: [{ type: 'PRODUCT_ZONE_BAN', productCode: 'P-6', zone: 'CABIN_SIDE' }],
    });
    const errors = await validate(instance);

    expect(errors).toEqual([]);
  });

  it('rejects a PRODUCT_ZONE_BAN rule missing its required "zone" field', async () => {
    const instance = plainToInstance(ConstraintSetDto, {
      version: 1,
      hardRules: [{ type: 'PRODUCT_ZONE_BAN', productCode: 'P-6' }],
    });
    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('hardRules');
  });

  it('rejects a rule with an unknown "type" discriminator', async () => {
    const instance = plainToInstance(ConstraintSetDto, {
      version: 1,
      hardRules: [{ type: 'WEIGHT_LIMIT_EXCEEDED', productCode: 'P-5' }],
    });
    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a ConstraintSet missing the required "hardRules" array', async () => {
    const instance = plainToInstance(ConstraintSetDto, { version: 1 });
    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a ConstraintSet with a version other than 1', async () => {
    const instance = plainToInstance(ConstraintSetDto, { version: 2, hardRules: [] });
    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('version');
  });
});
