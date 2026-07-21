import type { IntentValidation } from '../ports/agent.port';

/**
 * VALIDATION agent — the SINGLE parse+validate gate for the small
 * `{ intentMatch: boolean, issues: string[] }` payload every `AgentPort`
 * implementation's `validateIntent` returns. Mirrors `constraint-set-parser.ts`'s
 * split between a JSON-parse failure (`IntentValidationParseError`) and a
 * schema-mismatch failure (`IntentValidationSchemaError`) — both surface as a
 * typed error, never a raw crash, so `ValidationAgent`/the adapters can react
 * deterministically. No class-validator DTO needed — the schema is a single
 * flat object with two fields, so a hand-rolled shape check is enough and
 * keeps this module framework-free.
 */

export class IntentValidationParseError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'IntentValidationParseError';
  }
}

export class IntentValidationSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntentValidationSchemaError';
  }
}

export function parseIntentValidation(content: string): IntentValidation {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new IntentValidationParseError('DeepSeek response is not valid JSON.', error);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new IntentValidationSchemaError('DeepSeek response does not match the IntentValidation schema.');
  }

  const candidate = parsed as Record<string, unknown>;
  const issuesValid = Array.isArray(candidate.issues) && candidate.issues.every((issue) => typeof issue === 'string');

  if (typeof candidate.intentMatch !== 'boolean' || !issuesValid) {
    throw new IntentValidationSchemaError('DeepSeek response does not match the IntentValidation schema.');
  }

  return { intentMatch: candidate.intentMatch, issues: candidate.issues as string[] };
}
