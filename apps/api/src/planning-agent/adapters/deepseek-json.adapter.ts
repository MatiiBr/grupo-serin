import 'reflect-metadata';
import type { ConstraintSet } from '@camiones/shared';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ConstraintSetDto } from '../dto/constraint-set.dto';
import type { AgentPort, CatalogContext, ExplainPlanParams, PlanConstraintsParams } from '../ports/agent.port';
import type { DeepSeekChatMessage, DeepSeekClient } from './deepseek.client';

/**
 * loading-agent-llm Phase 6.2/6.3 — DEFAULT `AgentPort` implementation.
 * Instructs DeepSeek (JSON mode) to emit ONLY a `ConstraintSet` JSON payload
 * matching `ConstraintSetDto`'s schema, injecting the operation's real
 * catalog (product codes/families/zones/destinations) so it references real
 * data instead of hallucinating. The raw response is parsed and validated
 * here; either failure mode (malformed JSON, schema-invalid JSON) surfaces
 * as a typed error — never a raw crash — so the caller (the Phase 7
 * validation gate) can react deterministically.
 */

export class ConstraintSetParseError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ConstraintSetParseError';
  }
}

export class ConstraintSetValidationError extends Error {
  constructor(
    message: string,
    readonly errors: ValidationError[],
  ) {
    super(message);
    this.name = 'ConstraintSetValidationError';
  }
}

const SYSTEM_PROMPT_HEADER = [
  'You are a logistics loading-constraint extraction agent.',
  'Read the operator instructions and extract ONLY hard placement rules.',
  'Respond with ONLY a single JSON object matching this exact schema — no prose, no markdown code fences, no explanation:',
  '{ "version": 1, "hardRules": [ <rule>, ... ], "notes"?: string }',
  'Each <rule> MUST be one of these EXACT shapes — use these EXACT field names, nothing else. The truck-zone field is ALWAYS named "zone" — never a synonym, never a prefixed/suffixed variant:',
  '  STACKING_PROHIBITION{type,productCode}',
  '  FRAGILE_ON_TOP{type,productCode}',
  '  ZONE_RESTRICTION{type,productCode,zone}',
  '  TIER_RESTRICTION{type,productCode,maxTier}',
  '  FAMILY_PLACEMENT_BAN{type,family,zone}',
  'Field meanings: "type" is the rule discriminator (one of the five names above); "productCode" is a single product code; "family" is a product family; "zone" is a truck zone; "maxTier" is a positive integer (max stacking tier, 1 = ground tier).',
  'Example — "No stacking on P-100 and P-200 must stay in DOOR_SIDE":',
  '{ "version": 1, "hardRules": [ { "type": "STACKING_PROHIBITION", "productCode": "P-100" }, { "type": "ZONE_RESTRICTION", "productCode": "P-200", "zone": "DOOR_SIDE" } ] }',
  'Every "productCode" and "family" you reference MUST come from the catalog below — never invent one.',
].join('\n');

export class DeepSeekJsonAdapter implements AgentPort {
  constructor(private readonly client: Pick<DeepSeekClient, 'chatCompletion'>) {}

  async planConstraints({ rulesText, catalogContext }: PlanConstraintsParams): Promise<ConstraintSet> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt(catalogContext) },
      { role: 'user', content: rulesText },
    ];

    const content = await this.client.chatCompletion({ messages });
    return this.parseAndValidate(content);
  }

  async explainPlan({ plan, constraints }: ExplainPlanParams): Promise<string> {
    const messages: DeepSeekChatMessage[] = [
      {
        role: 'system',
        content: 'You are a logistics assistant. Explain the loading plan in plain language for a warehouse operator, in 2-4 short paragraphs.',
      },
      { role: 'user', content: JSON.stringify({ plan, appliedRules: constraints.hardRules }) },
    ];

    return this.client.chatCompletion({ messages });
  }

  private buildSystemPrompt(catalogContext: CatalogContext): string {
    return [
      SYSTEM_PROMPT_HEADER,
      `Known product codes: ${catalogContext.productCodes.join(', ') || 'none'}.`,
      `Known product families: ${catalogContext.families.join(', ') || 'none'}.`,
      `Known truck zones: ${catalogContext.zones.join(', ') || 'none'}.`,
      `Known destinations: ${catalogContext.destinations.join(', ') || 'none'}.`,
    ].join('\n');
  }

  private async parseAndValidate(content: string): Promise<ConstraintSet> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new ConstraintSetParseError('DeepSeek response is not valid JSON.', error);
    }

    const instance = plainToInstance(ConstraintSetDto, parsed);
    const errors = await validate(instance);

    if (errors.length > 0) {
      throw new ConstraintSetValidationError('DeepSeek response does not match the ConstraintSet schema.', errors);
    }

    return instance as unknown as ConstraintSet;
  }
}
