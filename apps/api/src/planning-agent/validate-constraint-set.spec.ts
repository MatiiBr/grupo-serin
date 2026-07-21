import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { CatalogContext } from './ports/agent.port';
import { ConstraintSetStructuralError, validateConstraintSet } from './validate-constraint-set';

/**
 * loading-agent-llm Phase 7 — validation gate. Runs a raw `ConstraintSet`
 * (whatever an `AgentPort` implementation returned — trusted only at the
 * TypeScript level, re-validated here at runtime) through two stages:
 * (1) structural (`plainToInstance(ConstraintSetDto, raw)` + `validate()`) —
 * failure here rejects the WHOLE set, no rule reaches `applyConstraints`;
 * (2) semantic cross-reference against the real operation catalog — any rule
 * citing a productCode/family/zone absent from the catalog is DROPPED (not
 * rejected), with a warning naming the unknown reference. Pure, no mocks.
 */

const catalog: CatalogContext = {
  productCodes: ['P-100', 'P-200'],
  families: ['COIL', 'SHEET'],
  zones: ['CABIN_SIDE', 'CENTER', 'DOOR_SIDE'],
  destinations: ['dest-1'],
};

describe('validateConstraintSet — structural gate', () => {
  it('rejects a raw payload missing the required "hardRules" array', async () => {
    await expect(validateConstraintSet({ version: 1 }, catalog)).rejects.toBeInstanceOf(ConstraintSetStructuralError);
  });

  it('rejects a raw payload with an unknown rule "type" discriminator', async () => {
    const raw = { version: 1, hardRules: [{ type: 'WEIGHT_LIMIT_EXCEEDED', productCode: 'P-100' }] };

    await expect(validateConstraintSet(raw, catalog)).rejects.toBeInstanceOf(ConstraintSetStructuralError);
  });
});

describe('validateConstraintSet — semantic cross-reference gate', () => {
  it('applies a rule whose productCode exists in the catalog', async () => {
    const raw = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }] };

    const result = await validateConstraintSet(raw, catalog);

    expect(result.appliedRules).toEqual([{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }]);
    expect(result.droppedRules).toEqual([]);
  });

  it('drops a rule citing a product code absent from the catalog, with a warning naming it', async () => {
    const raw = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'P-999-GHOST' }] };

    const result = await validateConstraintSet(raw, catalog);

    expect(result.appliedRules).toEqual([]);
    expect(result.droppedRules).toHaveLength(1);
    expect(result.droppedRules[0].rule).toEqual(raw.hardRules[0]);
    expect(result.droppedRules[0].reason).toContain('P-999-GHOST');
  });

  it('drops a FAMILY_PLACEMENT_BAN rule citing a family absent from THIS operation (valid enum, but no PROFILE product here), with a warning naming it', async () => {
    // "PROFILE" is a real ProductFamily enum member (structurally valid) but
    // this operation's catalog only has COIL/SHEET products — semantic drop.
    const raw = { version: 1, hardRules: [{ type: 'FAMILY_PLACEMENT_BAN', family: 'PROFILE', zone: 'CENTER' }] };

    const result = await validateConstraintSet(raw, catalog);

    expect(result.appliedRules).toEqual([]);
    expect(result.droppedRules[0].reason).toContain('PROFILE');
  });

  it('drops a ZONE_RESTRICTION rule citing a zone absent from THIS truck (valid enum, but not configured on it), with a warning naming it', async () => {
    // "CABIN_SIDE" is a real TruckZoneType enum member (structurally valid)
    // but this truck's catalog only has CENTER/DOOR_SIDE zones configured.
    const twoZoneCatalog: CatalogContext = { ...catalog, zones: ['CENTER', 'DOOR_SIDE'] };
    const raw = { version: 1, hardRules: [{ type: 'ZONE_RESTRICTION', productCode: 'P-100', zone: 'CABIN_SIDE' }] };

    const result = await validateConstraintSet(raw, twoZoneCatalog);

    expect(result.appliedRules).toEqual([]);
    expect(result.droppedRules[0].reason).toContain('CABIN_SIDE');
  });

  it('a fully-hallucinated ConstraintSet drops every rule, applying zero, one warning per rule', async () => {
    const raw = {
      version: 1,
      hardRules: [
        { type: 'STACKING_PROHIBITION', productCode: 'GHOST-1' },
        { type: 'FRAGILE_ON_TOP', productCode: 'GHOST-2' },
        { type: 'ZONE_RESTRICTION', productCode: 'GHOST-3', zone: 'CENTER' },
      ],
    };

    const result = await validateConstraintSet(raw, catalog);

    expect(result.appliedRules).toEqual([]);
    expect(result.droppedRules).toHaveLength(3);
  });

  it('keeps a mix: known-reference rules applied, unknown-reference rules dropped', async () => {
    const raw = {
      version: 1,
      hardRules: [
        { type: 'STACKING_PROHIBITION', productCode: 'P-100' },
        { type: 'STACKING_PROHIBITION', productCode: 'GHOST' },
      ],
    };

    const result = await validateConstraintSet(raw, catalog);

    expect(result.appliedRules).toEqual([{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }]);
    expect(result.droppedRules).toHaveLength(1);
  });
});
