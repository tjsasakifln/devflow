/**
 * Model Provider Interface
 *
 * All AI model providers implement this interface.
 * The kernel never imports from here — only intelligence/ layer does.
 */

export interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  modelName?: string;
  systemPrompt?: string;
}

export interface ModelResponse {
  content: string;
  tokenUsage?: { input: number; output: number };
  modelName?: string;
}

export interface DevflowModelProvider {
  readonly name: string;
  invoke(prompt: string, options?: ModelOptions): Promise<ModelResponse>;
  stream?(prompt: string, options?: ModelOptions): AsyncIterable<string>;
}

/** Providers currently configured. */
export type ModelProviderId = "openai" | "anthropic" | "openrouter" | "google" | "ollama";
