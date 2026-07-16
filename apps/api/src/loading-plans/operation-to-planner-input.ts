import { Prisma } from '@prisma/client';
import { LoadingPlannerInput } from '../domain/loading-planner/loading-planner.types';

/**
 * loading-agent-llm Phase 4 — extracted from `LoadingPlansService`'s
 * formerly-private `toPlannerInput`/`decimalToNumber` (DRY: Phase 8's
 * `planning-agent.service` needs the exact same Prisma→domain mapping to
 * build its preview, without depending on `LoadingPlansService`).
 * `LoadingPlansService.toPlannerInput` now delegates here unchanged.
 */

export type Decimalish = Prisma.Decimal | number | string | null | undefined;

export function decimalToNumber(value: Decimalish): number | undefined {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

export type OperationForPlannerInput = Prisma.LoadOperationGetPayload<{
  include: {
    truck: { include: { zones: true; tiers: true } };
    destinations: true;
    products: { include: { destination: true } };
    plans: { select: { version: true } };
  };
}>;

export function operationToPlannerInput(operation: OperationForPlannerInput): LoadingPlannerInput {
  return {
    truck: {
      id: operation.truck!.id,
      loadingMethod: operation.truck!.loadingMethod,
      maxPayloadKg: decimalToNumber(operation.truck!.maxPayloadKg),
      lengthMm: operation.truck!.lengthMm ?? undefined,
      widthMm: operation.truck!.widthMm ?? undefined,
      heightMm: operation.truck!.heightMm ?? undefined,
      zones: operation.truck!.zones.map((zone) => ({
        id: zone.id,
        type: zone.type,
        maxWeightKg: decimalToNumber(zone.maxWeightKg),
        startXMm: zone.startXMm ?? undefined,
        endXMm: zone.endXMm ?? undefined,
        startYMm: zone.startYMm ?? undefined,
        endYMm: zone.endYMm ?? undefined,
      })),
      tiers: operation.truck!.tiers.map((tier) => ({
        id: tier.id,
        level: tier.level,
        maxHeightMm: tier.maxHeightMm ?? undefined,
        maxWeightKg: decimalToNumber(tier.maxWeightKg),
      })),
    },
    destinations: operation.destinations.map((destination) => ({
      id: destination.id,
      name: destination.name,
      unloadingOrder: destination.unloadingOrder,
    })),
    products: operation.products.map((product) => ({
      id: product.id,
      code: product.code,
      family: product.family,
      description: product.description ?? undefined,
      destinationId: product.destinationId ?? undefined,
      quantity: product.quantity,
      weightKg: decimalToNumber(product.weightKg),
      lengthMm: product.lengthMm ?? undefined,
      widthMm: product.widthMm ?? undefined,
      heightMm: product.heightMm ?? undefined,
      stackable: product.stackable,
      rotationAllowed: product.rotationAllowed,
      fragile: product.fragile,
      maxStackLoadKg: decimalToNumber(product.maxStackLoadKg),
    })),
  };
}
