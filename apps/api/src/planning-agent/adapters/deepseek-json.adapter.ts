import 'reflect-metadata';
import type { ConstraintSet } from '@camiones/shared';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';
import type {
  AgentPort,
  CatalogContext,
  DiagnoseUnresolvedPlanParams,
  ExplainPlanParams,
  IntentValidation,
  PlanConstraintsParams,
  PlanProblems,
  ReviseConstraintsParams,
  ValidateIntentParams,
} from '../ports/agent.port';
import { ConstraintSetParseError, ConstraintSetValidationError, parseAndValidateConstraintSet } from './constraint-set-parser';
import { parseIntentValidation } from './intent-validation-parser';
import type { DeepSeekChatMessage, DeepSeekClient } from './deepseek.client';

/**
 * loading-agent-llm Phase 6.2/6.3 — DEFAULT `AgentPort` implementation.
 * Instructs DeepSeek (JSON mode) to emit ONLY a `ConstraintSet` JSON payload
 * matching `ConstraintSetDto`'s schema, injecting the operation's real
 * catalog (product codes/families/zones/destinations) so it references real
 * data instead of hallucinating. The raw response is parsed and validated
 * via `parseAndValidateConstraintSet` (shared with `DeepSeekToolUseAdapter`
 * — see `constraint-set-parser.ts`); either failure mode (malformed JSON,
 * schema-invalid JSON) surfaces as a typed error — never a raw crash — so
 * the caller (the Phase 7 validation gate) can react deterministically.
 *
 * `SYSTEM_PROMPT_HEADER`, `REVISION_SYSTEM_PROMPT_ADDENDUM`,
 * `EXPLAIN_PLAN_SYSTEM_PROMPT`, `DIAGNOSE_UNRESOLVED_PLAN_SYSTEM_PROMPT`, and
 * `formatCatalogContextLines` are exported so `DeepSeekToolUseAdapter` (real,
 * tool-use — see its module docstring) mirrors the EXACT same rule-schema
 * wording and catalog injection rather than a hand-copied, driftable
 * duplicate.
 *
 * DIAGNOSIS agent — `diagnoseUnresolvedPlan` is called by
 * `PlanningAgentService.plan` ONLY when the self-correcting re-plan loop's
 * BEST attempt is still not clean after `maxPlanAttempts` (unplaced units
 * and/or critical alerts remain). It uses plain `chatCompletion` (free text,
 * no schema to validate — this is prose for a human, not a `ConstraintSet`)
 * with a dedicated Spanish system prompt framing the model as a logistics
 * diagnostician.
 *
 * VALIDATION agent — `validateIntent` is an ADVISORY ONLY semantic/intent
 * check, called once by `PlanningAgentService.plan` on the FIRST successful
 * (gate-validated) `ConstraintSet`, before the self-correcting re-plan
 * loop's revisions. It uses plain `chatCompletion` (a SMALL JSON payload,
 * `{ intentMatch, issues }` — not the full `ConstraintSet` schema, so it
 * reuses `parseIntentValidation`/`intent-validation-parser.ts` rather than
 * `parseAndValidateConstraintSet`) with a dedicated Spanish reviewer system
 * prompt that watches especially for the classic ZONE_RESTRICTION
 * (confine-TO) vs PRODUCT_ZONE_BAN (ban-FROM) inversion, and product/zone
 * misreads. Never used to alter the constraints or the plan.
 */

export { ConstraintSetParseError, ConstraintSetValidationError };

export const SYSTEM_PROMPT_HEADER = [
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
  '  PRODUCT_ZONE_BAN{type,productCode,zone}',
  'Field meanings: "type" is the rule discriminator (one of the six names above); "productCode" is a single product code; "family" is a product family; "zone" is a truck zone; "maxTier" is a positive integer (max stacking tier, 1 = ground tier).',
  'CRITICAL — do not confuse these two zone rules, they are OPPOSITES:',
  '  ZONE_RESTRICTION means the product may ONLY go in "zone" — it CONFINES the product TO that zone. Use it when the instruction says the product must go in / must stay in / only in a specific zone.',
  '  PRODUCT_ZONE_BAN means the product must NOT go in "zone" — it BANS the product FROM that zone; the product may go anywhere else. Use it when the instruction says the product cannot / must not / cannot go in / is forbidden from a specific zone.',
  '  Rule of thumb: "X cannot/must not go in zone Z" -> PRODUCT_ZONE_BAN{productCode:X, zone:Z}. "X must go in / only in zone Z" -> ZONE_RESTRICTION{productCode:X, zone:Z}.',
  'Example — "No stacking on P-100, P-200 must stay in DOOR_SIDE, and P-300 cannot go in CABIN_SIDE":',
  '{ "version": 1, "hardRules": [ { "type": "STACKING_PROHIBITION", "productCode": "P-100" }, { "type": "ZONE_RESTRICTION", "productCode": "P-200", "zone": "DOOR_SIDE" }, { "type": "PRODUCT_ZONE_BAN", "productCode": "P-300", "zone": "CABIN_SIDE" } ] }',
  'Every "productCode" and "family" you reference MUST come from the catalog below — never invent one.',
].join('\n');

/**
 * self-correcting-replan-loop — appended after `SYSTEM_PROMPT_HEADER` when
 * revising a previous `ConstraintSet`. Exported so `DeepSeekToolUseAdapter`
 * reuses the identical wording for its own revision system prompt.
 */
export const REVISION_SYSTEM_PROMPT_ADDENDUM = [
  'You are now REVISING a ConstraintSet that produced a plan with problems (units that could not be placed, and/or critical alerts). You will be given the previous ConstraintSet and a summary of what went wrong.',
  'Emit an ADJUSTED ConstraintSet in the exact same schema that still honors the operator\'s original intent but is expected to yield a MORE PLACEABLE plan — e.g. relax an over-restrictive zone ban, allow a family more zones, raise a maxTier, or drop a rule that is no longer needed. Do not simply repeat the previous ConstraintSet unchanged.',
].join('\n');

/** Reused verbatim by `DeepSeekToolUseAdapter.explainPlan` (no tool needed for this call). */
export const EXPLAIN_PLAN_SYSTEM_PROMPT =
  'Sos un asistente de logistica. Explicale el plan de carga a un operario de deposito en lenguaje claro y directo, en 2-4 parrafos cortos. Responde SIEMPRE en espanol.';

/**
 * DIAGNOSIS agent — reused verbatim by `DeepSeekToolUseAdapter.diagnoseUnresolvedPlan`
 * (no tool needed, free text for a human operator). Frames the model as a
 * logistics diagnostician: given a plan that could not place every unit
 * and/or raised critical alerts, explain WHICH items failed, the LIKELY
 * cause, and ONE concrete suggestion.
 */
export const DIAGNOSE_UNRESOLVED_PLAN_SYSTEM_PROMPT = [
  'Sos un diagnosticador experto en logistica de cargas.',
  'Se te da un plan de carga que NO logro ubicar todos los productos y/o genero alertas criticas, junto con las reglas del operario, las restricciones aplicadas y un resumen de los problemas (items sin ubicar y alertas criticas).',
  'Escribi un diagnostico breve y accionable para un operario de deposito, en espanol, en 1 a 3 parrafos cortos:',
  '1) Que productos no se pudieron ubicar.',
  '2) La causa mas probable: el camion esta efectivamente lleno (sin espacio o capacidad disponible) o una regla del operario es demasiado restrictiva.',
  '3) UNA sugerencia concreta y accionable (por ejemplo: relajar una regla especifica, usar un camion mas grande, o dividir la carga en dos viajes).',
  'Se conciso, directo y practico. Nada de relleno ni disculpas. Responde SIEMPRE en espanol.',
].join('\n');

/**
 * VALIDATION agent — reused verbatim by `DeepSeekToolUseAdapter.validateIntent`
 * and by `ValidationAgent` (no tool needed, small JSON payload for a
 * deterministic parser, not a human). Frames the model as a REVIEWER whose
 * only job is to compare the operator's original free-text rules against the
 * `ConstraintSet` a DIFFERENT agent already extracted from them, and flag any
 * discrepancy — this is a second, independent pass, never a replacement for
 * the structural/catalog validation gate.
 */
export const VALIDATE_INTENT_SYSTEM_PROMPT = [
  'Sos un revisor experto en logistica de cargas.',
  'Tu unica tarea es verificar si un ConstraintSet (reglas duras estructuradas) extraido de las instrucciones de un operario refleja fielmente su intencion original. No proponer un ConstraintSet nuevo ni corregir nada — solo evaluar y reportar.',
  'Se te da el texto original del operario y el ConstraintSet ya extraido. Compara ambos con cuidado.',
  'Presta ESPECIAL atencion a la inversion clasica entre ZONE_RESTRICTION y PRODUCT_ZONE_BAN, que son OPUESTAS:',
  '  ZONE_RESTRICTION CONFINA el producto A esa zona (solo puede ir ahi).',
  '  PRODUCT_ZONE_BAN PROHIBE el producto DE esa zona (puede ir a cualquier otro lado).',
  '  Si el operario dijo "no puede ir en Z" / "prohibido en Z" y el ConstraintSet usa ZONE_RESTRICTION, o si el operario dijo "debe ir solo en Z" / "tiene que quedar en Z" y el ConstraintSet usa PRODUCT_ZONE_BAN, es una inversion — reportala SIEMPRE como problema.',
  'Tambien revisa: productos o familias mal identificados (codigo o familia equivocados), zonas mal identificadas, reglas que el operario pidio pero no aparecen en el ConstraintSet (omision), y reglas que aparecen en el ConstraintSet pero el operario nunca pidio (invencion).',
  'Respondé con UNICAMENTE un objeto JSON con este esquema exacto — sin prosa, sin markdown, sin explicacion adicional:',
  '{ "intentMatch": boolean, "issues": string[] }',
  '"intentMatch" es true UNICAMENTE si el ConstraintSet refleja fielmente la intencion del operario, sin ninguna discrepancia. "issues" es un array de strings, cada uno EN ESPANOL (espanol) describiendo una discrepancia concreta encontrada; DEBE estar vacio cuando intentMatch es true. Responde SIEMPRE en espanol.',
].join('\n');

/** Formats the real catalog into prompt lines — shared by both `AgentPort` implementations so neither hallucinates against a stale/hand-copied catalog format. */
export function formatCatalogContextLines(catalogContext: CatalogContext): string[] {
  return [
    `Known product codes: ${catalogContext.productCodes.join(', ') || 'none'}.`,
    `Known product families: ${catalogContext.families.join(', ') || 'none'}.`,
    `Known truck zones: ${catalogContext.zones.join(', ') || 'none'}.`,
    `Known destinations: ${catalogContext.destinations.join(', ') || 'none'}.`,
  ];
}

export class DeepSeekJsonAdapter implements AgentPort {
  constructor(private readonly client: Pick<DeepSeekClient, 'chatCompletion'>) {}

  async planConstraints({ rulesText, catalogContext }: PlanConstraintsParams): Promise<ConstraintSet> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt(catalogContext) },
      { role: 'user', content: rulesText },
    ];

    const content = await this.client.chatCompletion({ messages });
    return parseAndValidateConstraintSet(content);
  }

  async reviseConstraints({ rulesText, previousConstraints, problems, catalogContext }: ReviseConstraintsParams): Promise<ConstraintSet> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildRevisionSystemPrompt(catalogContext) },
      { role: 'user', content: this.buildRevisionUserPrompt(rulesText, previousConstraints, problems) },
    ];

    const content = await this.client.chatCompletion({ messages });
    return parseAndValidateConstraintSet(content);
  }

  async explainPlan({ plan, constraints }: ExplainPlanParams): Promise<string> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: EXPLAIN_PLAN_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ plan, appliedRules: constraints.hardRules }) },
    ];

    return this.client.chatCompletion({ messages });
  }

  /**
   * DIAGNOSIS agent — called ONLY when the re-plan loop's BEST attempt is
   * still not clean. Free-text output (no `ConstraintSet` to validate), so
   * plain `chatCompletion` is enough — no tool needed even on the tool-use
   * adapter.
   */
  async diagnoseUnresolvedPlan({ rulesText, constraints, plan, problems, catalogContext }: DiagnoseUnresolvedPlanParams): Promise<string> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildDiagnosisSystemPrompt(catalogContext) },
      { role: 'user', content: this.buildDiagnosisUserPrompt(rulesText, constraints, problems, plan) },
    ];

    return this.client.chatCompletion({ messages });
  }

  /**
   * VALIDATION agent — ADVISORY ONLY. Free-standing reviewer pass; never
   * called with the intent of altering `constraints`. Plain `chatCompletion`
   * (small JSON payload, not a `ConstraintSet`), parsed via
   * `parseIntentValidation`.
   */
  async validateIntent({ rulesText, constraints, catalogContext }: ValidateIntentParams): Promise<IntentValidation> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildValidateIntentSystemPrompt(catalogContext) },
      { role: 'user', content: this.buildValidateIntentUserPrompt(rulesText, constraints) },
    ];

    const content = await this.client.chatCompletion({ messages });
    return parseIntentValidation(content);
  }

  private buildSystemPrompt(catalogContext: CatalogContext): string {
    return [SYSTEM_PROMPT_HEADER, ...formatCatalogContextLines(catalogContext)].join('\n');
  }

  /**
   * self-correcting-replan-loop — reuses `SYSTEM_PROMPT_HEADER` (same schema,
   * same field-name pitfalls) plus the catalog, so the revised
   * `ConstraintSet` the model emits is structurally identical to a fresh
   * `planConstraints` response and can go through the exact same
   * parse+validate path.
   */
  private buildRevisionSystemPrompt(catalogContext: CatalogContext): string {
    return [SYSTEM_PROMPT_HEADER, REVISION_SYSTEM_PROMPT_ADDENDUM, ...formatCatalogContextLines(catalogContext)].join('\n');
  }

  private buildRevisionUserPrompt(rulesText: string, previousConstraints: ConstraintSet, problems: PlanProblems): string {
    return JSON.stringify({
      operatorRules: rulesText,
      previousConstraints,
      problems,
    });
  }

  /** DIAGNOSIS agent — same catalog-injection convention as the other prompts. */
  private buildDiagnosisSystemPrompt(catalogContext: CatalogContext): string {
    return [DIAGNOSE_UNRESOLVED_PLAN_SYSTEM_PROMPT, ...formatCatalogContextLines(catalogContext)].join('\n');
  }

  /**
   * DIAGNOSIS agent — `planMetrics` (not the full `placedItems`/`steps`
   * arrays) is enough signal for the "truck effectively full vs.
   * over-restrictive rule" judgment call, and keeps the payload small.
   */
  private buildDiagnosisUserPrompt(
    rulesText: string,
    constraints: ConstraintSet,
    problems: PlanProblems,
    plan: LoadingPlannerResult,
  ): string {
    return JSON.stringify({
      operatorRules: rulesText,
      appliedRules: constraints.hardRules,
      problems,
      planMetrics: plan.metrics,
    });
  }

  /** VALIDATION agent — same catalog-injection convention as the other prompts. */
  private buildValidateIntentSystemPrompt(catalogContext: CatalogContext): string {
    return [VALIDATE_INTENT_SYSTEM_PROMPT, ...formatCatalogContextLines(catalogContext)].join('\n');
  }

  private buildValidateIntentUserPrompt(rulesText: string, constraints: ConstraintSet): string {
    return JSON.stringify({
      operatorRules: rulesText,
      extractedConstraints: constraints.hardRules,
    });
  }
}
