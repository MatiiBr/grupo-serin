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
    expect(result.evaluation.score).toBeGreaterThan(0);
    expect(result.evaluation.hardViolationCount).toBe(0);

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

  it('adds a critical alert when generated placement exceeds zone max weight', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { zones: [{ ...fullWidthZones[2], maxWeightKg: 400 }] },
        products: [createProduct({ weightKg: 500 })],
      }),
    );

    expect(result.evaluation.hardViolationCount).toBe(1);
    expect(result.alerts).toContainEqual(expect.objectContaining({
      severity: AlertSeverity.CRITICAL,
      type: AlertType.MAX_WEIGHT_EXCEEDED,
      message: expect.stringContaining('zone'),
    }));
  });

  it('selects an alternate candidate when it avoids a zone max weight violation', () => {
    const zones: PlannerTruckZoneInput[] = [
      { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 1000 },
      { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 1000, endXMm: 2000, startYMm: 0, endYMm: 1000 },
      { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 2000, endXMm: 3000, startYMm: 0, endYMm: 1000, maxWeightKg: 400 },
    ];

    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 3000, widthMm: 1000, heightMm: 1000, zones },
        products: [
          createProduct({ id: 'heavy-product', weightKg: 500, lengthMm: 1000, widthMm: 1000, heightMm: 300 }),
          createProduct({ id: 'light-product', weightKg: 100, lengthMm: 1000, widthMm: 1000, heightMm: 300 }),
        ],
      }),
    );

    expect(result.placedItems).toHaveLength(2);
    expect(result.evaluation.hardViolationCount).toBe(0);
    expect(result.alerts).not.toContainEqual(expect.objectContaining({ message: expect.stringContaining('zone') }));
    expect(result.placedItems).toContainEqual(expect.objectContaining({ productId: 'light-product', zoneType: TruckZoneType.DOOR_SIDE }));
    expect(result.placedItems).toContainEqual(expect.objectContaining({ productId: 'heavy-product', zoneType: TruckZoneType.CABIN_SIDE }));
    expect(result.candidateDiagnostics).toEqual(expect.objectContaining({
      winnerIndex: expect.any(Number),
      winnerName: expect.any(String),
    }));
    expect(result.candidateDiagnostics?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        index: expect.any(Number),
        name: expect.any(String),
        score: expect.any(Number),
        hardViolationCount: expect.any(Number),
        placedItemCount: 2,
        unplacedItemCount: 0,
      }),
    ]));
  });

  it('keeps the current ordering when candidate scores tie', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        products: [
          createProduct({ id: 'heavy-product', weightKg: 500, lengthMm: 1000, widthMm: 500, heightMm: 300 }),
          createProduct({ id: 'light-product', weightKg: 100, lengthMm: 1000, widthMm: 500, heightMm: 300 }),
        ],
      }),
    );

    expect(result.evaluation.hardViolationCount).toBe(0);
    expect(result.placedItems.map((item) => item.productId)).toEqual(['heavy-product', 'light-product']);
    expect(result.candidateDiagnostics).toEqual(expect.objectContaining({ winnerIndex: 0, winnerName: 'current' }));
    expect(result.candidateDiagnostics?.candidates.map((candidate) => candidate.index)).toEqual([0, 1]);
  });
});
