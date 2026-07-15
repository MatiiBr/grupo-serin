import { AlertSeverity, AlertType, TruckZoneType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { overlaps3D } from '../domain/loading-planner/geometry';
import { HeuristicLoadingPlanner } from '../domain/loading-planner/heuristic-loading-planner';
import type { LoadingPlannerInput, PlannerProductInput, PlannerTruckZoneInput } from '../domain/loading-planner/loading-planner.types';
import { LoadingPlansService } from './loading-plans.service';

/**
 * Fase 1c — `recalculatePlan` wiring + generator/validator parity.
 * `recalculatePlan` is a private method; these specs invoke it via `(service
 * as any).recalculatePlan(plan, placedItems)` against hand-built Prisma-shaped
 * fixtures, mirroring the payload `updatePlacedItem` would pass it. No DB
 * access is required — `recalculatePlan` is pure given its inputs.
 */

function createService() {
  return new LoadingPlansService({} as never, {} as never);
}

function createTruck(
  overrides: Partial<{
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    maxPayloadKg: number | null;
    zones: Array<{ id: string; type: TruckZoneType; maxWeightKg: number | null; startXMm?: number; endXMm?: number; startYMm?: number; endYMm?: number }>;
    tiers: Array<{ level: number; maxHeightMm?: number | null; maxWeightKg: number | null }>;
  }> = {},
) {
  return {
    id: 'truck-1',
    lengthMm: 2000,
    widthMm: 1000,
    heightMm: 2000,
    maxPayloadKg: null,
    zones: [
      { id: 'zone-center', type: TruckZoneType.CENTER, maxWeightKg: null, startXMm: 0, endXMm: 2000, startYMm: 0, endYMm: 1000 },
    ],
    tiers: [],
    ...overrides,
  };
}

function createPlacedItem(
  overrides: Partial<{
    id: string;
    productId: string;
    unitIndex: number;
    xMm: number;
    yMm: number;
    zMm: number;
    tier: number;
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    product: { code: string; weightKg: number; fragile: boolean };
  }> = {},
) {
  return {
    id: 'placed-1',
    productId: 'product-1',
    unitIndex: 1,
    xMm: 0,
    yMm: 0,
    zMm: 0,
    tier: 1,
    lengthMm: 500,
    widthMm: 500,
    heightMm: 500,
    product: { code: 'P-1', weightKg: 100, fragile: false },
    ...overrides,
  };
}

function createPlan(overrides: { truck?: ReturnType<typeof createTruck>; unplaced?: unknown[] } = {}) {
  return {
    operation: { truck: overrides.truck ?? createTruck() },
    unplaced: overrides.unplaced ?? [],
  } as never;
}

describe('LoadingPlansService.recalculatePlan — per-tier and per-zone weight caps (1c.3)', () => {
  it('raises MAX_WEIGHT_EXCEEDED when a manual edit pushes a tier over its configured cap', () => {
    const service = createService();
    const truck = createTruck({ tiers: [{ level: 1, maxWeightKg: 150 }] });
    const plan = createPlan({ truck });
    const items = [
      createPlacedItem({ id: 'a', xMm: 0, yMm: 0, tier: 1, product: { code: 'P-1', weightKg: 100, fragile: false } }),
      createPlacedItem({ id: 'b', xMm: 600, yMm: 0, tier: 1, product: { code: 'P-2', weightKg: 100, fragile: false } }),
    ];

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, items);

    expect(validation.alerts).toContainEqual(
      expect.objectContaining({ type: AlertType.MAX_WEIGHT_EXCEEDED, severity: AlertSeverity.CRITICAL }),
    );
  });

  it('does not raise MAX_WEIGHT_EXCEEDED for a tier when its cap is not configured', () => {
    const service = createService();
    const plan = createPlan();
    const items = [createPlacedItem({ id: 'a', product: { code: 'P-1', weightKg: 100_000, fragile: false } })];

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, items);

    expect(validation.alerts).not.toContainEqual(expect.objectContaining({ type: AlertType.MAX_WEIGHT_EXCEEDED }));
  });

  it('raises MAX_WEIGHT_EXCEEDED when a manual edit pushes a zone over its configured cap', () => {
    const service = createService();
    const truck = createTruck({
      zones: [{ id: 'zone-center', type: TruckZoneType.CENTER, maxWeightKg: 150, startXMm: 0, endXMm: 2000, startYMm: 0, endYMm: 1000 }],
    });
    const plan = createPlan({ truck });
    const items = [
      createPlacedItem({ id: 'a', xMm: 0, yMm: 0, product: { code: 'P-1', weightKg: 100, fragile: false } }),
      createPlacedItem({ id: 'b', xMm: 600, yMm: 0, product: { code: 'P-2', weightKg: 100, fragile: false } }),
    ];

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, items);

    expect(validation.alerts).toContainEqual(
      expect.objectContaining({ type: AlertType.MAX_WEIGHT_EXCEEDED, severity: AlertSeverity.CRITICAL }),
    );
  });
});

describe('LoadingPlansService.recalculatePlan — HEIGHT_EXCEEDED distinct from OUT_OF_BOUNDS (1c.4)', () => {
  it('raises HEIGHT_EXCEEDED (not OUT_OF_BOUNDS) when zMm+heightMm exceeds truck height but XY stays in bounds', () => {
    const service = createService();
    const truck = createTruck({ heightMm: 1000 });
    const plan = createPlan({ truck });
    const items = [createPlacedItem({ zMm: 800, heightMm: 500 })];

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, items);

    expect(validation.alerts).toContainEqual(expect.objectContaining({ type: AlertType.HEIGHT_EXCEEDED }));
    expect(validation.alerts).not.toContainEqual(expect.objectContaining({ type: AlertType.OUT_OF_BOUNDS }));
  });

  it('still raises OUT_OF_BOUNDS (not HEIGHT_EXCEEDED) when an item sits outside the XY footprint but within height', () => {
    const service = createService();
    const truck = createTruck({ lengthMm: 1000, widthMm: 1000, heightMm: 2000 });
    const plan = createPlan({ truck });
    const items = [createPlacedItem({ xMm: 900, lengthMm: 500, heightMm: 500 })];

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, items);

    expect(validation.alerts).toContainEqual(expect.objectContaining({ type: AlertType.OUT_OF_BOUNDS }));
    expect(validation.alerts).not.toContainEqual(expect.objectContaining({ type: AlertType.HEIGHT_EXCEEDED }));
  });
});

describe('LoadingPlansService.recalculatePlan — STACKING_RISK on fragile bases (1c.5)', () => {
  it('raises STACKING_RISK when a manual edit places an item on top of a fragile item', () => {
    const service = createService();
    const plan = createPlan();
    const base = createPlacedItem({ id: 'base', tier: 1, xMm: 0, yMm: 0, zMm: 0, heightMm: 400, lengthMm: 500, widthMm: 500, product: { code: 'BASE', weightKg: 200, fragile: true } });
    const topper = createPlacedItem({ id: 'topper', tier: 2, xMm: 0, yMm: 0, zMm: 400, heightMm: 300, lengthMm: 500, widthMm: 500, product: { code: 'TOP', weightKg: 50, fragile: false } });

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, [base, topper]);

    expect(validation.alerts).toContainEqual(
      expect.objectContaining({ type: AlertType.STACKING_RISK, placedItemId: 'topper', severity: AlertSeverity.WARNING }),
    );
  });

  it('does not raise STACKING_RISK when the base item is not fragile', () => {
    const service = createService();
    const plan = createPlan();
    const base = createPlacedItem({ id: 'base', tier: 1, xMm: 0, yMm: 0, zMm: 0, heightMm: 400, lengthMm: 500, widthMm: 500, product: { code: 'BASE', weightKg: 200, fragile: false } });
    const topper = createPlacedItem({ id: 'topper', tier: 2, xMm: 0, yMm: 0, zMm: 400, heightMm: 300, lengthMm: 500, widthMm: 500, product: { code: 'TOP', weightKg: 50, fragile: false } });

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, [base, topper]);

    expect(validation.alerts).not.toContainEqual(expect.objectContaining({ type: AlertType.STACKING_RISK }));
  });
});

describe('LoadingPlansService.recalculatePlan — overlap rule parity with the generator (1c.6)', () => {
  it('agrees with the shared overlaps3D check used by the solver: overlapping pair', () => {
    const a = { xMm: 0, yMm: 0, zMm: 0, lengthMm: 500, widthMm: 500, heightMm: 500 };
    const b = { xMm: 100, yMm: 100, zMm: 100, lengthMm: 500, widthMm: 500, heightMm: 500 };
    expect(overlaps3D(a, b)).toBe(true);

    const service = createService();
    const plan = createPlan();
    const items = [
      createPlacedItem({ id: 'a', ...a, product: { code: 'A', weightKg: 10, fragile: false } }),
      createPlacedItem({ id: 'b', ...b, product: { code: 'B', weightKg: 10, fragile: false } }),
    ];

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, items);

    expect(validation.alerts).toContainEqual(expect.objectContaining({ type: AlertType.OVERLAP, placedItemId: 'a' }));
  });

  it('agrees with the shared overlaps3D check used by the solver: stacked (non-overlapping) pair', () => {
    const a = { xMm: 0, yMm: 0, zMm: 0, lengthMm: 500, widthMm: 500, heightMm: 500 };
    const b = { xMm: 0, yMm: 0, zMm: 500, lengthMm: 500, widthMm: 500, heightMm: 500 };
    expect(overlaps3D(a, b)).toBe(false);

    const service = createService();
    const plan = createPlan();
    const items = [
      createPlacedItem({ id: 'a', ...a, tier: 1, product: { code: 'A', weightKg: 10, fragile: false } }),
      createPlacedItem({ id: 'b', ...b, tier: 2, product: { code: 'B', weightKg: 10, fragile: false } }),
    ];

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, items);

    expect(validation.alerts).not.toContainEqual(expect.objectContaining({ type: AlertType.OVERLAP }));
  });

  it('round-trips the generator\'s own multi-tier output through recalculatePlan with zero overlap/bounds/height divergence', () => {
    const zones: PlannerTruckZoneInput[] = [
      { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 1000 },
    ];
    const createProduct = (overrides: Partial<PlannerProductInput> = {}): PlannerProductInput => ({
      id: 'product-1',
      code: 'P-1',
      family: 'GENERIC_PACKAGE',
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
    });
    const input: LoadingPlannerInput = {
      truck: {
        id: 'truck-1',
        loadingMethod: 'REAR',
        maxPayloadKg: 24_000,
        lengthMm: 1000,
        widthMm: 1000,
        heightMm: 2400,
        zones,
        tiers: [],
      },
      destinations: [{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }],
      products: [
        createProduct({ id: 'base', weightKg: 500, heightMm: 500 }),
        createProduct({ id: 'topper', weightKg: 300, heightMm: 400 }),
      ],
    };

    const result = new HeuristicLoadingPlanner().generate(input);
    expect(result.placedItems.length).toBe(2);

    const service = createService();
    const truck = createTruck({
      lengthMm: input.truck.lengthMm,
      widthMm: input.truck.widthMm,
      heightMm: input.truck.heightMm,
      zones: zones.map((zone) => ({ id: zone.id, type: zone.type as TruckZoneType, maxWeightKg: null, startXMm: zone.startXMm, endXMm: zone.endXMm, startYMm: zone.startYMm, endYMm: zone.endYMm })),
    });
    const plan = createPlan({ truck });
    const items = result.placedItems.map((item, index) =>
      createPlacedItem({
        id: `placed-${index}`,
        productId: item.productId,
        unitIndex: item.unitIndex,
        xMm: item.xMm,
        yMm: item.yMm,
        zMm: item.zMm,
        tier: item.tier,
        lengthMm: item.lengthMm,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        product: { code: item.productId, weightKg: item.weightKg, fragile: false },
      }),
    );

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, items);
    const divergentTypes: AlertType[] = [AlertType.OVERLAP, AlertType.OUT_OF_BOUNDS, AlertType.HEIGHT_EXCEEDED];
    const divergent = validation.alerts.filter((alert: { type: AlertType }) => divergentTypes.includes(alert.type));

    expect(divergent).toHaveLength(0);
  });
});
