import type { ConstraintSet } from '@camiones/shared';
import { ProductFamily as SharedProductFamily, TruckZoneType as SharedTruckZoneType } from '@camiones/shared';
import { LoadingMethod, ProductFamily, TruckZoneType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { applyConstraints } from './constraint-application';
import { HeuristicLoadingPlanner } from './heuristic-loading-planner';
import type { LoadingPlannerInput, PlannerProductInput, PlannerTruckZoneInput } from './loading-planner.types';

/**
 * loading-agent-llm Phase 3 — pure `applyConstraints(input, constraintSet)`
 * pre-pass. Per rule-type mutation table in design.md, each `HardRule` maps
 * onto an existing (or Phase-1-additive) `PlannerProductInput` field, so the
 * unchanged `HeuristicLoadingPlanner.generate()` honors it as a hard
 * constraint. No mocks — pure domain, framework-free (covered by
 * `no-llm-imports.spec.ts`).
 */

const fullWidthZones: PlannerTruckZoneInput[] = [
  { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 3000, startYMm: 0, endYMm: 2000 },
  { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 3000, endXMm: 6000, startYMm: 0, endYMm: 2000 },
  { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 6000, endXMm: 9000, startYMm: 0, endYMm: 2000 },
];

const singleCenterZone: PlannerTruckZoneInput[] = [
  { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 1000 },
];

function createInput(
  overrides: {
    truck?: Partial<LoadingPlannerInput['truck']>;
    destinations?: LoadingPlannerInput['destinations'];
    products?: LoadingPlannerInput['products'];
  } = {},
): LoadingPlannerInput {
  return {
    truck: {
      id: 'truck-1',
      loadingMethod: LoadingMethod.REAR,
      maxPayloadKg: 24_000,
      lengthMm: 9000,
      widthMm: 2000,
      heightMm: 2500,
      zones: fullWidthZones,
      tiers: [],
      ...overrides.truck,
    },
    destinations: overrides.destinations ?? [{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }],
    products: overrides.products ?? [createProduct()],
  };
}

function createProduct(overrides: Partial<PlannerProductInput> = {}): PlannerProductInput {
  return {
    id: 'product-1',
    code: 'P-1',
    family: ProductFamily.GENERIC_PACKAGE,
    destinationId: 'destination-1',
    quantity: 1,
    weightKg: 500,
    lengthMm: 1000,
    widthMm: 500,
    heightMm: 400,
    stackable: false,
    rotationAllowed: true,
    fragile: false,
    ...overrides,
  };
}

/** Single-zone, tall truck: floor holds exactly one 1000x1000 base; a second unit can only land stacked on it. */
function stackingInput(products: PlannerProductInput[]): LoadingPlannerInput {
  return {
    truck: {
      id: 'truck-stacking',
      loadingMethod: LoadingMethod.REAR,
      maxPayloadKg: 24_000,
      lengthMm: 1000,
      widthMm: 1000,
      heightMm: 3000,
      zones: singleCenterZone,
      tiers: [],
    },
    destinations: [{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }],
    products,
  };
}

function emptySet(): ConstraintSet {
  return { version: 1, hardRules: [] };
}

describe('applyConstraints — identity transform', () => {
  it('returns a deep-equal clone of input for an empty ConstraintSet, never the same reference', () => {
    const input = createInput();

    const result = applyConstraints(input, emptySet());

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(result.products[0]).not.toBe(input.products[0]);
    expect(result.truck).not.toBe(input.truck);
    expect(result.destinations).not.toBe(input.destinations);
  });
});

describe('applyConstraints — STACKING_PROHIBITION', () => {
  it('marks the targeted product stackable:false in the transformed output', () => {
    const input = createInput({ products: [createProduct({ code: 'BASE-1', stackable: true })] });
    const rules: ConstraintSet = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'BASE-1' }] };

    const result = applyConstraints(input, rules);

    expect(result.products[0].stackable).toBe(false);
  });

  it('regression: the solver never stacks another unit on top of a stacking-prohibited product', () => {
    const input = stackingInput([
      createProduct({ id: 'base', code: 'BASE-1', lengthMm: 1000, widthMm: 1000, heightMm: 500, stackable: true }),
      createProduct({ id: 'topper', code: 'TOP-1', lengthMm: 1000, widthMm: 1000, heightMm: 400, stackable: true }),
    ]);
    const rules: ConstraintSet = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'BASE-1' }] };

    const result = new HeuristicLoadingPlanner().generate(applyConstraints(input, rules));

    expect(result.placedItems).toEqual([expect.objectContaining({ productId: 'base', tier: 1 })]);
    expect(result.unplacedItems).toEqual([expect.objectContaining({ productId: 'topper' })]);
  });
});

describe('applyConstraints — FRAGILE_ON_TOP', () => {
  it('marks the targeted product fragile:true in the transformed output', () => {
    const input = createInput({ products: [createProduct({ code: 'BASE-1', fragile: false })] });
    const rules: ConstraintSet = { version: 1, hardRules: [{ type: 'FRAGILE_ON_TOP', productCode: 'BASE-1' }] };

    const result = applyConstraints(input, rules);

    expect(result.products[0].fragile).toBe(true);
  });

  it('regression: the solver never places another unit on top of a fragile-forced product', () => {
    const input = stackingInput([
      createProduct({ id: 'base', code: 'BASE-1', lengthMm: 1000, widthMm: 1000, heightMm: 500, stackable: true, fragile: false }),
      createProduct({ id: 'topper', code: 'TOP-1', lengthMm: 1000, widthMm: 1000, heightMm: 400, stackable: true }),
    ]);
    const rules: ConstraintSet = { version: 1, hardRules: [{ type: 'FRAGILE_ON_TOP', productCode: 'BASE-1' }] };

    const result = new HeuristicLoadingPlanner().generate(applyConstraints(input, rules));

    expect(result.placedItems).toEqual([expect.objectContaining({ productId: 'base', tier: 1 })]);
    expect(result.unplacedItems).toEqual([expect.objectContaining({ productId: 'topper' })]);
  });
});

describe('applyConstraints — ZONE_RESTRICTION', () => {
  it('sets allowedZones to exactly the rule zone on the transformed output', () => {
    const input = createInput({ products: [createProduct({ code: 'P-1' })] });
    const rules: ConstraintSet = {
      version: 1,
      hardRules: [{ type: 'ZONE_RESTRICTION', productCode: 'P-1', zone: SharedTruckZoneType.DOOR_SIDE }],
    };

    const result = applyConstraints(input, rules);

    expect(result.products[0].allowedZones).toEqual([TruckZoneType.DOOR_SIDE]);
  });

  it('regression: the solver confines the product to the restricted zone even when its natural target zone differs', () => {
    const input = createInput({
      destinations: [
        { id: 'first-stop', name: 'First stop', unloadingOrder: 1 },
        { id: 'last-stop', name: 'Last stop', unloadingOrder: 3 },
      ],
      // last-stop naturally targets CABIN_SIDE.
      products: [createProduct({ id: 'confined', code: 'P-1', destinationId: 'last-stop' })],
    });
    const rules: ConstraintSet = {
      version: 1,
      hardRules: [{ type: 'ZONE_RESTRICTION', productCode: 'P-1', zone: SharedTruckZoneType.DOOR_SIDE }],
    };

    const result = new HeuristicLoadingPlanner().generate(applyConstraints(input, rules));

    expect(result.placedItems).toEqual([expect.objectContaining({ productId: 'confined', zoneType: TruckZoneType.DOOR_SIDE })]);
  });
});

describe('applyConstraints — TIER_RESTRICTION', () => {
  it('sets maxTier on the transformed output', () => {
    const input = createInput({ products: [createProduct({ code: 'P-1' })] });
    const rules: ConstraintSet = { version: 1, hardRules: [{ type: 'TIER_RESTRICTION', productCode: 'P-1', maxTier: 1 }] };

    const result = applyConstraints(input, rules);

    expect(result.products[0].maxTier).toBe(1);
  });

  it('regression: a maxTier:1 product is left unplaced instead of stacked onto tier 2', () => {
    const input = stackingInput([
      createProduct({ id: 'base', code: 'BASE-1', lengthMm: 1000, widthMm: 1000, heightMm: 500, stackable: true }),
      createProduct({ id: 'capped', code: 'CAP-1', lengthMm: 1000, widthMm: 1000, heightMm: 400, stackable: true }),
    ]);
    const rules: ConstraintSet = { version: 1, hardRules: [{ type: 'TIER_RESTRICTION', productCode: 'CAP-1', maxTier: 1 }] };

    const result = new HeuristicLoadingPlanner().generate(applyConstraints(input, rules));

    expect(result.placedItems).toEqual([expect.objectContaining({ productId: 'base', tier: 1 })]);
    expect(result.unplacedItems).toEqual([expect.objectContaining({ productId: 'capped' })]);
  });
});

describe('applyConstraints — FAMILY_PLACEMENT_BAN', () => {
  it('applies the zone ban (allowedZones = allZones minus banned zone) to every product of the family', () => {
    const input = createInput({
      products: [
        createProduct({ id: 'coil-1', code: 'COIL-1', family: ProductFamily.COIL }),
        createProduct({ id: 'coil-2', code: 'COIL-2', family: ProductFamily.COIL }),
        createProduct({ id: 'sheet-1', code: 'SHEET-1', family: ProductFamily.SHEET }),
      ],
    });
    const rules: ConstraintSet = {
      version: 1,
      hardRules: [{ type: 'FAMILY_PLACEMENT_BAN', family: SharedProductFamily.COIL, zone: SharedTruckZoneType.DOOR_SIDE }],
    };

    const result = applyConstraints(input, rules);

    const coil1 = result.products.find((p) => p.code === 'COIL-1')!;
    const coil2 = result.products.find((p) => p.code === 'COIL-2')!;
    const sheet1 = result.products.find((p) => p.code === 'SHEET-1')!;

    expect(coil1.allowedZones).toEqual(expect.arrayContaining([TruckZoneType.CABIN_SIDE, TruckZoneType.CENTER]));
    expect(coil1.allowedZones).not.toContain(TruckZoneType.DOOR_SIDE);
    expect(coil2.allowedZones).not.toContain(TruckZoneType.DOOR_SIDE);
    expect(sheet1.allowedZones).toBeUndefined();
  });

  it('regression: the solver never places a banned family in the banned zone, even when it is the only zone that fits geometrically', () => {
    const input = createInput({
      destinations: [{ id: 'destination-1', name: 'Only stop', unloadingOrder: 1 }],
      products: [createProduct({ id: 'coil-1', code: 'COIL-1', family: ProductFamily.COIL, lengthMm: 500, widthMm: 500, heightMm: 400 })],
      truck: {
        zones: [
          { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 100, startYMm: 0, endYMm: 2000 },
          { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 100, endXMm: 200, startYMm: 0, endYMm: 2000 },
          // The only zone large enough is the banned one.
          { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 200, endXMm: 9000, startYMm: 0, endYMm: 2000 },
        ],
      },
    });
    const rules: ConstraintSet = {
      version: 1,
      hardRules: [{ type: 'FAMILY_PLACEMENT_BAN', family: SharedProductFamily.COIL, zone: SharedTruckZoneType.DOOR_SIDE }],
    };

    const result = new HeuristicLoadingPlanner().generate(applyConstraints(input, rules));

    expect(result.placedItems).toHaveLength(0);
    expect(result.unplacedItems).toEqual([expect.objectContaining({ productId: 'coil-1' })]);
  });
});

describe('applyConstraints — PRODUCT_ZONE_BAN', () => {
  it('sets allowedZones to allZones minus the banned zone (bans FROM a zone, not confines TO it)', () => {
    const input = createInput({ products: [createProduct({ code: 'P-1' })] });
    const rules: ConstraintSet = {
      version: 1,
      hardRules: [{ type: 'PRODUCT_ZONE_BAN', productCode: 'P-1', zone: SharedTruckZoneType.CABIN_SIDE }],
    };

    const result = applyConstraints(input, rules);

    expect(result.products[0].allowedZones).toEqual(expect.arrayContaining([TruckZoneType.CENTER, TruckZoneType.DOOR_SIDE]));
    expect(result.products[0].allowedZones).not.toContain(TruckZoneType.CABIN_SIDE);
  });

  it('regression: the solver never places the banned product in the banned zone, even when it is the only zone that fits geometrically', () => {
    const input = createInput({
      destinations: [{ id: 'destination-1', name: 'Only stop', unloadingOrder: 1 }],
      products: [createProduct({ id: 'profile-1', code: 'PROFILE-1', lengthMm: 500, widthMm: 500, heightMm: 400 })],
      truck: {
        zones: [
          { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 0, endXMm: 100, startYMm: 0, endYMm: 2000 },
          { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 100, endXMm: 200, startYMm: 0, endYMm: 2000 },
          // The only zone large enough is the banned one (CABIN_SIDE).
          { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 200, endXMm: 9000, startYMm: 0, endYMm: 2000 },
        ],
      },
    });
    const rules: ConstraintSet = {
      version: 1,
      hardRules: [{ type: 'PRODUCT_ZONE_BAN', productCode: 'PROFILE-1', zone: SharedTruckZoneType.CABIN_SIDE }],
    };

    const result = new HeuristicLoadingPlanner().generate(applyConstraints(input, rules));

    expect(result.placedItems).toHaveLength(0);
    expect(result.unplacedItems).toEqual([expect.objectContaining({ productId: 'profile-1' })]);
  });

  it('conflict resolution: a ZONE_RESTRICTION and a PRODUCT_ZONE_BAN naming the SAME zone for the same product intersect to empty (most-restrictive-wins) instead of throwing', () => {
    // Directly contradictory: "must go ONLY in CENTER" + "must NOT go in CENTER".
    // A weaker test (different zones) would pass even if PRODUCT_ZONE_BAN were
    // a no-op, since ZONE_RESTRICTION alone already narrows to one zone that
    // wouldn't be excluded by a differently-zoned ban — this same-zone case is
    // the only one where the empty result can ONLY come from PRODUCT_ZONE_BAN
    // actually being applied.
    const input = createInput({ products: [createProduct({ code: 'P-1' })] });
    const rules: ConstraintSet = {
      version: 1,
      hardRules: [
        { type: 'ZONE_RESTRICTION', productCode: 'P-1', zone: SharedTruckZoneType.CENTER },
        { type: 'PRODUCT_ZONE_BAN', productCode: 'P-1', zone: SharedTruckZoneType.CENTER },
      ],
    };

    expect(() => applyConstraints(input, rules)).not.toThrow();
    const result = applyConstraints(input, rules);

    // ZONE_RESTRICTION -> [CENTER]; PRODUCT_ZONE_BAN -> allZones\CENTER = [CABIN_SIDE, DOOR_SIDE]; intersection = [].
    expect(result.products[0].allowedZones).toEqual([]);
  });
});

describe('applyConstraints — conflicting rule resolution (most-restrictive-wins)', () => {
  it('intersects a ZONE_RESTRICTION with an overlapping FAMILY_PLACEMENT_BAN instead of throwing', () => {
    const input = createInput({
      products: [createProduct({ code: 'COIL-1', family: ProductFamily.COIL })],
    });
    const rules: ConstraintSet = {
      version: 1,
      hardRules: [
        { type: 'ZONE_RESTRICTION', productCode: 'COIL-1', zone: SharedTruckZoneType.CENTER },
        { type: 'FAMILY_PLACEMENT_BAN', family: SharedProductFamily.COIL, zone: SharedTruckZoneType.DOOR_SIDE },
      ],
    };

    expect(() => applyConstraints(input, rules)).not.toThrow();
    const result = applyConstraints(input, rules);

    // ZONE_RESTRICTION -> [CENTER]; FAMILY_PLACEMENT_BAN -> allZones\DOOR_SIDE = [CABIN_SIDE, CENTER]; intersection = [CENTER].
    expect(result.products[0].allowedZones).toEqual([TruckZoneType.CENTER]);
  });
});

describe('applyConstraints — regression: transformed input always yields a structurally valid solver result', () => {
  it('generate(applyConstraints(input, cs)) never throws and every unit is accounted for as placed or unplaced', () => {
    const input = stackingInput([
      createProduct({ id: 'base', code: 'BASE-1', lengthMm: 1000, widthMm: 1000, heightMm: 500, stackable: true }),
      createProduct({ id: 'topper', code: 'TOP-1', lengthMm: 1000, widthMm: 1000, heightMm: 400, stackable: true }),
    ]);
    const rules: ConstraintSet = {
      version: 1,
      hardRules: [
        { type: 'STACKING_PROHIBITION', productCode: 'BASE-1' },
        { type: 'TIER_RESTRICTION', productCode: 'TOP-1', maxTier: 3 },
      ],
    };

    let result: ReturnType<HeuristicLoadingPlanner['generate']>;
    expect(() => {
      result = new HeuristicLoadingPlanner().generate(applyConstraints(input, rules));
    }).not.toThrow();

    expect(result!.placedItems.length + result!.unplacedItems.length).toBe(2);
    expect(result!.metrics).toBeDefined();
    expect(result!.alerts).toBeInstanceOf(Array);
  });
});

describe('applyConstraints — softPreferences passthrough (solver-soft-preferences Phase 3)', () => {
  it('copies constraintSet.softPreferences onto the returned clone', () => {
    const input = createInput();
    const rules: ConstraintSet = {
      version: 1,
      hardRules: [],
      softPreferences: [{ type: 'LATERAL_BALANCE', weight: 1 }],
    };

    const result = applyConstraints(input, rules);

    expect(result.softPreferences).toEqual([{ type: 'LATERAL_BALANCE', weight: 1 }]);
  });

  it('leaves the clone.softPreferences undefined when the ConstraintSet has none (identity)', () => {
    const input = createInput();

    const result = applyConstraints(input, emptySet());

    expect(result.softPreferences).toBeUndefined();
  });
});
