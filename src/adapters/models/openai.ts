/**
 * OpenAI Model Adapter
 *
 * Requires @langchain/openai to be installed.
 * Falls back gracefully if not available.
 */

import type { DevflowModelProvider, ModelOptions, ModelResponse } from "./index.js";

export function createOpenAIProvider(apiKey?: string): DevflowModelProvider {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY not set. Configure via environment or 'devflow ai init'.");
  }

  let model: unknown = null;

  async function ensureModel(): Promise<unknown> {
    if (model) return model;
    try {
      const { ChatOpenAI } = await import("@langchain/openai");
      model = new ChatOpenAI({
        openAIApiKey: key,
        modelName: "gpt-4o",
        temperature: 0.2,
      });
      return model;
    } catch {
      throw new Error(
        "@langchain/openai not installed. Run: npm install @langchain/openai"
      );
    }
  }

  return {
    name: "openai",
    async invoke(prompt: string, options?: ModelOptions): Promise<ModelResponse> {
      const m = await ensureModel() as { invoke: (input: string) => Promise<{ content: string }> };
      const result = await m.invoke(prompt);
      return { content: result.content, modelName: options?.modelName ?? "gpt-4o" };
    },
  };
}
