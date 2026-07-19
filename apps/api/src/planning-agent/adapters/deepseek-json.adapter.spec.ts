import 'reflect-metadata';
import type { ConstraintSet } from '@camiones/shared';
import { TruckZoneType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';
import type { CatalogContext, PlanProblems } from '../ports/agent.port';
import { ConstraintSetParseError, ConstraintSetValidationError, DeepSeekJsonAdapter } from './deepseek-json.adapter';

/**
 * loading-agent-llm Phase 6.2/6.3 — `DeepSeekJsonAdapter`, the DEFAULT
 * `AgentPort` implementation. Tested ONLY against a mocked `DeepSeekClient`
 * (`chatCompletion` stubbed) — NEVER a live DeepSeek call. Covers: golden
 * JSON parses into a valid `ConstraintSet`; malformed JSON and
 * schema-invalid JSON both reject with a typed error, not a raw crash.
 */

function mockClient(resolvedContent: string) {
  return { chatCompletion: vi.fn().mockResolvedValue(resolvedContent) };
}

const catalogContext: CatalogContext = {
  productCodes: ['P-100', 'P-200'],
  families: ['COIL', 'SHEET'],
  zones: ['CABIN_SIDE', 'CENTER', 'DOOR_SIDE'],
  destinations: ['dest-1'],
};

describe('DeepSeekJsonAdapter.planConstraints — golden path', () => {
  it('resolves a well-formed JSON response into a valid ConstraintSet', async () => {
    const golden = {
      version: 1,
      hardRules: [
        { type: 'STACKING_PROHIBITION', productCode: 'P-100' },
        { type: 'ZONE_RESTRICTION', productCode: 'P-200', zone: 'DOOR_SIDE' },
      ],
      notes: 'From rulesText',
    };
    const client = mockClient(JSON.stringify(golden));
    const adapter = new DeepSeekJsonAdapter(client);

    const result = await adapter.planConstraints({ rulesText: 'Do not stack P-100.', catalogContext });

    expect(result).toEqual(golden);
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it('injects the catalog context (real product codes) into the system prompt sent to the client', async () => {
    const client = mockClient(JSON.stringify({ version: 1, hardRules: [] }));
    const adapter = new DeepSeekJsonAdapter(client);

    await adapter.planConstraints({ rulesText: 'Any rule.', catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage.content).toContain('P-100');
    expect(systemMessage.content).toContain('P-200');

    const userMessage = params.messages.find((message: { role: string }) => message.role === 'user');
    expect(userMessage.content).toBe('Any rule.');
  });

  it('spells out the exact ConstraintSetDto field names per rule type in the system prompt (regression: DeepSeek once emitted "restrictedZone" instead of "zone")', async () => {
    const client = mockClient(JSON.stringify({ version: 1, hardRules: [] }));
    const adapter = new DeepSeekJsonAdapter(client);

    await adapter.planConstraints({ rulesText: 'Any rule.', catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    const content: string = systemMessage.content;

    // Every rule type's exact field set must be spelled out — no room for
    // a plausible-but-wrong field name like "restrictedZone".
    expect(content).toContain('STACKING_PROHIBITION{type,productCode}');
    expect(content).toContain('FRAGILE_ON_TOP{type,productCode}');
    expect(content).toContain('ZONE_RESTRICTION{type,productCode,zone}');
    expect(content).toContain('TIER_RESTRICTION{type,productCode,maxTier}');
    expect(content).toContain('FAMILY_PLACEMENT_BAN{type,family,zone}');

    // The literal field name "zone" must be present, and "restrictedZone" must NOT.
    expect(content).not.toContain('restrictedZone');

    // One concrete JSON example is included, and it uses the real "zone" field name.
    expect(content).toMatch(/"hardRules"\s*:\s*\[/);
    expect(content).toContain('"zone"');
  });

  it('documents PRODUCT_ZONE_BAN as the ban-FROM-a-zone rule, distinct from ZONE_RESTRICTION\'s confine-TO-a-zone semantics (regression: a live call for "los perfiles NO pueden ir en la cabina" produced ZONE_RESTRICTION zone=CABIN_SIDE — the opposite of what was asked)', async () => {
    const client = mockClient(JSON.stringify({ version: 1, hardRules: [] }));
    const adapter = new DeepSeekJsonAdapter(client);

    await adapter.planConstraints({ rulesText: 'Any rule.', catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    const content: string = systemMessage.content;

    // The exact field shape is spelled out alongside the other five rule types.
    expect(content).toContain('PRODUCT_ZONE_BAN{type,productCode,zone}');

    // The disambiguation must be explicit: which rule to pick for "cannot/must
    // not go in zone Z" (ban) vs "must go in/only in zone Z" (confine).
    expect(content).toMatch(/cannot|must not/i);
    expect(content).toMatch(/PRODUCT_ZONE_BAN/);
    expect(content).toMatch(/must go in|only in/i);
    expect(content).toMatch(/ZONE_RESTRICTION/);

    // A PRODUCT_ZONE_BAN example is present in the JSON example block.
    expect(content).toContain('"PRODUCT_ZONE_BAN"');
  });
});

describe('DeepSeekJsonAdapter.planConstraints — invalid responses (typed errors, no crash)', () => {
  it('rejects with ConstraintSetParseError when the response is not valid JSON', async () => {
    const client = mockClient('this is not json at all {');
    const adapter = new DeepSeekJsonAdapter(client);

    await expect(adapter.planConstraints({ rulesText: 'r', catalogContext })).rejects.toBeInstanceOf(ConstraintSetParseError);
  });

  it('rejects with ConstraintSetValidationError when the JSON is well-formed but fails the ConstraintSet schema', async () => {
    const malformed = { version: 1, hardRules: [{ type: 'ZONE_RESTRICTION', productCode: 'P-200' }] }; // missing required "zone"
    const client = mockClient(JSON.stringify(malformed));
    const adapter = new DeepSeekJsonAdapter(client);

    await expect(adapter.planConstraints({ rulesText: 'r', catalogContext })).rejects.toBeInstanceOf(ConstraintSetValidationError);
  });

  it('rejects with ConstraintSetValidationError when a rule has an unknown "type" discriminator', async () => {
    const malformed = { version: 1, hardRules: [{ type: 'WEIGHT_LIMIT_EXCEEDED', productCode: 'P-1' }] };
    const client = mockClient(JSON.stringify(malformed));
    const adapter = new DeepSeekJsonAdapter(client);

    await expect(adapter.planConstraints({ rulesText: 'r', catalogContext })).rejects.toBeInstanceOf(ConstraintSetValidationError);
  });
});

describe('DeepSeekJsonAdapter.reviseConstraints (self-correcting-replan-loop)', () => {
  const previousConstraints = {
    version: 1 as const,
    hardRules: [{ type: 'PRODUCT_ZONE_BAN' as const, productCode: 'P-100', zone: 'CENTER' as never }],
  };
  const problems = {
    unplaced: [{ productCode: 'P-100', reason: 'No floor space available in the target zone or fallback zones.' }],
    criticalAlerts: [{ type: 'UNPLACED_ITEM', message: 'Product P-100 unit 1 was not placed.' }],
  };

  it('resolves a well-formed JSON response into a valid (adjusted) ConstraintSet', async () => {
    const golden = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }] };
    const client = mockClient(JSON.stringify(golden));
    const adapter = new DeepSeekJsonAdapter(client);

    const result = await adapter.reviseConstraints({ rulesText: 'Do not stack P-100.', previousConstraints, problems, catalogContext });

    expect(result).toEqual(golden);
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it('sends the operator rulesText, the previous ConstraintSet, and the problems summary to the model', async () => {
    const client = mockClient(JSON.stringify({ version: 1, hardRules: [] }));
    const adapter = new DeepSeekJsonAdapter(client);

    await adapter.reviseConstraints({ rulesText: 'Do not stack P-100.', previousConstraints, problems, catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const userMessage = params.messages.find((message: { role: string }) => message.role === 'user');
    const payload = JSON.parse(userMessage.content);

    expect(payload.operatorRules).toBe('Do not stack P-100.');
    expect(payload.previousConstraints).toEqual(previousConstraints);
    expect(payload.problems).toEqual(problems);

    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage.content).toContain('REVISING');
    expect(systemMessage.content).toContain('P-100');
  });

  it('rejects with ConstraintSetParseError when the response is not valid JSON', async () => {
    const client = mockClient('this is not json {');
    const adapter = new DeepSeekJsonAdapter(client);

    await expect(adapter.reviseConstraints({ rulesText: 'r', previousConstraints, problems, catalogContext })).rejects.toBeInstanceOf(
      ConstraintSetParseError,
    );
  });

  it('rejects with ConstraintSetValidationError when the JSON is well-formed but fails the ConstraintSet schema', async () => {
    const malformed = { version: 1, hardRules: [{ type: 'ZONE_RESTRICTION', productCode: 'P-200' }] }; // missing required "zone"
    const client = mockClient(JSON.stringify(malformed));
    const adapter = new DeepSeekJsonAdapter(client);

    await expect(adapter.reviseConstraints({ rulesText: 'r', previousConstraints, problems, catalogContext })).rejects.toBeInstanceOf(
      ConstraintSetValidationError,
    );
  });
});

describe('DeepSeekJsonAdapter.explainPlan', () => {
  it('returns the client response content as the explanation', async () => {
    const client = mockClient('The plan places P-100 in CENTER and confines P-200 to DOOR_SIDE.');
    const adapter = new DeepSeekJsonAdapter(client);
    const plan: LoadingPlannerResult = {
      placedItems: [
        {
          productId: 'P-100',
          unitIndex: 1,
          zoneType: TruckZoneType.CENTER,
          xMm: 0,
          yMm: 0,
          zMm: 0,
          tier: 1,
          rotationDeg: 0,
          lengthMm: 1000,
          widthMm: 500,
          heightMm: 400,
          weightKg: 500,
          sequence: 1,
        },
      ],
      unplacedItems: [],
      steps: [],
      alerts: [],
      metrics: {
        totalWeightKg: 500,
        placedWeightKg: 500,
        unplacedWeightKg: 0,
        usedVolumeM3: 0.2,
        volumeUtilizationPct: 10,
        placedItemCount: 1,
        unplacedItemCount: 0,
        leftWeightKg: 0,
        rightWeightKg: 500,
        cabinSideWeightKg: 0,
        centerWeightKg: 500,
        doorSideWeightKg: 0,
        criticalAlertCount: 0,
        warningAlertCount: 0,
        loadLengthMm: 1000,
        maxHeightMm: 400,
      },
    };
    const constraints = { version: 1 as const, hardRules: [{ type: 'STACKING_PROHIBITION' as const, productCode: 'P-100' }] };

    const explanation = await adapter.explainPlan({ plan, constraints });

    expect(explanation).toBe('The plan places P-100 in CENTER and confines P-200 to DOOR_SIDE.');
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it('instructs the model to explain the plan in Spanish for the operator (regression: was hardcoded English)', async () => {
    const client = mockClient('Poné el pallet en el piso.');
    const adapter = new DeepSeekJsonAdapter(client);
    const plan = { placedItems: [], unplacedItems: [], steps: [], alerts: [], metrics: {} } as unknown as LoadingPlannerResult;
    const constraints = { version: 1 as const, hardRules: [] };

    await adapter.explainPlan({ plan, constraints });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage?.content.toLowerCase()).toContain('espanol');
  });
});

describe('DeepSeekJsonAdapter.diagnoseUnresolvedPlan (DIAGNOSIS agent)', () => {
  const constraints: ConstraintSet = {
    version: 1,
    hardRules: [{ type: 'PRODUCT_ZONE_BAN', productCode: 'P-100', zone: 'DOOR_SIDE' as never }],
  };
  const problems: PlanProblems = {
    unplaced: [{ productCode: 'P-100', reason: 'No floor space available in the target zone or fallback zones.' }],
    criticalAlerts: [{ type: 'UNPLACED_ITEM', message: 'Product P-100 unit 1 was not placed.' }],
  };
  const plan = {
    placedItems: [],
    unplacedItems: [{ productId: 'P-100', unitIndex: 1, message: 'No floor space available.' }],
    steps: [],
    alerts: [{ type: 'UNPLACED_ITEM', severity: 'CRITICAL', message: 'Product P-100 unit 1 was not placed.' }],
    metrics: { volumeUtilizationPct: 95, unplacedItemCount: 1 },
  } as unknown as LoadingPlannerResult;

  it('returns the model text response as the diagnosis, using plain chatCompletion (no tool call)', async () => {
    const client = mockClient('El camion esta lleno del lado que se permite; probá con un camion mas grande.');
    const adapter = new DeepSeekJsonAdapter(client);

    const diagnosis = await adapter.diagnoseUnresolvedPlan({
      rulesText: 'Perfiles no pueden ir del lado de la puerta.',
      constraints,
      plan,
      problems,
      catalogContext,
    });

    expect(diagnosis).toBe('El camion esta lleno del lado que se permite; probá con un camion mas grande.');
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it('sends a Spanish logistics-diagnostician system prompt (concise, actionable diagnosis)', async () => {
    const client = mockClient('diagnostico');
    const adapter = new DeepSeekJsonAdapter(client);

    await adapter.diagnoseUnresolvedPlan({ rulesText: 'r', constraints, plan, problems, catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    const content: string = systemMessage.content;

    expect(content.toLowerCase()).toContain('espanol');
    expect(content.toLowerCase()).toMatch(/diagnostic/);
    // Frames the task: which items failed, likely cause, one suggestion.
    expect(content.toLowerCase()).toMatch(/no se pudieron ubicar/);
    expect(content.toLowerCase()).toMatch(/lleno/);
    expect(content.toLowerCase()).toMatch(/sugerencia/);
  });

  it('injects the catalog context into the system prompt (same helper as the other prompts)', async () => {
    const client = mockClient('diagnostico');
    const adapter = new DeepSeekJsonAdapter(client);

    await adapter.diagnoseUnresolvedPlan({ rulesText: 'r', constraints, plan, problems, catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage.content).toContain('P-100');
    expect(systemMessage.content).toContain('P-200');
  });

  it('includes the operator rules, applied constraints, and problems (unplaced + critical alerts) in the user message', async () => {
    const client = mockClient('diagnostico');
    const adapter = new DeepSeekJsonAdapter(client);

    await adapter.diagnoseUnresolvedPlan({
      rulesText: 'Perfiles no pueden ir del lado de la puerta.',
      constraints,
      plan,
      problems,
      catalogContext,
    });

    const [params] = client.chatCompletion.mock.calls[0];
    const userMessage = params.messages.find((message: { role: string }) => message.role === 'user');
    const payload = JSON.parse(userMessage.content);

    expect(payload.operatorRules).toBe('Perfiles no pueden ir del lado de la puerta.');
    expect(payload.appliedRules).toEqual(constraints.hardRules);
    expect(payload.problems).toEqual(problems);
  });
});
