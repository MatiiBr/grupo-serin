import 'reflect-metadata';
import type { ConstraintSet } from '@camiones/shared';
import { LoadingMethod, ProductFamily, TruckZoneType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeuristicLoadingPlanner } from '../domain/loading-planner/heuristic-loading-planner';
import type { AgentPort } from './ports/agent.port';
import { PlanningAgentService } from './planning-agent.service';

/**
 * loading-agent-llm Phase 8 — `PlanningAgentService` orchestrates the full
 * preview flow: fetch operation -> map to planner input -> build catalog
 * context -> `agentPort.planConstraints` -> validation gate (Phase 7) ->
 * `applyConstraints` -> `planner.generate` -> `agentPort.explainPlan` ->
 * return a PREVIEW. `AgentPort` is mocked throughout (`vi.fn()`s) — NEVER a
 * live DeepSeek call. Direct instantiation (mirrors
 * `loading-plans.service.spec.ts`), no Nest DI container.
 *
 * Also covers Phase 7's validation-gate scenarios end-to-end (7.1-7.3):
 * this is the file `tasks.md` names as the home for those RED specs.
 */

function createOperation(
  overrides: {
    truck?: Partial<{ lengthMm: number | null; widthMm: number | null; heightMm: number | null }>;
    products?: unknown[];
  } = {},
) {
  return {
    id: 'operation-1',
    truck: {
      id: 'truck-1',
      loadingMethod: LoadingMethod.REAR,
      maxPayloadKg: 24_000,
      lengthMm: 9000,
      widthMm: 2000,
      heightMm: 2500,
      zones: [
        { id: 'zone-cabin', type: TruckZoneType.CABIN_SIDE, maxWeightKg: null, startXMm: 0, endXMm: 3000, startYMm: 0, endYMm: 2000 },
        { id: 'zone-center', type: TruckZoneType.CENTER, maxWeightKg: null, startXMm: 3000, endXMm: 6000, startYMm: 0, endYMm: 2000 },
        { id: 'zone-door', type: TruckZoneType.DOOR_SIDE, maxWeightKg: null, startXMm: 6000, endXMm: 9000, startYMm: 0, endYMm: 2000 },
      ],
      tiers: [],
      ...overrides.truck,
    },
    destinations: [{ id: 'destination-1', name: 'First stop', unloadingOrder: 1 }],
    products: overrides.products ?? [
      {
        id: 'product-1',
        code: 'P-100',
        family: ProductFamily.COIL,
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
      {
        id: 'product-2',
        code: 'P-200',
        family: ProductFamily.SHEET,
        description: null,
        destinationId: 'destination-1',
        quantity: 1,
        weightKg: 300,
        lengthMm: 800,
        widthMm: 500,
        heightMm: 300,
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

function mockAgentPort(overrides: Partial<AgentPort> = {}): AgentPort {
  return {
    planConstraints: vi.fn().mockResolvedValue({ version: 1, hardRules: [] } satisfies ConstraintSet),
    explainPlan: vi.fn().mockResolvedValue('The plan places every unit within capacity.'),
    ...overrides,
  };
}

function createService(operation: unknown, agentPort: AgentPort) {
  const prisma = { loadOperation: { findUnique: vi.fn().mockResolvedValue(operation) }, loadingPlan: { create: vi.fn(), update: vi.fn() } };
  const service = new PlanningAgentService(prisma as never, agentPort);
  return { service, prisma };
}

describe('PlanningAgentService.plan — orchestration flow (8.2, 8.3)', () => {
  it('returns a preview with plan, explanation, and applied/dropped-rule report for valid rules', async () => {
    const operation = createOperation();
    const agentPort = mockAgentPort({
      planConstraints: vi.fn().mockResolvedValue({
        version: 1,
        hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }],
      } satisfies ConstraintSet),
    });
    const { service } = createService(operation, agentPort);

    const result = await service.plan('operation-1', 'Do not stack P-100.');

    expect(result.plan.placedItems.length + result.plan.unplacedItems.length).toBeGreaterThan(0);
    expect(result.explanation).toBe('The plan places every unit within capacity.');
    expect(result.appliedRules).toEqual([{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }]);
    expect(result.droppedRules).toEqual([]);
    expect(agentPort.planConstraints).toHaveBeenCalledTimes(1);
    expect(agentPort.explainPlan).toHaveBeenCalledTimes(1);
  });

  it('does not create or update any LoadingPlan row — preview semantics (8.3)', async () => {
    const operation = createOperation();
    const agentPort = mockAgentPort();
    const { service, prisma } = createService(operation, agentPort);

    await service.plan('operation-1', 'Any rule.');

    expect(prisma.loadingPlan.create).not.toHaveBeenCalled();
    expect(prisma.loadingPlan.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the operation does not exist', async () => {
    const agentPort = mockAgentPort();
    const { service } = createService(null, agentPort);

    await expect(service.plan('missing-op', 'Any rule.')).rejects.toBeInstanceOf(NotFoundException);
    expect(agentPort.planConstraints).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the operation has no products', async () => {
    const operation = createOperation({ products: [] });
    const agentPort = mockAgentPort();
    const { service } = createService(operation, agentPort);

    await expect(service.plan('operation-1', 'Any rule.')).rejects.toBeInstanceOf(BadRequestException);
    expect(agentPort.planConstraints).not.toHaveBeenCalled();
  });
});

describe('PlanningAgentService.plan — validation gate integration (7.1, 7.2, 7.3)', () => {
  let generateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    generateSpy = vi.spyOn(HeuristicLoadingPlanner.prototype, 'generate');
  });

  afterEach(() => {
    generateSpy.mockRestore();
  });

  it('7.1 — a structurally malformed ConstraintSet is rejected; the solver is never invoked', async () => {
    const operation = createOperation();
    const agentPort = mockAgentPort({
      // Missing required "hardRules" — structurally invalid.
      planConstraints: vi.fn().mockResolvedValue({ version: 1 } as unknown as ConstraintSet),
    });
    const { service } = createService(operation, agentPort);

    await expect(service.plan('operation-1', 'Any rule.')).rejects.toBeInstanceOf(BadRequestException);
    expect(generateSpy).not.toHaveBeenCalled();
    expect(agentPort.explainPlan).not.toHaveBeenCalled();
  });

  it('7.2 — a rule citing an unknown product code is dropped with a named warning; other rules still apply', async () => {
    const operation = createOperation();
    const agentPort = mockAgentPort({
      planConstraints: vi.fn().mockResolvedValue({
        version: 1,
        hardRules: [
          { type: 'STACKING_PROHIBITION', productCode: 'P-100' },
          { type: 'STACKING_PROHIBITION', productCode: 'P-999-GHOST' },
        ],
      } satisfies ConstraintSet),
    });
    const { service } = createService(operation, agentPort);

    const result = await service.plan('operation-1', 'Do not stack P-100 or P-999-GHOST.');

    expect(result.appliedRules).toEqual([{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }]);
    expect(result.droppedRules).toHaveLength(1);
    expect(result.droppedRules[0].rule).toEqual({ type: 'STACKING_PROHIBITION', productCode: 'P-999-GHOST' });
    expect(result.droppedRules[0].reason).toContain('P-999-GHOST');
    expect(generateSpy).toHaveBeenCalledTimes(1);
  });

  it('7.3 — a fully-hallucinated ConstraintSet applies zero rules; the solver runs on the unmodified input', async () => {
    const operation = createOperation();
    const hallucinatedAgentPort = mockAgentPort({
      planConstraints: vi.fn().mockResolvedValue({
        version: 1,
        hardRules: [
          { type: 'STACKING_PROHIBITION', productCode: 'GHOST-1' },
          { type: 'FRAGILE_ON_TOP', productCode: 'GHOST-2' },
        ],
      } satisfies ConstraintSet),
    });
    const { service: hallucinatedService } = createService(operation, hallucinatedAgentPort);

    const cleanAgentPort = mockAgentPort();
    const { service: cleanService } = createService(operation, cleanAgentPort);

    const hallucinatedResult = await hallucinatedService.plan('operation-1', 'Do not stack GHOST-1.');
    const baselineResult = await cleanService.plan('operation-1', 'No rules.');

    expect(hallucinatedResult.appliedRules).toEqual([]);
    expect(hallucinatedResult.droppedRules).toHaveLength(2);
    // Solver ran on the UNMODIFIED input — same result as a truly empty ConstraintSet.
    expect(hallucinatedResult.plan).toEqual(baselineResult.plan);
  });
});
