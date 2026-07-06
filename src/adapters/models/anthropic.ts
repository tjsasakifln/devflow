/**
 * Anthropic Model Adapter
 *
 * Requires @langchain/anthropic to be installed.
 */

import type { DevflowModelProvider, ModelOptions, ModelResponse } from "./index.js";

export function createAnthropicProvider(apiKey?: string): DevflowModelProvider {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY not set. Configure via environment or 'devflow ai init'.");
  }

  let model: unknown = null;

  async function ensureModel(): Promise<unknown> {
    if (model) return model;
    try {
      const { ChatAnthropic } = await import("@langchain/anthropic");
      model = new ChatAnthropic({
        anthropicApiKey: key,
        modelName: "claude-sonnet-4-6",
        temperature: 0.2,
      });
      return model;
    } catch {
      throw new Error(
        "@langchain/anthropic not installed. Run: npm install @langchain/anthropic"
      );
    }
  }

  return {
    name: "anthropic",
    async invoke(prompt: string, options?: ModelOptions): Promise<ModelResponse> {
      const m = await ensureModel() as { invoke: (input: string) => Promise<{ content: string }> };
      const result = await m.invoke(prompt);
      return { content: result.content, modelName: options?.modelName ?? "claude-sonnet-4-6" };
    },
  };
}
