import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';
import { PlanExplanationAgent } from './plan-explanation.agent';

/**
 * multi-agent refactor — `PlanExplanationAgent`, one of the two TEXT
 * role-agents. Plain `chatCompletion`, no ConstraintSet to validate — same
 * Spanish system prompt as the pre-refactor adapters
 * (`EXPLAIN_PLAN_SYSTEM_PROMPT`), but sends its OWN model/temperature
 * (`DEEPSEEK_MODEL_EXPLAIN`/`DEEPSEEK_TEMPERATURE_EXPLAIN`).
 */

const plan = { placedItems: [], unplacedItems: [], steps: [], alerts: [], metrics: {} } as unknown as LoadingPlannerResult;
const constraints = { version: 1 as const, hardRules: [{ type: 'STACKING_PROHIBITION' as const, productCode: 'P-100' }] };

function mockClient(resolvedContent: string) {
  return { chatCompletion: vi.fn().mockResolvedValue(resolvedContent) };
}

describe('PlanExplanationAgent', () => {
  it('returns the model response content as the explanation, using its own model/temperature', async () => {
    const client = mockClient('El plan ubica P-100 en CENTER.');
    const agent = new PlanExplanationAgent(client, { model: 'explain-model', temperature: 0.7 });

    const explanation = await agent.explain({ plan, constraints });

    expect(explanation).toBe('El plan ubica P-100 en CENTER.');
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
    const [params] = client.chatCompletion.mock.calls[0];
    expect(params.model).toBe('explain-model');
    expect(params.temperature).toBe(0.7);
  });

  it('instructs the model to explain the plan in Spanish (same prompt as the pre-refactor adapters)', async () => {
    const client = mockClient('Poné el pallet en el piso.');
    const agent = new PlanExplanationAgent(client, { model: 'explain-model' });

    await agent.explain({ plan, constraints });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage?.content.toLowerCase()).toContain('espanol');
  });

  it('includes the plan and applied rules in the user message', async () => {
    const client = mockClient('ok');
    const agent = new PlanExplanationAgent(client, { model: 'explain-model' });

    await agent.explain({ plan, constraints });

    const [params] = client.chatCompletion.mock.calls[0];
    const userMessage = params.messages.find((message: { role: string }) => message.role === 'user');
    const payload = JSON.parse(userMessage.content);
    expect(payload.appliedRules).toEqual(constraints.hardRules);
  });
});
