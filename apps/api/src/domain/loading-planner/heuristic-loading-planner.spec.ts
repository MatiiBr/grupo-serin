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

  it('splits full-width item weight across left and right sides', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { widthMm: 1000, zones: fullWidthZones.map((zone) => ({ ...zone, startYMm: 0, endYMm: 1000 })) },
        products: [
          createProduct({ id: 'heavy-product', weightKg: 500, lengthMm: 1000, widthMm: 1000, heightMm: 300 }),
          createProduct({ id: 'light-product', weightKg: 100, lengthMm: 1000, widthMm: 1000, heightMm: 300 }),
        ],
      }),
    );

    expect(result.metrics.leftWeightKg).toBe(300);
    expect(result.metrics.rightWeightKg).toBe(300);
    expect(result.alerts).not.toContainEqual(expect.objectContaining({
      severity: AlertSeverity.WARNING,
      type: AlertType.WEIGHT_IMBALANCE,
      message: expect.stringContaining('peso lateral'),
    }));
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

  it('sequences rear loading from cabin side toward doors without changing placement positions', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        destinations: [
          { id: 'first-stop', name: 'First stop', unloadingOrder: 1 },
          { id: 'last-stop', name: 'Last stop', unloadingOrder: 3 },
        ],
        products: [
          createProduct({ id: 'door-product', destinationId: 'first-stop', lengthMm: 1000, widthMm: 1000, rotationAllowed: false }),
          createProduct({ id: 'cabin-product', destinationId: 'last-stop', lengthMm: 1000, widthMm: 1000, rotationAllowed: false }),
        ],
      }),
    );

    const cabinItem = result.placedItems.find((item) => item.productId === 'cabin-product')!;
    const doorItem = result.placedItems.find((item) => item.productId === 'door-product')!;

    expect(cabinItem.xMm).toBeLessThan(doorItem.xMm);
    expect(cabinItem.sequence).toBeLessThan(doorItem.sequence);
    expect(result.steps.map((step) => step.productId)).toEqual(['cabin-product', 'door-product']);
  });

  it('uses neutral center-out sequencing within the same rear-loading x band', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: {
          lengthMm: 1000,
          widthMm: 1000,
          heightMm: 1000,
          zones: [{ id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 1000 }],
        },
        products: [createProduct({ id: 'side-by-side', quantity: 4, lengthMm: 1000, widthMm: 250, heightMm: 200, rotationAllowed: false })],
      }),
    );

    expect(result.unplacedItems).toHaveLength(0);
    expect(result.placedItems.map((item) => item.unitIndex)).toEqual([1, 2, 3, 4]);
    expect(result.steps.map((step) => step.unitIndex)).toEqual([2, 3, 1, 4]);
    expect(result.placedItems.map((item) => ({ unitIndex: item.unitIndex, sequence: item.sequence }))).toEqual([
      { unitIndex: 1, sequence: 3 },
      { unitIndex: 2, sequence: 1 },
      { unitIndex: 3, sequence: 2 },
      { unitIndex: 4, sequence: 4 },
    ]);
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

  it('stacks an item on a stackable base when floor space is occupied', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: {
          lengthMm: 1000,
          widthMm: 1000,
          heightMm: 1000,
          zones: [{ id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 1000 }],
        },
        products: [
          createProduct({ id: 'base-product', weightKg: 500, lengthMm: 1000, widthMm: 1000, heightMm: 300, stackable: true }),
          createProduct({ id: 'top-product', weightKg: 100, lengthMm: 1000, widthMm: 1000, heightMm: 300, stackable: false }),
        ],
      }),
    );

    expect(result.placedItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: 'base-product', zMm: 0 }),
      expect.objectContaining({ productId: 'top-product', zMm: 300 }),
    ]));
    expect(result.unplacedItems).toHaveLength(0);
    expect(result.metrics.maxHeightMm).toBe(600);
  });

  it('places a long item across zone boundaries when it fits the truck but not a single zone', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: {
          lengthMm: 9000,
          widthMm: 1000,
          heightMm: 1000,
          zones: [
            { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 3000, startYMm: 0, endYMm: 1000 },
            { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 3000, endXMm: 6000, startYMm: 0, endYMm: 1000 },
            { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 6000, endXMm: 9000, startYMm: 0, endYMm: 1000 },
          ],
        },
        products: [createProduct({ id: 'long-product', lengthMm: 6000, widthMm: 500, heightMm: 300, rotationAllowed: false })],
      }),
    );

    expect(result.unplacedItems).toHaveLength(0);
    expect(result.placedItems).toEqual([
      expect.objectContaining({
        productId: 'long-product',
        truckZoneId: 'zone-center',
        zoneType: TruckZoneType.CENTER,
        xMm: 0,
        yMm: 0,
        lengthMm: 6000,
        widthMm: 500,
      }),
    ]);
  });

  it('uses cross-zone fallback without overlapping existing placed items', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: {
          lengthMm: 9000,
          widthMm: 1000,
          heightMm: 1000,
          zones: [
            { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 3000, startYMm: 0, endYMm: 1000 },
            { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 3000, endXMm: 6000, startYMm: 0, endYMm: 1000 },
            { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 6000, endXMm: 9000, startYMm: 0, endYMm: 1000 },
          ],
        },
        products: [
          createProduct({ id: 'door-product', lengthMm: 3000, widthMm: 500, heightMm: 300, rotationAllowed: false }),
          createProduct({ id: 'long-product', weightKg: 100, lengthMm: 6000, widthMm: 500, heightMm: 300, rotationAllowed: false }),
        ],
      }),
    );

    expect(result.unplacedItems).toHaveLength(0);
    expect(result.placedItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: 'door-product', xMm: 6000, yMm: 0 }),
      expect.objectContaining({ productId: 'long-product', xMm: 0, yMm: 0, lengthMm: 6000 }),
    ]));
    expect(result.placedItems.find((item) => item.productId === 'long-product')!.xMm + 6000)
      .toBeLessThanOrEqual(result.placedItems.find((item) => item.productId === 'door-product')!.xMm);
  });

  it('assigns placed items to loading layers derived from z position', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: {
          lengthMm: 1000,
          widthMm: 1000,
          heightMm: 1200,
          zones: [{ id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 1000 }],
        },
        products: [
          createProduct({ id: 'base-product', weightKg: 500, lengthMm: 1000, widthMm: 1000, heightMm: 300, stackable: true }),
          createProduct({ id: 'top-product', weightKg: 100, lengthMm: 1000, widthMm: 1000, heightMm: 300, stackable: false }),
        ],
      }),
    );

    expect(result.loadingLayers).toHaveLength(12);
    expect(result.placedItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: 'base-product', layerNumber: 1, layerGroupLabel: 'Capas 1-4' }),
      expect.objectContaining({ productId: 'top-product', layerNumber: 4, layerGroupLabel: 'Capas 1-4' }),
    ]));
  });

  it('computes axle group load snapshots and marks exceeded groups', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: {
          lengthMm: 4000,
          widthMm: 1000,
          heightMm: 1000,
          zones: [{ id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 0, endXMm: 4000, startYMm: 0, endYMm: 1000 }],
          axleGroups: [
            { code: 'P2-FRONT', label: 'Eje delantero P2 demo', startXMm: 0, endXMm: 2000, maxWeightKg: 1200 },
            { code: 'P2-REAR', label: 'Grupo trasero P2 demo', startXMm: 2000, endXMm: 4000, maxWeightKg: 600 },
          ],
        },
        products: [
          createProduct({ id: 'front-product', weightKg: 700, lengthMm: 2000, widthMm: 1000, heightMm: 200 }),
          createProduct({ id: 'rear-product', weightKg: 1000, lengthMm: 2000, widthMm: 1000, heightMm: 200 }),
        ],
      }),
    );

    expect(result.axleLoadSnapshots).toEqual([
      expect.objectContaining({ axleGroupCode: 'P2-FRONT', computedWeightKg: 1000, maxWeightKg: 1200, status: 'OK' }),
      expect.objectContaining({ axleGroupCode: 'P2-REAR', computedWeightKg: 700, maxWeightKg: 600, status: 'EXCEEDED' }),
    ]);
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
      message: expect.stringContaining('zona puerta'),
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
        explanation: expect.objectContaining({
          summary: expect.stringContaining('Ganó'),
          strengths: expect.arrayContaining([expect.stringContaining('violaciones críticas')]),
          tradeoffs: expect.any(Array),
        }),
        placedItems: expect.any(Array),
        steps: expect.any(Array),
        alerts: expect.any(Array),
        metrics: expect.any(Object),
        evaluation: expect.any(Object),
      }),
    ]));
  });

  it('selects lateral balance candidate when it mitigates side imbalance warnings', () => {
    const zones: PlannerTruckZoneInput[] = [
      { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 0, endXMm: 3000, startYMm: 0, endYMm: 1000 },
    ];

    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 3000, widthMm: 1000, heightMm: 1000, zones },
        products: [
          createProduct({ id: 'heavy-product', weightKg: 500, lengthMm: 1000, widthMm: 500, heightMm: 300 }),
          createProduct({ id: 'light-product', weightKg: 500, lengthMm: 1000, widthMm: 500, heightMm: 300 }),
        ],
      }),
    );

    expect(result.candidateDiagnostics).toEqual(expect.objectContaining({ winnerName: 'balance-lateral' }));
    expect(result.candidateDiagnostics?.winnerExplanation).toEqual(expect.objectContaining({
      summary: expect.stringContaining('Ganó'),
      strengths: expect.arrayContaining([expect.stringContaining('mejor balance lateral')]),
    }));
    expect(result.metrics.leftWeightKg).toBe(500);
    expect(result.metrics.rightWeightKg).toBe(500);
    expect(result.alerts).not.toContainEqual(expect.objectContaining({
      severity: AlertSeverity.WARNING,
      type: AlertType.WEIGHT_IMBALANCE,
      message: expect.stringContaining('peso lateral'),
    }));
    expect(result.candidateDiagnostics?.candidates.map((candidate) => candidate.name)).toContain('balance-lateral');
  });

  it('prioritizes large footprint sheets before small items fragment contiguous floor space', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: {
          lengthMm: 4000,
          widthMm: 2400,
          heightMm: 1000,
          zones: [{ id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 0, endXMm: 4000, startYMm: 0, endYMm: 2400 }],
        },
        products: [
          createProduct({ id: 'small-profile', quantity: 2, weightKg: 2000, lengthMm: 1000, widthMm: 1000, heightMm: 300, rotationAllowed: false }),
          createProduct({ id: 'large-sheet', weightKg: 1680, lengthMm: 3000, widthMm: 1500, heightMm: 50, rotationAllowed: false }),
        ],
      }),
    );

    const diagnostics = result.candidateDiagnostics;
    const largeFootprintCandidate = diagnostics?.candidates.find((candidate) => candidate.name === 'large-footprint-first');

    expect(result.unplacedItems).not.toContainEqual(expect.objectContaining({ productId: 'large-sheet' }));
    expect(result.placedItems).toContainEqual(expect.objectContaining({ productId: 'large-sheet', xMm: 0, yMm: 0, lengthMm: 3000, widthMm: 1500 }));
    expect(largeFootprintCandidate?.unplacedItemCount).toBe(0);
    expect(largeFootprintCandidate?.placedItems).toContainEqual(expect.objectContaining({ productId: 'large-sheet' }));
    expect(diagnostics?.discardedCandidates).toContainEqual(expect.objectContaining({
      name: 'current',
      unplacedItemCount: 1,
    }));
  });

  it('uses right-side anchors for lateral balance with narrow items on a wide truck', () => {
    const zones: PlannerTruckZoneInput[] = [
      { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 0, endXMm: 3000, startYMm: 0, endYMm: 2000 },
    ];

    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: { lengthMm: 3000, widthMm: 2000, heightMm: 1000, zones },
        products: [createProduct({ id: 'narrow-product', quantity: 2, weightKg: 500, lengthMm: 1000, widthMm: 500, heightMm: 300, rotationAllowed: false })],
      }),
    );

    expect(result.candidateDiagnostics).toEqual(expect.objectContaining({ winnerName: 'balance-lateral' }));
    expect(result.placedItems).toHaveLength(2);
    expect(result.placedItems.some((item) => item.yMm >= 1000)).toBe(true);
    expect(result.placedItems.map((item) => item.yMm).sort((a, b) => a - b)).not.toEqual([0, 500]);
    expect(result.metrics.leftWeightKg).toBe(500);
    expect(result.metrics.rightWeightKg).toBe(500);
    expect(result.alerts).not.toContainEqual(expect.objectContaining({
      severity: AlertSeverity.WARNING,
      type: AlertType.WEIGHT_IMBALANCE,
      message: expect.stringContaining('peso lateral'),
    }));
  });

  it('keeps the current ordering when candidate scores tie', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        products: [
          createProduct({ id: 'heavy-product', weightKg: 500, lengthMm: 1000, widthMm: 2000, heightMm: 300 }),
          createProduct({ id: 'light-product', weightKg: 100, lengthMm: 1000, widthMm: 2000, heightMm: 300 }),
        ],
      }),
    );

    expect(result.evaluation.hardViolationCount).toBe(0);
    expect(result.placedItems.map((item) => item.productId)).toEqual(['heavy-product', 'light-product']);
    expect(result.candidateDiagnostics).toEqual(expect.objectContaining({ winnerIndex: 0, winnerName: 'current' }));
    expect(result.candidateDiagnostics?.candidates.map((candidate) => candidate.index)).toEqual([0, 1, 2, 3]);
    expect(result.candidateDiagnostics?.winnerExplanation.summary).toContain('empate');
    expect(result.candidateDiagnostics?.candidates[0].explanation.summary).toContain('Ganó por desempate');
  });

  it('moves invalid high-critical strategies to discarded diagnostics instead of valid alternatives', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: {
          lengthMm: 6000,
          widthMm: 1000,
          heightMm: 1000,
          zones: [
            { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, startXMm: 0, endXMm: 2000, startYMm: 0, endYMm: 1000 },
            { id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 2000, endXMm: 4000, startYMm: 0, endYMm: 1000 },
            { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, startXMm: 4000, endXMm: 6000, startYMm: 0, endYMm: 1000 },
          ],
        },
        products: [
          createProduct({ id: 'small-heavy', weightKg: 500, lengthMm: 1000, widthMm: 500, heightMm: 200, quantity: 4, stackable: false, rotationAllowed: false }),
          createProduct({ id: 'long-light', weightKg: 100, lengthMm: 4000, widthMm: 100, heightMm: 100, quantity: 1, stackable: false, rotationAllowed: false }),
          createProduct({ id: 'small-light', weightKg: 100, lengthMm: 1000, widthMm: 500, heightMm: 200, quantity: 3, stackable: false, rotationAllowed: false }),
        ],
      }),
    );

    const validCandidates = result.candidateDiagnostics?.candidates ?? [];
    const discardedCandidates = result.candidateDiagnostics?.discardedCandidates ?? [];

    expect(validCandidates.every((candidate) => candidate.hardViolationCount === 0 && candidate.unplacedItemCount === 0)).toBe(true);
    expect(discardedCandidates.map((candidate) => candidate.name)).toContain('current');
    expect(validCandidates.map((candidate) => candidate.name)).toContain('balance-lateral');
    expect(discardedCandidates.some((candidate) => candidate.hardViolationCount > 0 && candidate.placedItemCount >= 4)).toBe(true);
    expect(discardedCandidates.every((candidate) => candidate.reason.length > 0)).toBe(true);
    expect(result.candidateDiagnostics?.candidates.find((candidate) => candidate.name === 'current')).toBeUndefined();
  });

  it('exposes the best partial plan separately when no complete valid alternative exists', () => {
    const result = new HeuristicLoadingPlanner().generate(
      createInput({
        truck: {
          lengthMm: 1000,
          widthMm: 1000,
          heightMm: 1000,
          zones: [{ id: 'zone-center', type: TruckZoneType.CENTER, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 1000 }],
        },
        products: [
          createProduct({ id: 'base-package', weightKg: 500, lengthMm: 1000, widthMm: 1000, heightMm: 500, stackable: false, rotationAllowed: false }),
          createProduct({ id: 'extra-package', weightKg: 100, lengthMm: 500, widthMm: 500, heightMm: 500, stackable: false, rotationAllowed: false }),
        ],
      }),
    );

    const diagnostics = result.candidateDiagnostics;

    expect(diagnostics?.candidates).toEqual([]);
    expect(diagnostics?.bestPartialCandidate).toEqual(expect.objectContaining({
      index: diagnostics?.winnerIndex,
      name: diagnostics?.winnerName,
      hardViolationCount: 1,
      placedItemCount: 1,
      unplacedItemCount: 1,
    }));
    expect(diagnostics?.bestPartialCandidate?.unplacedItems).toHaveLength(1);
    expect(['base-package', 'extra-package']).toContain(diagnostics?.bestPartialCandidate?.unplacedItems[0]?.productId);
    expect(diagnostics?.discardedCandidates?.map((candidate) => candidate.index)).toContain(diagnostics?.winnerIndex);
  });
});
