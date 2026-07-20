import 'reflect-metadata';
import type { ConstraintSet } from '@camiones/shared';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogContext } from '../ports/agent.port';
import { ValidationAgent } from './validation.agent';

/**
 * VALIDATION agent — the 5th role-agent, ADVISORY ONLY. `validate(...)`
 * checks whether an already-extracted `ConstraintSet` faithfully reflects
 * the operator's original free-text rules. Free-standing TEXT-style agent
 * (mirrors `DiagnosisAgent`/`PlanExplanationAgent`): calls plain
 * `chatCompletion` directly with its own model/temperature, but — unlike
 * those two — the response is a SMALL JSON payload
 * (`{ intentMatch, issues }`), so it is run through `parseIntentValidation`
 * (mirrors `constraint-set-parser.ts`'s approach) rather than returned as
 * raw text.
 */

const catalogContext: CatalogContext = {
  productCodes: ['P-100', 'P-200'],
  families: ['COIL'],
  zones: ['CABIN_SIDE', 'CENTER', 'DOOR_SIDE'],
  destinations: ['dest-1'],
};
const constraints: ConstraintSet = {
  version: 1,
  hardRules: [{ type: 'ZONE_RESTRICTION', productCode: 'P-100', zone: 'CABIN_SIDE' as never }],
};

function mockClient(resolvedContent: string) {
  return { chatCompletion: vi.fn().mockResolvedValue(resolvedContent) };
}

describe('ValidationAgent', () => {
  it('returns a matching-intent IntentValidation, using its own model/temperature', async () => {
    const client = mockClient(JSON.stringify({ intentMatch: true, issues: [] }));
    const agent = new ValidationAgent(client, { model: 'validate-model', temperature: 0.1 });

    const result = await agent.validate({ rulesText: 'P-100 debe quedar solo en la cabina.', constraints, catalogContext });

    expect(result).toEqual({ intentMatch: true, issues: [] });
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
    const [params] = client.chatCompletion.mock.calls[0];
    expect(params.model).toBe('validate-model');
    expect(params.temperature).toBe(0.1);
  });

  it('returns a mismatching-intent IntentValidation with the Spanish issues surfaced', async () => {
    const golden = {
      intentMatch: false,
      issues: ['Se uso ZONE_RESTRICTION (confina) cuando el operario pidio prohibir la zona (PRODUCT_ZONE_BAN).'],
    };
    const client = mockClient(JSON.stringify(golden));
    const agent = new ValidationAgent(client, { model: 'validate-model' });

    const result = await agent.validate({ rulesText: 'P-100 no puede ir en la cabina.', constraints, catalogContext });

    expect(result).toEqual(golden);
  });

  it('sends a Spanish reviewer system prompt distinguishing ZONE_RESTRICTION (confine-TO) from PRODUCT_ZONE_BAN (ban-FROM), with the catalog injected', async () => {
    const client = mockClient(JSON.stringify({ intentMatch: true, issues: [] }));
    const agent = new ValidationAgent(client, { model: 'validate-model' });

    await agent.validate({ rulesText: 'r', constraints, catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    const content: string = systemMessage.content;

    expect(content.toLowerCase()).toContain('espanol');
    expect(content).toContain('ZONE_RESTRICTION');
    expect(content).toContain('PRODUCT_ZONE_BAN');
    expect(content).toContain('P-100');
  });

  it('includes the operator rules and the extracted constraints in the user message', async () => {
    const client = mockClient(JSON.stringify({ intentMatch: true, issues: [] }));
    const agent = new ValidationAgent(client, { model: 'validate-model' });

    await agent.validate({ rulesText: 'P-100 debe quedar solo en la cabina.', constraints, catalogContext });

    const [params] = client.chatCompletion.mock.calls[0];
    const userMessage = params.messages.find((message: { role: string }) => message.role === 'user');
    const payload = JSON.parse(userMessage.content);

    expect(payload.operatorRules).toBe('P-100 debe quedar solo en la cabina.');
    expect(payload.extractedConstraints).toEqual(constraints.hardRules);
  });

  it('rejects with a typed error when the model response is not valid JSON', async () => {
    const client = mockClient('not json {');
    const agent = new ValidationAgent(client, { model: 'validate-model' });

    const error = await agent.validate({ rulesText: 'r', constraints, catalogContext }).catch((e: unknown) => e);
    expect((error as Error).name).toBe('IntentValidationParseError');
  });

  it('rejects with a typed error when the JSON is well-formed but fails the IntentValidation schema', async () => {
    const client = mockClient(JSON.stringify({ intentMatch: 'yes' }));
    const agent = new ValidationAgent(client, { model: 'validate-model' });

    const error = await agent.validate({ rulesText: 'r', constraints, catalogContext }).catch((e: unknown) => e);
    expect((error as Error).name).toBe('IntentValidationSchemaError');
  });
});
