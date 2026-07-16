/**
 * loading-agent-llm Phase 5.3 — raw-`fetch` client for the DeepSeek
 * OpenAI-compatible `/chat/completions` endpoint (Huawei Cloud). No SDK
 * dependency — a plain `fetch` POST, config-injected. Consumed by
 * `DeepSeekJsonAdapter` (Phase 6) behind `AgentPort`; never imported from
 * `domain/loading-planner/**` (enforced by `no-llm-imports.spec.ts`).
 */

export interface DeepSeekClientConfig {
  baseUrl?: string;
  apiKey?: string;
  model: string;
}

export interface DeepSeekChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekChatCompletionParams {
  messages: DeepSeekChatMessage[];
}

interface DeepSeekChatCompletionResponse {
  choices: Array<{ message: { role: string; content: string } }>;
}

/** Typed error for any failure talking to DeepSeek — non-2xx HTTP status or a network-level fetch rejection. */
export class DeepSeekRequestError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DeepSeekRequestError';
  }
}

export class DeepSeekClient {
  constructor(private readonly config: DeepSeekClientConfig) {}

  async chatCompletion(params: DeepSeekChatCompletionParams): Promise<string> {
    let response: Response;

    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ model: this.config.model, messages: params.messages }),
      });
    } catch (error) {
      throw new DeepSeekRequestError('DeepSeek request failed: network error.', error);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new DeepSeekRequestError(`DeepSeek request failed with status ${response.status}.`, body);
    }

    const payload = (await response.json()) as DeepSeekChatCompletionResponse;
    return payload.choices[0].message.content;
  }
}
