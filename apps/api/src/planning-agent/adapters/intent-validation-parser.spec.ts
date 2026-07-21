import { describe, expect, it } from 'vitest';
import { IntentValidationParseError, IntentValidationSchemaError, parseIntentValidation } from './intent-validation-parser';

/**
 * VALIDATION agent — the SINGLE parse+validate gate for the small
 * `{ intentMatch: boolean, issues: string[] }` payload the VALIDATION agent
 * returns. Mirrors `constraint-set-parser.ts`'s split between a JSON-parse
 * failure (`IntentValidationParseError`) and a schema-mismatch failure
 * (`IntentValidationSchemaError`) so callers can react deterministically
 * instead of a raw crash — same contract, tiny schema.
 */
describe('parseIntentValidation', () => {
  it('parses a well-formed { intentMatch: true, issues: [] } payload', () => {
    const result = parseIntentValidation(JSON.stringify({ intentMatch: true, issues: [] }));

    expect(result).toEqual({ intentMatch: true, issues: [] });
  });

  it('parses a well-formed mismatch payload with Spanish issues', () => {
    const golden = { intentMatch: false, issues: ['Se uso ZONE_RESTRICTION en vez de PRODUCT_ZONE_BAN para P-100.'] };

    const result = parseIntentValidation(JSON.stringify(golden));

    expect(result).toEqual(golden);
  });

  it('throws IntentValidationParseError when the content is not valid JSON', () => {
    expect(() => parseIntentValidation('this is not json {')).toThrow(IntentValidationParseError);
  });

  it('throws IntentValidationSchemaError when "intentMatch" is missing or not boolean', () => {
    expect(() => parseIntentValidation(JSON.stringify({ issues: [] }))).toThrow(IntentValidationSchemaError);
    expect(() => parseIntentValidation(JSON.stringify({ intentMatch: 'yes', issues: [] }))).toThrow(IntentValidationSchemaError);
  });

  it('throws IntentValidationSchemaError when "issues" is missing or not an array of strings', () => {
    expect(() => parseIntentValidation(JSON.stringify({ intentMatch: true }))).toThrow(IntentValidationSchemaError);
    expect(() => parseIntentValidation(JSON.stringify({ intentMatch: true, issues: [1, 2] }))).toThrow(IntentValidationSchemaError);
  });

  it('throws IntentValidationSchemaError when the payload is not an object (e.g. an array or null)', () => {
    expect(() => parseIntentValidation(JSON.stringify(null))).toThrow(IntentValidationSchemaError);
    expect(() => parseIntentValidation(JSON.stringify([1, 2, 3]))).toThrow(IntentValidationSchemaError);
  });
});
