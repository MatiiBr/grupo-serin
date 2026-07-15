import { AlertSeverity, AlertType, LoadingMethod, OperationStatus, PlanStatus, ProductFamily, TruckZoneType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { overlaps3D } from '../domain/loading-planner/geometry';
import { HeuristicLoadingPlanner } from '../domain/loading-planner/heuristic-loading-planner';
import type { LoadingPlannerInput, PlannerProductInput, PlannerTruckZoneInput } from '../domain/loading-planner/loading-planner.types';
import { PrismaService } from '../prisma/prisma.service';
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

/**
 * WARNING 3, part 1 (verify-report) — "Pre-migration single-floor plan
 * remains valid" was structurally satisfied by the `tier Int @default(1)`
 * migration column but never exercised by a test simulating an actual
 * pre-existing row (created before the tier model existed) flowing through
 * validation. Existing backward-compat coverage only proved NEW plans
 * generate tier:1/zMm:0 — this proves an OLD row (tier:1, zMm:0, on a truck
 * with no configured TruckTier rows — the exact shape a migrated legacy
 * truck/placement has) still passes `recalculatePlan` without tripping any
 * of the new tier-aware checks (HEIGHT_EXCEEDED, MAX_WEIGHT_EXCEEDED,
 * STACKING_RISK, OVERLAP, OUT_OF_BOUNDS).
 */
describe('LoadingPlansService.recalculatePlan — pre-migration single-floor placement remains valid (WARNING 3)', () => {
  it('does not raise any bounds/weight/stacking alert for a legacy tier:1, zMm:0 placement on a truck with no configured tiers', () => {
    const service = createService();
    // `createTruck()`'s default already has `tiers: []` — exactly what a
    // truck created before the TruckTier table existed has (no backfill,
    // per design: "no tier data migration is needed").
    const truck = createTruck();
    const plan = createPlan({ truck });
    const legacyItem = createPlacedItem({
      id: 'legacy-1',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      tier: 1,
      lengthMm: 500,
      widthMm: 500,
      heightMm: 500,
      product: { code: 'P-1', weightKg: 500, fragile: false },
    });

    const validation = (service as never as { recalculatePlan: Function }).recalculatePlan(plan, [legacyItem]);

    const blockingTypes: AlertType[] = [
      AlertType.OVERLAP,
      AlertType.OUT_OF_BOUNDS,
      AlertType.HEIGHT_EXCEEDED,
      AlertType.MAX_WEIGHT_EXCEEDED,
      AlertType.STACKING_RISK,
    ];
    const blocking = validation.alerts.filter((alert: { type: AlertType }) => blockingTypes.includes(alert.type));
    expect(blocking).toHaveLength(0);
  });
});

/**
 * WARNING 2 (verify-report) — the generated `tier` was never exercised on
 * the actual DB write path (`tx.placedItem.create` in `generate()`,
 * loading-plans.service.ts ~line 118). These specs mock `$transaction`
 * (same convention as `dispatch.service.spec.ts` /
 * `catalog-stabilization.spec.ts`) and assert the persisted `data.tier`
 * matches what the planner computed — not just what the in-memory result
 * object carries.
 */
describe('LoadingPlansService.generate — persists the planner-computed tier (WARNING 2)', () => {
  function createOperation(
    overrides: {
      truck?: Partial<{
        lengthMm: number;
        widthMm: number;
        heightMm: number;
        zones: Array<{ id: string; type: TruckZoneType; maxWeightKg: number | null; startXMm: number; endXMm: number; startYMm: number; endYMm: number }>;
        tiers: Array<{ id: string; level: number; maxHeightMm?: number | null; maxWeightKg?: number | null }>;
      }>;
    } = {},
  ) {
    return {
      id: 'operation-1',
      truck: {
        id: 'truck-1',
        loadingMethod: LoadingMethod.REAR,
        maxPayloadKg: null,
        lengthMm: 2000,
        widthMm: 1000,
        heightMm: 2000,
        zones: [{ id: 'zone-center', type: TruckZoneType.CENTER, maxWeightKg: null, startXMm: 0, endXMm: 2000, startYMm: 0, endYMm: 1000 }],
        tiers: [],
        ...overrides.truck,
      },
      destinations: [{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }],
      products: [
        {
          id: 'product-1',
          code: 'P-1',
          family: ProductFamily.GENERIC_PACKAGE,
          description: null,
          destinationId: 'destination-1',
          quantity: 2,
          weightKg: 100,
          lengthMm: 500,
          widthMm: 500,
          heightMm: 500,
          stackable: true,
          rotationAllowed: false,
          fragile: false,
          maxStackLoadKg: null,
          destination: { id: 'destination-1', name: 'First stop', unloadingOrder: 1 },
        },
      ],
      plans: [],
    };
  }

  function createServiceWithMockedTransaction(operation = createOperation()) {
    const transactionClient = {
      loadingPlan: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: 'plan-1' }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'plan-1',
          operation: { code: 'OP-1', status: OperationStatus.PLAN_GENERATED },
          placedItems: [],
          unplaced: [],
          steps: [],
          alerts: [],
          metrics: null,
        }),
      },
      placedItem: { create: vi.fn().mockResolvedValue({ id: 'placed-1' }) },
      unplacedItem: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      loadingStep: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      loadAlert: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      planMetrics: { create: vi.fn().mockResolvedValue({}) },
      loadOperation: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      loadOperation: { findUnique: vi.fn().mockResolvedValue(operation) },
      $transaction: vi.fn((callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient)),
    };
    const audit = { record: vi.fn(), recordWithClient: vi.fn() };
    const service = new LoadingPlansService(prisma as unknown as PrismaService, audit as unknown as AuditService);

    return { prisma, service, transactionClient };
  }

  it('writes PlacedItem.tier equal to the tier the solver computed for each unit', async () => {
    // Truck floor exactly matches one unit's footprint (500x500), so the
    // second unit CANNOT fit beside the first on the floor and must stack
    // at tier 2 — this forces a real, non-degenerate multi-tier result.
    const operation = createOperation({
      truck: {
        lengthMm: 500,
        widthMm: 500,
        heightMm: 1200,
        zones: [{ id: 'zone-center', type: TruckZoneType.CENTER, maxWeightKg: null, startXMm: 0, endXMm: 500, startYMm: 0, endYMm: 500 }],
      },
    });
    const { service, transactionClient } = createServiceWithMockedTransaction(operation);

    // Derive the expected result via the SAME production mapping
    // (`toPlannerInput`) the service itself uses internally, so this
    // fixture cannot silently drift from what `service.generate()` feeds
    // the solver.
    const plannerInput = (service as never as { toPlannerInput: (op: unknown) => LoadingPlannerInput }).toPlannerInput(operation);
    const expected = new HeuristicLoadingPlanner().generate(plannerInput);

    // Sanity: this fixture must force real stacking (tier > 1 for at least
    // one unit), otherwise the assertion below can't distinguish "tier was
    // persisted correctly" from "tier was always 1 by coincidence".
    expect(expected.placedItems.some((item) => item.tier > 1)).toBe(true);

    await service.generate('operation-1');

    expect(transactionClient.placedItem.create).toHaveBeenCalledTimes(expected.placedItems.length);
    for (const item of expected.placedItems) {
      expect(transactionClient.placedItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: item.productId,
            unitIndex: item.unitIndex,
            tier: item.tier,
            zMm: item.zMm,
          }),
        }),
      );
    }
  });

  it('writes PlacedItem.tier 1 for a single-floor plan that never needs to stack (backward-compat, WARNING 3)', async () => {
    const { service, transactionClient } = createServiceWithMockedTransaction();

    await service.generate('operation-1');

    expect(transactionClient.placedItem.create).toHaveBeenCalled();
    for (const call of transactionClient.placedItem.create.mock.calls) {
      expect(call[0].data.tier).toBe(1);
      expect(call[0].data.zMm).toBe(0);
    }
  });

  it('honors both maxHeightMm and maxWeightKg on a fully configured TruckTier, end-to-end through the persist path (WARNING 3, full tier wiring)', async () => {
    // tier 1's maxWeightKg (150) is the actual blocking constraint: two
    // 100kg units would sum to 200kg, over cap, even though the truck floor
    // (2000x1000mm) has ample XY room for both 500x500 footprints side by
    // side. tier 1's maxHeightMm (1000) is generous — never the blocker.
    // If `maxWeightKg` were silently dropped between `operation.truck.tiers`
    // and the solver, the cap would never fire and the second unit would
    // stay on the empty floor (tier 1, z=0) instead of stacking — the
    // solver always prefers the lowest available z. This assertion fails
    // in that case, proving the field is genuinely read end-to-end.
    const operation = createOperation({
      truck: {
        tiers: [
          { id: 'tier-1', level: 1, maxHeightMm: 1000, maxWeightKg: 150 },
          { id: 'tier-2', level: 2, maxHeightMm: 1000, maxWeightKg: 500 },
        ],
      },
    });
    const { service, transactionClient } = createServiceWithMockedTransaction(operation);

    await service.generate('operation-1');

    expect(transactionClient.placedItem.create).toHaveBeenCalledTimes(2);
    const tiers = transactionClient.placedItem.create.mock.calls.map((call) => call[0].data.tier).sort();
    expect(tiers).toEqual([1, 2]);
  });
});
