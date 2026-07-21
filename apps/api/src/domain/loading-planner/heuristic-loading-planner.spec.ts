import { AlertSeverity, AlertType, LoadingMethod, ProductFamily, TruckZoneType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { HeuristicLoadingPlanner } from './heuristic-loading-planner';
import type { LoadingPlannerInput, PlannerProductInput, PlannerTruckZoneInput } from './loading-planner.types';

const fullWidthZones: PlannerTruckZoneInput[] = [
  { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 3000, startYMm: 0, endYMm: 2000 },
  { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 3000, endXMm: 6000, startYMm: 0, endYMm: 2000 },
  { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 6000, endXMm: 9000, startYMm: 0, endYMm: 2000 },
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

describe('HeuristicLoadingPlanner', () => {
  it('places valid items within truck bounds and reports placed metrics', () => {
    const result = new HeuristicLoadingPlanner().generate(createInput());

    expect(result.placedItems).toHaveLength(1);
    expect(result.unplacedItems).toHaveLength(0);
    expect(result.metrics.placedItemCount).toBe(1);
    expect(result.metrics.unplacedItemCount).toBe(0);
    expect(result.metrics.totalWeightKg).toBe(500);
    expect(result.metrics.placedWeightKg).toBe(500);
    expect(result.metrics.unplacedWeightKg).toBe(0);

    const placed = result.placedItems[0];
    expect(placed.xMm).toBeGreaterThanOrEqual(0);
    expect(placed.yMm).toBeGreaterThanOrEqual(0);
    expect(placed.xMm + placed.lengthMm).toBeLessThanOrEqual(9000);
    expect(placed.yMm + placed.widthMm).toBeLessThanOrEqual(2000);
  });

  it('marks an oversized item as unplaced and emits a critical alert', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({ products: [createProduct({ lengthMm: 10_000, widthMm: 500, heightMm: 400 })] }),
    );

    expect(result.placedItems).toHaveLength(0);
    expect(result.unplacedItems).toHaveLength(1);
    expect(result.metrics.unplacedItemCount).toBe(1);
    expect(result.metrics.unplacedWeightKg).toBe(500);
    expect(result.alerts).toContainEqual(
      expect.objectContaining({
        productId: 'product-1',
        severity: AlertSeverity.CRITICAL,
        type: AlertType.UNPLACED_ITEM,
      }),
    );
  });

  it('places later unloading destinations toward the cabin and first unloading destinations toward the door', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        destinations: [
          { id: 'first-stop', name: 'First stop', unloadingOrder: 1 },
          { id: 'last-stop', name: 'Last stop', unloadingOrder: 3 },
        ],
        products: [
          createProduct({ id: 'door-product', destinationId: 'first-stop' }),
          createProduct({ id: 'cabin-product', destinationId: 'last-stop' }),
        ],
      }),
    );

    expect(result.placedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: 'cabin-product', zoneType: TruckZoneType.CABIN_SIDE }),
        expect.objectContaining({ productId: 'door-product', zoneType: TruckZoneType.DOOR_SIDE }),
      ]),
    );
  });

  it('assigns tier 1 to every placement when the load fits on the floor without stacking (backward-compat)', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({ products: [createProduct({ id: 'legacy-product' })] }),
    );

    expect(result.placedItems).toEqual([expect.objectContaining({ productId: 'legacy-product', tier: 1, zMm: 0 })]);
  });

  it('keeps every unit of a multi-unit product on tier 1 when they all fit side by side on the floor', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({ products: [createProduct({ id: 'multi-unit-product', quantity: 2 })] }),
    );

    expect(result.placedItems).toHaveLength(2);
    expect(result.placedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: 'multi-unit-product', unitIndex: 1, tier: 1, zMm: 0 }),
        expect.objectContaining({ productId: 'multi-unit-product', unitIndex: 2, tier: 1, zMm: 0 }),
      ]),
    );
  });

  it('only uses 90-degree rotation when rotation is allowed', () => {
    const narrowTruck = {
      lengthMm: 1000,
      widthMm: 800,
      heightMm: 1000,
      zones: [{ id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 800 }],
    };
    const dimensions = { lengthMm: 700, widthMm: 1000, heightMm: 200 };

    const withoutRotation = new HeuristicLoadingPlanner().generate(
      createInput({ truck: narrowTruck, products: [createProduct({ ...dimensions, rotationAllowed: false })] }),
    );
    const withRotation = new HeuristicLoadingPlanner().generate(
      createInput({ truck: narrowTruck, products: [createProduct({ ...dimensions, rotationAllowed: true })] }),
    );

    expect(withoutRotation.placedItems).toHaveLength(0);
    expect(withoutRotation.unplacedItems).toHaveLength(1);
    expect(withRotation.placedItems).toEqual([expect.objectContaining({ rotationDeg: 90, lengthMm: 1000, widthMm: 700 })]);
    expect(withRotation.unplacedItems).toHaveLength(0);
  });
});

/**
 * loading-agent-llm Phase 1 — additive `allowedZones`/`maxTier` fields on
 * `PlannerProductInput`. Both are optional; undefined must behave exactly as
 * before (identity), so the whole pre-existing suite above stays green
 * unmodified. These specs cover the two NEW filters only.
 */
describe('HeuristicLoadingPlanner — allowedZones confinement (loading-agent-llm 1.1)', () => {
  it('confines a product to its allowedZones even when its natural target zone differs', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        destinations: [
          { id: 'first-stop', name: 'First stop', unloadingOrder: 1 },
          { id: 'last-stop', name: 'Last stop', unloadingOrder: 3 },
        ],
        // last-stop naturally targets CABIN_SIDE (see zone-targeting test above).
        products: [createProduct({ id: 'confined-product', destinationId: 'last-stop', allowedZones: [TruckZoneType.DOOR_SIDE] })],
      }),
    );

    expect(result.placedItems).toEqual([expect.objectContaining({ productId: 'confined-product', zoneType: TruckZoneType.DOOR_SIDE })]);
  });

  it('leaves an unrestricted product (allowedZones undefined) placed in its natural target zone (identity)', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        destinations: [
          { id: 'first-stop', name: 'First stop', unloadingOrder: 1 },
          { id: 'last-stop', name: 'Last stop', unloadingOrder: 3 },
        ],
        products: [createProduct({ id: 'unrestricted-product', destinationId: 'last-stop' })],
      }),
    );

    expect(result.placedItems).toEqual([expect.objectContaining({ productId: 'unrestricted-product', zoneType: TruckZoneType.CABIN_SIDE })]);
  });

  it('leaves a product unplaced when its only allowedZone is geometrically too small, ignoring the other (larger) zones', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        products: [createProduct({ id: 'stranded-product', lengthMm: 500, widthMm: 500, heightMm: 400, allowedZones: [TruckZoneType.DOOR_SIDE] })],
        truck: {
          zones: [
            { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 3000, startYMm: 0, endYMm: 2000 },
            { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 3000, endXMm: 6000, startYMm: 0, endYMm: 2000 },
            // Too narrow (100mm) to fit a 500mm-long product — the only allowed zone is infeasible.
            { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 6000, endXMm: 6100, startYMm: 0, endYMm: 2000 },
          ],
        },
      }),
    );

    expect(result.placedItems).toHaveLength(0);
    expect(result.unplacedItems).toEqual([expect.objectContaining({ productId: 'stranded-product' })]);
  });
});

describe('HeuristicLoadingPlanner — maxTier cap (loading-agent-llm 1.1)', () => {
  const singleCenterZone: PlannerTruckZoneInput[] = [{ id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 1000 }];

  function stackingInput(overrides: { products: PlannerProductInput[] }): LoadingPlannerInput {
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
      products: overrides.products,
    };
  }

  it('never places a product above its maxTier, leaving it unplaced when only a higher tier surface is available', () => {
    const result = new HeuristicLoadingPlanner().generate(
      stackingInput({
        products: [
          createProduct({ id: 'base', lengthMm: 1000, widthMm: 1000, heightMm: 500, stackable: true }),
          createProduct({ id: 'capped-topper', lengthMm: 1000, widthMm: 1000, heightMm: 400, stackable: true, maxTier: 1 }),
        ],
      }),
    );

    const base = result.placedItems.find((item) => item.productId === 'base');
    const topper = result.placedItems.find((item) => item.productId === 'capped-topper');

    expect(base).toBeDefined();
    expect(base?.tier).toBe(1);
    expect(topper).toBeUndefined();
    expect(result.unplacedItems).toEqual([expect.objectContaining({ productId: 'capped-topper' })]);
  });

  it('stacks a product onto tier 2 when maxTier is undefined (identity regression for the same fixture)', () => {
    const result = new HeuristicLoadingPlanner().generate(
      stackingInput({
        products: [
          createProduct({ id: 'base', lengthMm: 1000, widthMm: 1000, heightMm: 500, stackable: true }),
          createProduct({ id: 'uncapped-topper', lengthMm: 1000, widthMm: 1000, heightMm: 400, stackable: true }),
        ],
      }),
    );

    const topper = result.placedItems.find((item) => item.productId === 'uncapped-topper');
    expect(topper).toBeDefined();
    expect(topper?.tier).toBe(2);
  });
});
