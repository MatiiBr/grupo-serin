import 'reflect-metadata';
import type { ConstraintSet } from '@camiones/shared';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ConstraintSetDto } from '../dto/constraint-set.dto';

/**
 * loading-agent-llm Phase 6.2/6.3 + tool-use adapter — the SINGLE
 * parse+validate gate shared by every `AgentPort` implementation
 * (`DeepSeekJsonAdapter` parsing a raw JSON-mode response body;
 * `DeepSeekToolUseAdapter` parsing a tool call's `arguments` string). Both
 * inputs are, structurally, "a JSON string that should decode into a
 * `ConstraintSet`" — extracted here so the two adapters can never drift on
 * what counts as a parse failure vs a schema-validation failure.
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

export async function parseAndValidateConstraintSet(content: string): Promise<ConstraintSet> {
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
