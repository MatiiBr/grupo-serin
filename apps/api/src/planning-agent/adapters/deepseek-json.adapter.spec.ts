import 'reflect-metadata';
import { TruckZoneType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';
import type { CatalogContext } from '../ports/agent.port';
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
});
