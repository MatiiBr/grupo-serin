import 'reflect-metadata';
import type { ConstraintSet } from '@camiones/shared';
import { describe, expect, it, vi } from 'vitest';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';
import type { CatalogContext, PlanProblems } from '../ports/agent.port';
import { DiagnosisAgent } from './diagnosis.agent';

/**
 * multi-agent refactor — `DiagnosisAgent`, the second TEXT role-agent. Called
 * only when the self-correcting re-plan loop's BEST attempt is still not
 * clean. Reuses the exact Spanish diagnostician prompt
 * (`DIAGNOSE_UNRESOLVED_PLAN_SYSTEM_PROMPT`) from the pre-refactor adapters,
 * but sends its OWN model/temperature
 * (`DEEPSEEK_MODEL_DIAGNOSE`/`DEEPSEEK_TEMPERATURE_DIAGNOSE`).
 */

const catalogContext: CatalogContext = {
  productCodes: ['P-100', 'P-200'],
  families: ['COIL'],
  zones: ['CABIN_SIDE', 'CENTER', 'DOOR_SIDE'],
  destinations: ['dest-1'],
};
const constraints: ConstraintSet = {
  version: 1,
  hardRules: [{ type: 'PRODUCT_ZONE_BAN', productCode: 'P-100', zone: 'DOOR_SIDE' as never }],
};
const problems: PlanProblems = {
  unplaced: [{ productCode: 'P-100', reason: 'No floor space available.' }],
  criticalAlerts: [{ type: 'UNPLACED_ITEM', message: 'Product P-100 unit 1 was not placed.' }],
};
const plan = {
  placedItems: [],
  unplacedItems: [{ productId: 'P-100', unitIndex: 1, message: 'No floor space available.' }],
  steps: [],
  alerts: [{ type: 'UNPLACED_ITEM', severity: 'CRITICAL', message: 'Product P-100 unit 1 was not placed.' }],
  metrics: { volumeUtilizationPct: 95, unplacedItemCount: 1 },
} as unknown as LoadingPlannerResult;

function mockClient(resolvedContent: string) {
  return { chatCompletion: vi.fn().mockResolvedValue(resolvedContent) };
}

describe('DiagnosisAgent', () => {
  it('returns the model text response as the diagnosis, using its own model/temperature', async () => {
    const client = mockClient('El camion esta lleno; probá con un camion mas grande.');
    const agent = new DiagnosisAgent(client, { model: 'diagnose-model', temperature: 0.1 });

    const diagnosis = await agent.diagnose({ rulesText: 'r', constraints, plan, problems, catalogContext });

    expect(diagnosis).toBe('El camion esta lleno; probá con un camion mas grande.');
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
    const [params] = client.chatCompletion.mock.calls[0];
    expect(params.model).toBe('diagnose-model');
    expect(params.temperature).toBe(0.1);
  });

  it('sends the Spanish logistics-diagnostician system prompt with the catalog context injected', async () => {
    const client = mockClient('diagnostico');
    const agent = new DiagnosisAgent(client, { model: 'diagnose-model' });

    await agent.diagnose({ rulesText: 'r', constraints, plan, problems, catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage.content.toLowerCase()).toContain('espanol');
    expect(systemMessage.content).toContain('P-100');
  });

  it('includes the operator rules, applied constraints, and problems in the user message', async () => {
    const client = mockClient('diagnostico');
    const agent = new DiagnosisAgent(client, { model: 'diagnose-model' });

    await agent.diagnose({ rulesText: 'Perfiles no pueden ir del lado de la puerta.', constraints, plan, problems, catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const userMessage = params.messages.find((message: { role: string }) => message.role === 'user');
    const payload = JSON.parse(userMessage.content);

    expect(payload.operatorRules).toBe('Perfiles no pueden ir del lado de la puerta.');
    expect(payload.appliedRules).toEqual(constraints.hardRules);
    expect(payload.problems).toEqual(problems);
  });
});
