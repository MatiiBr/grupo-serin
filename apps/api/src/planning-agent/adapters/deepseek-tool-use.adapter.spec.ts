import { TruckZoneType as SharedTruckZoneType, type ConstraintSet } from '@camiones/shared';
import { describe, expect, it, vi } from 'vitest';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';
import type { CatalogContext, PlanProblems } from '../ports/agent.port';
import { DeepSeekNoToolCallError } from './deepseek.client';
import { DeepSeekToolUseAdapter, DeepSeekToolUseUnsupportedError, SET_CONSTRAINTS_TOOL } from './deepseek-tool-use.adapter';

/**
 * loading-agent-llm — REAL `DeepSeekToolUseAdapter` (OpenAI-compatible
 * native tool-use). Opt-in via `DEEPSEEK_ADAPTER=tooluse` (see
 * `planning-agent.module.ts`); `DeepSeekJsonAdapter` stays the DEFAULT
 * `AgentPort` because Huawei Cloud's DeepSeek tool/function-calling support
 * is UNVERIFIED against the real endpoint. Tested ONLY against a mocked
 * `DeepSeekClient` (`chatCompletion`/`chatCompletionWithTools` stubbed) —
 * NEVER a live DeepSeek call.
 */

const catalogContext: CatalogContext = {
  productCodes: ['P-100', 'P-200'],
  families: ['COIL'],
  zones: ['CABIN_SIDE', 'CENTER', 'DOOR_SIDE'],
  destinations: ['dest-1'],
};

function mockClient(overrides: { chatCompletionWithTools?: unknown; chatCompletion?: unknown } = {}) {
  return {
    chatCompletion: vi.fn().mockResolvedValue(overrides.chatCompletion ?? 'ok'),
    chatCompletionWithTools: vi.fn().mockResolvedValue(overrides.chatCompletionWithTools ?? '{"version":1,"hardRules":[]}'),
  };
}

describe('SET_CONSTRAINTS_TOOL (tool schema)', () => {
  it('is an OpenAI-compatible function tool named "set_constraints" describing the ConstraintSet schema', () => {
    expect(SET_CONSTRAINTS_TOOL.type).toBe('function');
    expect(SET_CONSTRAINTS_TOOL.function.name).toBe('set_constraints');

    const params = SET_CONSTRAINTS_TOOL.function.parameters as { required: string[]; properties: Record<string, unknown> };
    expect(params.required).toEqual(expect.arrayContaining(['version', 'hardRules']));
    expect(params.properties).toHaveProperty('version');
    expect(params.properties).toHaveProperty('hardRules');
  });

  it('describes all 6 hard-rule shapes with exact field names, including the STACKING/FRAGILE/ZONE_RESTRICTION/TIER/FAMILY_BAN/PRODUCT_ZONE_BAN discriminators', () => {
    const serialized = JSON.stringify(SET_CONSTRAINTS_TOOL);

    expect(serialized).toContain('STACKING_PROHIBITION');
    expect(serialized).toContain('FRAGILE_ON_TOP');
    expect(serialized).toContain('ZONE_RESTRICTION');
    expect(serialized).toContain('TIER_RESTRICTION');
    expect(serialized).toContain('FAMILY_PLACEMENT_BAN');
    expect(serialized).toContain('PRODUCT_ZONE_BAN');
    expect(serialized).toContain('maxTier');
    expect(serialized).toContain('productCode');
    expect(serialized).toContain('zone');
  });
});

describe('DeepSeekToolUseAdapter.planConstraints (real, tool-use)', () => {
  it('calls chatCompletionWithTools with the set_constraints tool forced via tool_choice, and returns the validated ConstraintSet', async () => {
    const golden = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }] };
    const client = mockClient({ chatCompletionWithTools: JSON.stringify(golden) });
    const adapter = new DeepSeekToolUseAdapter(client);

    const result = await adapter.planConstraints({ rulesText: 'Do not stack P-100.', catalogContext });

    expect(result).toEqual(golden);
    expect(client.chatCompletionWithTools).toHaveBeenCalledTimes(1);

    const [params] = client.chatCompletionWithTools.mock.calls[0];
    expect(params.tools).toEqual([SET_CONSTRAINTS_TOOL]);
    expect(params.toolChoice).toEqual({ type: 'function', function: { name: 'set_constraints' } });
  });

  it('injects the catalog context (real product codes) into the system prompt', async () => {
    const client = mockClient();
    const adapter = new DeepSeekToolUseAdapter(client);

    await adapter.planConstraints({ rulesText: 'Any rule.', catalogContext });

    const [params] = client.chatCompletionWithTools.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage.content).toContain('P-100');
    expect(systemMessage.content).toContain('P-200');

    const userMessage = params.messages.find((message: { role: string }) => message.role === 'user');
    expect(userMessage.content).toBe('Any rule.');
  });

  it('rejects with ConstraintSetParseError when the tool call arguments are not valid JSON', async () => {
    const client = mockClient({ chatCompletionWithTools: 'not json {' });
    const adapter = new DeepSeekToolUseAdapter(client);

    const error = await adapter.planConstraints({ rulesText: 'r', catalogContext }).catch((e: unknown) => e);
    expect((error as Error).name).toBe('ConstraintSetParseError');
  });

  it('rejects with ConstraintSetValidationError when the tool call arguments fail the ConstraintSet schema', async () => {
    const malformed = { version: 1, hardRules: [{ type: 'ZONE_RESTRICTION', productCode: 'P-200' }] }; // missing required "zone"
    const client = mockClient({ chatCompletionWithTools: JSON.stringify(malformed) });
    const adapter = new DeepSeekToolUseAdapter(client);

    const error = await adapter.planConstraints({ rulesText: 'r', catalogContext }).catch((e: unknown) => e);
    expect((error as Error).name).toBe('ConstraintSetValidationError');
  });

  it('wraps DeepSeekNoToolCallError from the client into a typed DeepSeekToolUseUnsupportedError (endpoint does not support tools)', async () => {
    const client = mockClient();
    client.chatCompletionWithTools.mockRejectedValue(new DeepSeekNoToolCallError());
    const adapter = new DeepSeekToolUseAdapter(client);

    await expect(adapter.planConstraints({ rulesText: 'r', catalogContext })).rejects.toBeInstanceOf(DeepSeekToolUseUnsupportedError);
  });
});

describe('DeepSeekToolUseAdapter.reviseConstraints (self-correcting-replan-loop, real tool-use)', () => {
  const previousConstraints = {
    version: 1 as const,
    hardRules: [{ type: 'PRODUCT_ZONE_BAN' as const, productCode: 'P-100', zone: 'CENTER' as never }],
  };
  const problems = {
    unplaced: [{ productCode: 'P-100', reason: 'No floor space available in the target zone or fallback zones.' }],
    criticalAlerts: [{ type: 'UNPLACED_ITEM', message: 'Product P-100 unit 1 was not placed.' }],
  };

  it('resolves a well-formed tool-call response into a valid (adjusted) ConstraintSet', async () => {
    const golden = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }] };
    const client = mockClient({ chatCompletionWithTools: JSON.stringify(golden) });
    const adapter = new DeepSeekToolUseAdapter(client);

    const result = await adapter.reviseConstraints({ rulesText: 'Do not stack P-100.', previousConstraints, problems, catalogContext });

    expect(result).toEqual(golden);
    expect(client.chatCompletionWithTools).toHaveBeenCalledTimes(1);
  });

  it('sends the operator rulesText, the previous ConstraintSet, and the problems summary to the model, forcing the set_constraints tool', async () => {
    const client = mockClient();
    const adapter = new DeepSeekToolUseAdapter(client);

    await adapter.reviseConstraints({ rulesText: 'Do not stack P-100.', previousConstraints, problems, catalogContext });

    const [params] = client.chatCompletionWithTools.mock.calls[0];
    const userMessage = params.messages.find((message: { role: string }) => message.role === 'user');
    const payload = JSON.parse(userMessage.content);

    expect(payload.operatorRules).toBe('Do not stack P-100.');
    expect(payload.previousConstraints).toEqual(previousConstraints);
    expect(payload.problems).toEqual(problems);

    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage.content).toContain('REVISING');
    expect(params.toolChoice).toEqual({ type: 'function', function: { name: 'set_constraints' } });
  });

  it('rejects with ConstraintSetParseError when the tool call arguments are not valid JSON', async () => {
    const client = mockClient({ chatCompletionWithTools: 'not json {' });
    const adapter = new DeepSeekToolUseAdapter(client);

    const error = await adapter.reviseConstraints({ rulesText: 'r', previousConstraints, problems, catalogContext }).catch((e: unknown) => e);
    expect((error as Error).name).toBe('ConstraintSetParseError');
  });

  it('rejects with ConstraintSetValidationError when the tool call arguments fail the ConstraintSet schema', async () => {
    const malformed = { version: 1, hardRules: [{ type: 'ZONE_RESTRICTION', productCode: 'P-200' }] };
    const client = mockClient({ chatCompletionWithTools: JSON.stringify(malformed) });
    const adapter = new DeepSeekToolUseAdapter(client);

    const error = await adapter.reviseConstraints({ rulesText: 'r', previousConstraints, problems, catalogContext }).catch((e: unknown) => e);
    expect((error as Error).name).toBe('ConstraintSetValidationError');
  });
});

describe('DeepSeekToolUseAdapter.explainPlan (no tool needed — plain chatCompletion)', () => {
  const plan: LoadingPlannerResult = {
    placedItems: [],
    unplacedItems: [],
    steps: [],
    alerts: [],
    metrics: {
      totalWeightKg: 0,
      placedWeightKg: 0,
      unplacedWeightKg: 0,
      usedVolumeM3: 0,
      volumeUtilizationPct: 0,
      placedItemCount: 0,
      unplacedItemCount: 0,
      leftWeightKg: 0,
      rightWeightKg: 0,
      cabinSideWeightKg: 0,
      centerWeightKg: 0,
      doorSideWeightKg: 0,
      criticalAlertCount: 0,
      warningAlertCount: 0,
      loadLengthMm: 0,
      maxHeightMm: 0,
    },
  };
  const constraints = { version: 1 as const, hardRules: [{ type: 'ZONE_RESTRICTION' as const, productCode: 'P-100', zone: SharedTruckZoneType.CENTER }] };

  it('returns the plain chatCompletion response and never calls chatCompletionWithTools', async () => {
    const client = mockClient({ chatCompletion: 'El plan ubica P-100 en CENTER.' });
    const adapter = new DeepSeekToolUseAdapter(client);

    const explanation = await adapter.explainPlan({ plan, constraints });

    expect(explanation).toBe('El plan ubica P-100 en CENTER.');
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
    expect(client.chatCompletionWithTools).not.toHaveBeenCalled();
  });

  it('instructs the model to explain in Spanish (same system prompt as DeepSeekJsonAdapter)', async () => {
    const client = mockClient({ chatCompletion: 'Poné el pallet en el piso.' });
    const adapter = new DeepSeekToolUseAdapter(client);

    await adapter.explainPlan({ plan, constraints });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage?.content.toLowerCase()).toContain('espanol');
  });
});

describe('DeepSeekToolUseAdapter.diagnoseUnresolvedPlan (DIAGNOSIS agent, no tool needed — plain chatCompletion)', () => {
  const constraints: ConstraintSet = {
    version: 1,
    hardRules: [{ type: 'PRODUCT_ZONE_BAN', productCode: 'P-100', zone: SharedTruckZoneType.DOOR_SIDE }],
  };
  const problems: PlanProblems = {
    unplaced: [{ productCode: 'P-100', reason: 'No floor space available in the target zone or fallback zones.' }],
    criticalAlerts: [{ type: 'UNPLACED_ITEM', message: 'Product P-100 unit 1 was not placed.' }],
  };
  const diagnosisPlan = {
    placedItems: [],
    unplacedItems: [{ productId: 'P-100', unitIndex: 1, message: 'No floor space available.' }],
    steps: [],
    alerts: [{ type: 'UNPLACED_ITEM', severity: 'CRITICAL', message: 'Product P-100 unit 1 was not placed.' }],
    metrics: { volumeUtilizationPct: 95, unplacedItemCount: 1 },
  } as unknown as LoadingPlannerResult;

  it('returns the plain chatCompletion response and never calls chatCompletionWithTools', async () => {
    const client = mockClient({ chatCompletion: 'El camion esta lleno del lado que se permite; probá con un camion mas grande.' });
    const adapter = new DeepSeekToolUseAdapter(client);

    const diagnosis = await adapter.diagnoseUnresolvedPlan({
      rulesText: 'Perfiles no pueden ir del lado de la puerta.',
      constraints,
      plan: diagnosisPlan,
      problems,
      catalogContext,
    });

    expect(diagnosis).toBe('El camion esta lleno del lado que se permite; probá con un camion mas grande.');
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
    expect(client.chatCompletionWithTools).not.toHaveBeenCalled();
  });

  it('sends the same Spanish logistics-diagnostician system prompt as DeepSeekJsonAdapter', async () => {
    const client = mockClient({ chatCompletion: 'diagnostico' });
    const adapter = new DeepSeekToolUseAdapter(client);

    await adapter.diagnoseUnresolvedPlan({ rulesText: 'r', constraints, plan: diagnosisPlan, problems, catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    const content: string = systemMessage.content;

    expect(content.toLowerCase()).toContain('espanol');
    expect(content.toLowerCase()).toMatch(/diagnostic/);
    expect(content.toLowerCase()).toMatch(/sugerencia/);
  });

  it('includes the operator rules, applied constraints, and problems in the user message', async () => {
    const client = mockClient({ chatCompletion: 'diagnostico' });
    const adapter = new DeepSeekToolUseAdapter(client);

    await adapter.diagnoseUnresolvedPlan({
      rulesText: 'Perfiles no pueden ir del lado de la puerta.',
      constraints,
      plan: diagnosisPlan,
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
