import { LoadingMethod, ProductFamily, TruckZoneType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { decimalToNumber, operationToPlannerInput } from './operation-to-planner-input';

/**
 * loading-agent-llm Phase 4 — DRY extraction. This is the SAME mapping that
 * used to live as `LoadingPlansService.toPlannerInput` (private); it is now
 * a standalone pure function so `planning-agent.service` (Phase 8) can reuse
 * it without depending on `LoadingPlansService`. Behavior-preserving: see
 * `loading-plans.service.spec.ts` line ~443, which exercises the SAME
 * mapping through the service's thin delegating private method and must
 * stay green unmodified.
 */

function createOperation(
  overrides: {
    truck?: Partial<{
      lengthMm: number | null;
      widthMm: number | null;
      heightMm: number | null;
      maxPayloadKg: unknown;
      zones: Array<{ id: string; type: TruckZoneType; maxWeightKg: unknown; startXMm?: number | null; endXMm?: number | null; startYMm?: number | null; endYMm?: number | null }>;
      tiers: Array<{ id: string; level: number; maxHeightMm?: number | null; maxWeightKg: unknown }>;
    }>;
    products?: unknown[];
  } = {},
) {
  return {
    truck: {
      id: 'truck-1',
      loadingMethod: LoadingMethod.REAR,
      maxPayloadKg: 24_000,
      lengthMm: 9000,
      widthMm: 2000,
      heightMm: 2500,
      zones: [{ id: 'zone-center', type: TruckZoneType.CENTER, maxWeightKg: null, startXMm: 0, endXMm: 9000, startYMm: 0, endYMm: 2000 }],
      tiers: [],
      ...overrides.truck,
    },
    destinations: [{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }],
    products: overrides.products ?? [
      {
        id: 'product-1',
        code: 'P-1',
        family: ProductFamily.GENERIC_PACKAGE,
        description: null,
        destinationId: 'destination-1',
        quantity: 1,
        weightKg: 500,
        lengthMm: 1000,
        widthMm: 500,
        heightMm: 400,
        stackable: true,
        rotationAllowed: true,
        fragile: false,
        maxStackLoadKg: null,
        destination: { id: 'destination-1', name: 'First stop', unloadingOrder: 1 },
      },
    ],
    plans: [],
  } as never;
}

describe('decimalToNumber (loading-agent-llm 4.1)', () => {
  it('converts a Prisma-Decimal-like value to a plain number', () => {
    expect(decimalToNumber(24_000 as never)).toBe(24_000);
  });

  it('returns undefined for null (Prisma nullable numeric column)', () => {
    expect(decimalToNumber(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(decimalToNumber(undefined)).toBeUndefined();
  });
});

describe('operationToPlannerInput (loading-agent-llm 4.1)', () => {
  it('maps truck, destinations, and product fields into the planner input shape', () => {
    const operation = createOperation();

    const input = operationToPlannerInput(operation);

    expect(input.truck).toMatchObject({
      id: 'truck-1',
      loadingMethod: LoadingMethod.REAR,
      maxPayloadKg: 24_000,
      lengthMm: 9000,
      widthMm: 2000,
      heightMm: 2500,
    });
    expect(input.destinations).toEqual([{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }]);
    expect(input.products).toEqual([
      expect.objectContaining({
        id: 'product-1',
        code: 'P-1',
        family: ProductFamily.GENERIC_PACKAGE,
        destinationId: 'destination-1',
        quantity: 1,
        weightKg: 500,
        stackable: true,
        rotationAllowed: true,
        fragile: false,
      }),
    ]);
  });

  it('maps a null truck maxPayloadKg (and product maxStackLoadKg) to undefined, not null (Prisma-decimal→number contract)', () => {
    const operation = createOperation({ truck: { maxPayloadKg: null } });

    const input = operationToPlannerInput(operation);

    expect(input.truck.maxPayloadKg).toBeUndefined();
    expect(input.products[0].maxStackLoadKg).toBeUndefined();
  });

  it('maps zone and tier maxWeightKg the same way the mapping did before extraction (Decimal→number|undefined)', () => {
    const operation = createOperation({
      truck: {
        zones: [{ id: 'zone-center', type: TruckZoneType.CENTER, maxWeightKg: 5000, startXMm: 0, endXMm: 9000, startYMm: 0, endYMm: 2000 }],
        tiers: [{ id: 'tier-1', level: 1, maxHeightMm: 1200, maxWeightKg: null }],
      },
    });

    const input = operationToPlannerInput(operation);

    expect(input.truck.zones[0].maxWeightKg).toBe(5000);
    expect(input.truck.tiers[0]).toMatchObject({ level: 1, maxHeightMm: 1200, maxWeightKg: undefined });
  });
});
