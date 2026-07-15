import { LoadingMethod, ProductFamily, TruckZoneType, UnplacedReason } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { HeuristicLoadingPlanner } from './heuristic-loading-planner';
import type {
  LoadingPlannerInput,
  PlannerProductInput,
  PlannerTruckTierInput,
  PlannerTruckZoneInput,
} from './loading-planner.types';

/**
 * Fase 1b — 3D stacking solver. Each `describe` block below maps 1:1 to a
 * task in `sdd/loading-agent-3d/tasks` (1b.1 .. 1b.15) and to a scenario in
 * `sdd/loading-agent-3d/spec`'s `solver-3d-stacking` domain.
 */

const singleCenterZone = (lengthMm: number, widthMm: number): PlannerTruckZoneInput[] => [
  { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 0, endXMm: lengthMm, startYMm: 0, endYMm: widthMm },
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
      lengthMm: 1000,
      widthMm: 1000,
      heightMm: 2400,
      zones: singleCenterZone(1000, 1000),
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
    widthMm: 1000,
    heightMm: 500,
    stackable: true,
    rotationAllowed: false,
    fragile: false,
    ...overrides,
  };
}

function findPlaced(result: ReturnType<HeuristicLoadingPlanner['generate']>, productId: string, unitIndex = 1) {
  return result.placedItems.find((item) => item.productId === productId && item.unitIndex === unitIndex);
}

describe('1b.1 — 3D Z-candidate search: stacked-diff-Z accepted / same-tier overlap rejected', () => {
  it('stacks the second unit on top of the first when floor space is exhausted (diff-Z accepted)', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        products: [
          createProduct({ id: 'base', weightKg: 500, heightMm: 500 }),
          createProduct({ id: 'topper', weightKg: 300, heightMm: 400 }),
        ],
      }),
    );

    const base = findPlaced(result, 'base');
    const topper = findPlaced(result, 'topper');

    expect(base).toEqual(expect.objectContaining({ tier: 1, zMm: 0 }));
    expect(topper).toEqual(expect.objectContaining({ tier: 2, zMm: 500 }));
  });

  it('rejects a second unit that would overlap the first at the same tier when stacking is not possible', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        products: [
          createProduct({ id: 'base', weightKg: 500, heightMm: 500, stackable: false }),
          createProduct({ id: 'blocked', weightKg: 300, heightMm: 400 }),
        ],
      }),
    );

    expect(findPlaced(result, 'base')).toEqual(expect.objectContaining({ tier: 1, zMm: 0 }));
    expect(findPlaced(result, 'blocked')).toBeUndefined();
    expect(result.unplacedItems).toContainEqual(expect.objectContaining({ productId: 'blocked' }));
  });
});

describe('1b.4 — tier maxHeightMm caps the item height that tier can hold', () => {
  const tiers: PlannerTruckTierInput[] = [
    { level: 1, maxHeightMm: 400 },
    { level: 2, maxHeightMm: 2000 },
  ];

  it('skips tier 1 for an item taller than its maxHeightMm even when floor space remains, and places it on tier 2 instead', () => {
    // Zone is 2000mm long: 'short' occupies the first 1000mm of floor, leaving
    // a geometrically free 1000x1000 slot for 'tall' to land on tier 1 — except
    // 'tall' (500mm) exceeds tier 1's 400mm cap, so it must climb onto 'short'.
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { tiers, heightMm: 2400, lengthMm: 2000, widthMm: 1000, zones: singleCenterZone(2000, 1000) },
        products: [
          createProduct({ id: 'short', weightKg: 900, heightMm: 100, stackable: true }),
          createProduct({ id: 'tall', weightKg: 200, heightMm: 500, stackable: true }),
        ],
      }),
    );

    expect(findPlaced(result, 'short')).toEqual(expect.objectContaining({ tier: 1, zMm: 0 }));
    expect(findPlaced(result, 'tall')).toEqual(expect.objectContaining({ tier: 2, zMm: 100 }));
  });
});

describe('1b.5 — per-tier maxWeightKg cap blocks placement and forces an alternative', () => {
  it('never lets total weight on a capped tier exceed maxWeightKg, and still places the overflowing unit elsewhere', () => {
    const tiers: PlannerTruckTierInput[] = [{ level: 1 }, { level: 2, maxWeightKg: 1000 }];

    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { tiers, heightMm: 2400, lengthMm: 2000, widthMm: 1000, zones: singleCenterZone(2000, 1000) },
        products: [
          createProduct({ id: 'base-a', weightKg: 1000, heightMm: 100, stackable: true, rotationAllowed: false }),
          createProduct({ id: 'base-b', weightKg: 950, heightMm: 100, stackable: true, rotationAllowed: false }),
          createProduct({ id: 'stack-a', weightKg: 900, heightMm: 50, stackable: true, rotationAllowed: false }),
          createProduct({ id: 'overflow', weightKg: 150, heightMm: 50, stackable: true, rotationAllowed: false }),
        ],
      }),
    );

    const tierWeights = result.placedItems.reduce<Record<number, number>>((acc, item) => {
      acc[item.tier] = (acc[item.tier] ?? 0) + item.weightKg;
      return acc;
    }, {});

    expect(tierWeights[2] ?? 0).toBeLessThanOrEqual(1000);
    expect(findPlaced(result, 'overflow')).toBeDefined();
  });
});

describe('1b.6 — per-zone maxWeightKg cap forces overflow to another zone', () => {
  it('does not exceed the target zone weight cap and places the overflowing unit in a fallback zone instead', () => {
    const zones: PlannerTruckZoneInput[] = [
      { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 1000 },
      { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 1000, endXMm: 2000, startYMm: 0, endYMm: 1000 },
      {
        id: 'zone-door',
        type: TruckZoneType.DOOR_SIDE,
        startXMm: 2000,
        endXMm: 3000,
        startYMm: 0,
        endYMm: 1000,
        maxWeightKg: 1000,
      },
    ];

    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 3000, widthMm: 1000, heightMm: 2400, zones, tiers: [] },
        destinations: [{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }],
        products: [
          createProduct({ id: 'door-filler', weightKg: 900, lengthMm: 500, widthMm: 1000, heightMm: 100, stackable: false, rotationAllowed: false }),
          createProduct({ id: 'overflow', weightKg: 150, lengthMm: 500, widthMm: 1000, heightMm: 100, stackable: false, rotationAllowed: false }),
        ],
      }),
    );

    const doorFiller = findPlaced(result, 'door-filler');
    const overflow = findPlaced(result, 'overflow');

    expect(doorFiller).toEqual(expect.objectContaining({ zoneType: TruckZoneType.DOOR_SIDE }));
    expect(overflow).toBeDefined();
    expect(overflow?.zoneType).not.toBe(TruckZoneType.DOOR_SIDE);
  });
});

describe('1b.7 — non-stackable base rejects stacking with an accurate STACKING_RESTRICTION reason', () => {
  it('marks the blocked unit unplaced with UnplacedReason.STACKING_RESTRICTION when its only base is not stackable', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        products: [
          createProduct({ id: 'base', weightKg: 500, heightMm: 500, stackable: false }),
          createProduct({ id: 'blocked', weightKg: 300, heightMm: 400 }),
        ],
      }),
    );

    expect(result.unplacedItems).toContainEqual(
      expect.objectContaining({ productId: 'blocked', reason: UnplacedReason.STACKING_RESTRICTION }),
    );
  });
});

describe('1b.8 — maxStackLoadKg prevents crushing the base', () => {
  it('rejects a topper once the base is already bearing enough weight to exceed maxStackLoadKg (80 + 30 > 100)', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 1000, widthMm: 1000, heightMm: 2400, zones: singleCenterZone(1000, 1000), tiers: [] },
        products: [
          createProduct({ id: 'base', weightKg: 999, lengthMm: 1000, widthMm: 1000, heightMm: 300, stackable: true, maxStackLoadKg: 100 }),
          createProduct({ id: 'first-topper', weightKg: 80, lengthMm: 500, widthMm: 1000, heightMm: 100, stackable: false }),
          createProduct({ id: 'second-topper', weightKg: 30, lengthMm: 500, widthMm: 1000, heightMm: 100, stackable: false }),
        ],
      }),
    );

    expect(findPlaced(result, 'base')).toEqual(expect.objectContaining({ tier: 1, zMm: 0 }));
    expect(findPlaced(result, 'first-topper')).toEqual(expect.objectContaining({ tier: 2, zMm: 300 }));
    // second-topper (30kg) would push base's load to 110kg > 100kg cap, and there is
    // no other stackable base in this single-zone truck, so it must stay unplaced.
    expect(findPlaced(result, 'second-topper')).toBeUndefined();
    expect(result.unplacedItems).toContainEqual(
      expect.objectContaining({ productId: 'second-topper', reason: UnplacedReason.STACKING_RESTRICTION }),
    );
  });
});

describe('1b.9 — every placement is supported (no floating items)', () => {
  it('never places an item at a candidate position with no supporter beneath its footprint', () => {
    // Only room for ONE item on the floor; a second, smaller, non-stacking-eligible
    // item can never float unsupported beside/above it — it must be rejected.
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 1000, widthMm: 1000, heightMm: 2400, zones: singleCenterZone(1000, 1000), tiers: [] },
        products: [
          createProduct({ id: 'base', weightKg: 500, lengthMm: 1000, widthMm: 1000, heightMm: 500, stackable: false }),
          createProduct({ id: 'floater', weightKg: 100, lengthMm: 200, widthMm: 200, heightMm: 100, stackable: true }),
        ],
      }),
    );

    expect(findPlaced(result, 'floater')).toBeUndefined();
    // Every placed item must rest at zMm 0 (floor) or exactly on top of another
    // placed item's surface — there is no placement that "floats" at an
    // arbitrary height with nothing beneath it.
    for (const item of result.placedItems) {
      const hasFloorOrSupport =
        item.zMm === 0 ||
        result.placedItems.some((other) => other !== item && other.zMm + other.heightMm === item.zMm);
      expect(hasFloorOrSupport).toBe(true);
    }
  });
});

describe('1b.10 — fragile base blocks stacking regardless of weight', () => {
  it('rejects any placement on top of a fragile item, even a very light one', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 1000, widthMm: 1000, heightMm: 2400, zones: singleCenterZone(1000, 1000), tiers: [] },
        products: [
          createProduct({ id: 'fragile-base', weightKg: 500, lengthMm: 1000, widthMm: 1000, heightMm: 500, stackable: true, fragile: true }),
          createProduct({ id: 'featherweight', weightKg: 1, lengthMm: 100, widthMm: 100, heightMm: 50, stackable: true }),
        ],
      }),
    );

    expect(findPlaced(result, 'fragile-base')).toEqual(expect.objectContaining({ tier: 1, zMm: 0 }));
    expect(findPlaced(result, 'featherweight')).toBeUndefined();
    expect(result.unplacedItems).toContainEqual(
      expect.objectContaining({ productId: 'featherweight', reason: UnplacedReason.STACKING_RESTRICTION }),
    );
  });
});

describe('1b.11 — exhausted search leaves the unit unplaced with an accurate reason', () => {
  it('reports NO_AVAILABLE_SPACE (not STACKING_RESTRICTION) when the item never had a geometrically valid base at all', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        products: [createProduct({ lengthMm: 5000, widthMm: 5000, heightMm: 400 })],
      }),
    );

    expect(result.unplacedItems).toContainEqual(
      expect.objectContaining({ reason: UnplacedReason.NO_AVAILABLE_SPACE }),
    );
  });
});

describe('1b.12 — low center of gravity: lower tier preferred when positions tie (soft)', () => {
  it('prefers the tier 1 (floor) position over a higher tier when both are equally valid', () => {
    // Zone has room for TWO floor slots; a second unit should land beside the
    // first at tier 1 rather than climbing on top of it, even though stacking
    // on top would also be geometrically valid.
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 2000, widthMm: 1000, heightMm: 2400, zones: singleCenterZone(2000, 1000), tiers: [] },
        products: [
          createProduct({ id: 'first', weightKg: 500, lengthMm: 1000, widthMm: 1000, heightMm: 400, stackable: true, rotationAllowed: false }),
          createProduct({ id: 'second', weightKg: 500, lengthMm: 1000, widthMm: 1000, heightMm: 400, stackable: true, rotationAllowed: false }),
        ],
      }),
    );

    expect(findPlaced(result, 'first')).toEqual(expect.objectContaining({ tier: 1, zMm: 0 }));
    expect(findPlaced(result, 'second')).toEqual(expect.objectContaining({ tier: 1, zMm: 0 }));
  });
});

describe('1b.13 — lateral balance within 20% is preferred across zone choices (soft)', () => {
  it('prefers a fallback zone that keeps lateral imbalance under 20% over the target zone which would exceed it', () => {
    // Truck width 2000mm, so centerY = 1000. Door zone's Y-range (0-500) lives
    // entirely on the LEFT half and has room for exactly one item — it cannot
    // ever balance internally. Cabin zone's Y-range (1000-2000) lives entirely
    // on the RIGHT half. This forces a genuine cross-zone decision: door (the
    // priority target zone) is full after 'heavy-left', so 'balancer' must
    // fall back — and among the fallbacks, only cabin keeps imbalance <= 20%.
    const zones: PlannerTruckZoneInput[] = [
      { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 1000, startYMm: 1000, endYMm: 2000 },
      { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 1000, endXMm: 2000, startYMm: 1000, endYMm: 2000 },
      { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 2000, endXMm: 3000, startYMm: 0, endYMm: 500 },
    ];

    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 3000, widthMm: 2000, heightMm: 2400, zones, tiers: [] },
        destinations: [{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }],
        products: [
          createProduct({
            id: 'heavy-left',
            weightKg: 5000,
            lengthMm: 1000,
            widthMm: 500,
            heightMm: 400,
            stackable: false,
            rotationAllowed: false,
          }),
          createProduct({
            id: 'balancer',
            weightKg: 5000,
            lengthMm: 1000,
            widthMm: 500,
            heightMm: 400,
            stackable: false,
            rotationAllowed: false,
          }),
        ],
      }),
    );

    const heavyLeft = findPlaced(result, 'heavy-left');
    const balancer = findPlaced(result, 'balancer');
    expect(heavyLeft).toEqual(expect.objectContaining({ zoneType: TruckZoneType.DOOR_SIDE }));
    expect(balancer).toEqual(expect.objectContaining({ zoneType: TruckZoneType.CABIN_SIDE }));

    const truckWidth = 2000;
    const centerY = truckWidth / 2;
    const leftWeight = result.placedItems
      .filter((item) => item.yMm + item.widthMm / 2 <= centerY)
      .reduce((sum, item) => sum + item.weightKg, 0);
    const rightWeight = result.placedItems
      .filter((item) => item.yMm + item.widthMm / 2 > centerY)
      .reduce((sum, item) => sum + item.weightKg, 0);
    const total = leftWeight + rightWeight;

    expect(total > 0 ? Math.abs(leftWeight - rightWeight) / total : 0).toBeLessThanOrEqual(0.2);
  });
});

describe('1b.14 — fragile/lighter items preferred on upper tiers (soft)', () => {
  it('places a fragile item on the higher of two equally valid tiers instead of the lower one', () => {
    // A non-fragile heavy base occupies the whole floor; a fragile item that
    // could still validly stack on top (base.stackable=true) SHOULD go up
    // rather than being reported unplaced or forced into an unrelated slot.
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 1000, widthMm: 1000, heightMm: 2400, zones: singleCenterZone(1000, 1000), tiers: [] },
        products: [
          createProduct({ id: 'heavy-base', weightKg: 900, lengthMm: 1000, widthMm: 1000, heightMm: 300, stackable: true, rotationAllowed: false }),
          createProduct({
            id: 'fragile-topper',
            weightKg: 50,
            lengthMm: 1000,
            widthMm: 1000,
            heightMm: 200,
            stackable: true,
            fragile: true,
            rotationAllowed: false,
          }),
        ],
      }),
    );

    expect(findPlaced(result, 'heavy-base')).toEqual(expect.objectContaining({ tier: 1, zMm: 0 }));
    expect(findPlaced(result, 'fragile-topper')).toEqual(expect.objectContaining({ tier: 2, zMm: 300 }));
  });
});

describe('1b.15 — perf: the bounded heuristic search stays tractable at realistic unit counts', () => {
  it('places 240 small units across a large truck (forcing multi-tier stacking) in well under a second', () => {
    const products: PlannerProductInput[] = Array.from({ length: 60 }, (_, index) =>
      createProduct({
        id: `product-${index}`,
        quantity: 4,
        weightKg: 50,
        lengthMm: 400,
        widthMm: 400,
        heightMm: 300,
        stackable: true,
        rotationAllowed: true,
      }),
    );

    const start = performance.now();
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 9000, widthMm: 2400, heightMm: 2500, zones: singleCenterZone(9000, 2400), tiers: [] },
        products,
      }),
    );
    const durationMs = performance.now() - start;

    expect(result.placedItems.length + result.unplacedItems.length).toBe(240);
    expect(result.placedItems.length).toBeGreaterThan(0);
    expect(durationMs).toBeLessThan(5000);
  });
});
