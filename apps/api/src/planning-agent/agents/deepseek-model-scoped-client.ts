import type { DeepSeekAgentRoleConfig } from '../config/deepseek.config';
import type { DeepSeekChatCompletionParams, DeepSeekChatCompletionWithToolsParams, DeepSeekClient } from '../adapters/deepseek.client';

/**
 * multi-agent refactor — wraps a `DeepSeekClient` (or any object satisfying
 * its `chatCompletion`/`chatCompletionWithTools` pick) so every call made
 * through the returned wrapper defaults to ONE role's `model`/`temperature`
 * (`DeepSeekAgentRoleConfig`, resolved by `deepseekConfig`'s `agents`
 * namespace) instead of the underlying client's base config. Neither
 * `DeepSeekJsonAdapter` nor `DeepSeekToolUseAdapter` ever passes its own
 * `model`/`temperature` — this is the ONLY place that does, so the two
 * STRUCTURED role-agents (`RuleExtractionAgent`/`RulePatchAgent`) can build
 * an unmodified `DeepSeekJsonAdapter`/`DeepSeekToolUseAdapter` around a
 * scoped client and get per-agent model/temperature for free, with zero
 * changes to either adapter class.
 */
export type ScopedDeepSeekClient = Pick<DeepSeekClient, 'chatCompletion' | 'chatCompletionWithTools'>;

export function scopeClientToAgent(client: ScopedDeepSeekClient, role: DeepSeekAgentRoleConfig): ScopedDeepSeekClient {
  return {
    chatCompletion: (params: DeepSeekChatCompletionParams) =>
      client.chatCompletion({ model: role.model, temperature: role.temperature, ...params }),
    chatCompletionWithTools: (params: DeepSeekChatCompletionWithToolsParams) =>
      client.chatCompletionWithTools({ model: role.model, temperature: role.temperature, ...params }),
  };
}
