import { LoadingMethod, ProductFamily, TruckZoneType } from '@prisma/client';
import { TruckZoneType as SharedTruckZoneType, type SoftPreference } from '@camiones/shared';
import { describe, expect, it } from 'vitest';
import { HeuristicLoadingPlanner } from './heuristic-loading-planner';
import type { LoadingPlannerInput, PlannerProductInput, PlannerTruckZoneInput } from './loading-planner.types';

/**
 * solver-soft-preferences Phase 4/5 — end-to-end wiring of `softPreferences`
 * through `HeuristicLoadingPlanner.generate()`. Every scenario here proves
 * TWO things at once: (1) the weighted scorer genuinely changes zone
 * selection when preferences are present, and (2) absent/empty preferences
 * are byte-identical to the pre-existing hardcoded behavior (the safety
 * contract protecting the 244-test baseline, including the pinned 1b.13/
 * 1b.14/1b.15 fixtures in `heuristic-loading-planner.stacking.spec.ts`,
 * which are left completely untouched).
 */

function createInput(
  overrides: {
    truck?: Partial<LoadingPlannerInput['truck']>;
    destinations?: LoadingPlannerInput['destinations'];
    products?: LoadingPlannerInput['products'];
    softPreferences?: SoftPreference[];
  } = {},
): LoadingPlannerInput {
  const input: LoadingPlannerInput = {
    truck: {
      id: 'truck-1',
      loadingMethod: LoadingMethod.REAR,
      maxPayloadKg: 24_000,
      lengthMm: 2000,
      widthMm: 2000,
      heightMm: 2400,
      zones: [
        { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 0, endXMm: 2000, startYMm: 0, endYMm: 500 },
        { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 2000, startYMm: 1000, endYMm: 2000 },
      ],
      tiers: [],
      ...overrides.truck,
    },
    destinations: overrides.destinations ?? [{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }],
    products: overrides.products ?? [],
  };
  if (overrides.softPreferences !== undefined) input.softPreferences = overrides.softPreferences;
  return input;
}

function createProduct(overrides: Partial<PlannerProductInput> = {}): PlannerProductInput {
  return {
    id: 'product-1',
    code: 'P-1',
    family: ProductFamily.GENERIC_PACKAGE,
    destinationId: 'destination-1',
    quantity: 1,
    weightKg: 500,
    lengthMm: 500,
    widthMm: 500,
    heightMm: 300,
    stackable: true,
    rotationAllowed: false,
    fragile: false,
    ...overrides,
  };
}

function findPlaced(result: ReturnType<HeuristicLoadingPlanner['generate']>, productId: string) {
  return result.placedItems.find((item) => item.productId === productId);
}

/**
 * Shared two-zone fixture: DOOR_SIDE (target zone — single destination stop
 * always resolves to DOOR_SIDE, per `targetZoneForOrder`) is the left half
 * of the truck (Y 0-500, width 500); CABIN_SIDE is the right half (Y
 * 1000-2000, width 1000). `seed-left` (1600kg) and `seed-right` (1400kg) are
 * hard-pinned one to each zone via `allowedZones` so they establish a known
 * lateral weight split BEFORE `balancer` (200kg, allowed in either zone) is
 * placed. With this split, DOOR_SIDE's post-placement imbalance is exactly
 * 12.5% (within the old 20% cliff — so unweighted logic accepts the priority
 * zone immediately) while CABIN_SIDE's is exactly 0% (perfectly balanced) —
 * a genuine, non-tied difference a weighted LATERAL_BALANCE preference can
 * exploit that the cliff rule structurally cannot see once it is satisfied.
 */
function lateralSplitProducts(): PlannerProductInput[] {
  return [
    createProduct({ id: 'seed-left', code: 'SEED-L', weightKg: 1600, lengthMm: 1000, widthMm: 500, allowedZones: [TruckZoneType.DOOR_SIDE] }),
    createProduct({ id: 'seed-right', code: 'SEED-R', weightKg: 1400, lengthMm: 1000, widthMm: 1000, allowedZones: [TruckZoneType.CABIN_SIDE] }),
    createProduct({
      id: 'balancer',
      code: 'BALANCER',
      weightKg: 200,
      lengthMm: 500,
      widthMm: 500,
      allowedZones: [TruckZoneType.DOOR_SIDE, TruckZoneType.CABIN_SIDE],
    }),
  ];
}

describe('Identity/bypass equivalence — the safety contract (Phase 4)', () => {
  it('produces a byte-identical result whether softPreferences is omitted or an explicit empty array', () => {
    const withoutField = createInput({ products: lateralSplitProducts() });
    const withEmptyArray = createInput({ products: lateralSplitProducts(), softPreferences: [] });

    const resultWithoutField = new HeuristicLoadingPlanner().generate(withoutField);
    const resultWithEmptyArray = new HeuristicLoadingPlanner().generate(withEmptyArray);

    expect(resultWithEmptyArray).toEqual(resultWithoutField);
  });

  it('the bypass path runs the existing hardcoded cliff logic UNCHANGED: balancer stays in the priority (DOOR_SIDE) zone even though CABIN_SIDE is more balanced', () => {
    const result = new HeuristicLoadingPlanner().generate(createInput({ products: lateralSplitProducts() }));

    expect(findPlaced(result, 'balancer')).toEqual(expect.objectContaining({ zoneType: TruckZoneType.DOOR_SIDE }));
  });
});

describe('LATERAL_BALANCE weight steers a unit to the more-balanced zone (Phase 4/5)', () => {
  it('overrides the 20%-cliff priority pick once a LATERAL_BALANCE preference is present, choosing the perfectly balanced fallback zone instead', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        products: lateralSplitProducts(),
        softPreferences: [{ type: 'LATERAL_BALANCE', weight: 1 }],
      }),
    );

    expect(findPlaced(result, 'balancer')).toEqual(expect.objectContaining({ zoneType: TruckZoneType.CABIN_SIDE }));
  });
});

describe('ZONE_AFFINITY pulls a product to its target zone (Phase 4/5)', () => {
  it('places a lone unit in the ZONE_AFFINITY-scoped zone instead of the default target/priority zone', () => {
    const products: PlannerProductInput[] = [
      createProduct({ id: 'affine-item', code: 'AFFINE', allowedZones: [TruckZoneType.DOOR_SIDE, TruckZoneType.CABIN_SIDE] }),
    ];

    const withoutPreference = new HeuristicLoadingPlanner().generate(createInput({ products }));
    const withPreference = new HeuristicLoadingPlanner().generate(
      createInput({
        products,
        softPreferences: [{ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CABIN_SIDE, weight: 1 }],
      }),
    );

    // Without the preference, the lone unit defaults to DOOR_SIDE (the
    // priority/target zone for a single-destination shipment).
    expect(findPlaced(withoutPreference, 'affine-item')).toEqual(expect.objectContaining({ zoneType: TruckZoneType.DOOR_SIDE }));
    // With it, ZONE_AFFINITY pulls it to CABIN_SIDE instead.
    expect(findPlaced(withPreference, 'affine-item')).toEqual(expect.objectContaining({ zoneType: TruckZoneType.CABIN_SIDE }));
  });
});

describe('A higher-weight term dominates a competing lower-weight term (Phase 4/5)', () => {
  it('picks the ZONE_AFFINITY-favored zone when its weight dwarfs a competing LATERAL_BALANCE preference', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        products: lateralSplitProducts(),
        softPreferences: [
          { type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.DOOR_SIDE, weight: 10 },
          { type: 'LATERAL_BALANCE', weight: 1 },
        ],
      }),
    );

    // DOOR_SIDE score: 10*1 (affinity match) + 1*0.875 (12.5% imbalance) = 10.875
    // CABIN_SIDE score: 10*0 (no match)      + 1*1.0   (0% imbalance)   = 1.0
    expect(findPlaced(result, 'balancer')).toEqual(expect.objectContaining({ zoneType: TruckZoneType.DOOR_SIDE }));
  });

  it('picks the LATERAL_BALANCE-favored zone when its weight dwarfs a competing ZONE_AFFINITY preference, flipping the outcome', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        products: lateralSplitProducts(),
        softPreferences: [
          { type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.DOOR_SIDE, weight: 1 },
          { type: 'LATERAL_BALANCE', weight: 10 },
        ],
      }),
    );

    // DOOR_SIDE score: 1*1 (affinity match) + 10*0.875 (12.5% imbalance) = 9.75
    // CABIN_SIDE score: 1*0 (no match)      + 10*1.0   (0% imbalance)   = 10.0
    expect(findPlaced(result, 'balancer')).toEqual(expect.objectContaining({ zoneType: TruckZoneType.CABIN_SIDE }));
  });
});

describe('Hard-constraint supremacy: a soft preference can never admit a hard-forbidden zone (Phase 4/5)', () => {
  it('keeps the unit in its only hard-allowed zone even when a very high-weight ZONE_AFFINITY preference wants the forbidden one', () => {
    const zones: PlannerTruckZoneInput[] = [
      { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 500 },
      { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 1000, startYMm: 1000, endYMm: 2000 },
    ];
    const products: PlannerProductInput[] = [
      createProduct({ id: 'locked-item', code: 'LOCKED', allowedZones: [TruckZoneType.DOOR_SIDE] }),
    ];

    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { zones, lengthMm: 1000, widthMm: 2000 },
        products,
        softPreferences: [{ type: 'ZONE_AFFINITY', zone: SharedTruckZoneType.CABIN_SIDE, weight: 1000 }],
      }),
    );

    expect(findPlaced(result, 'locked-item')).toEqual(expect.objectContaining({ zoneType: TruckZoneType.DOOR_SIDE }));
  });
});
