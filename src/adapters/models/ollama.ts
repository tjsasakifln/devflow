/**
 * Ollama Model Adapter (local-first, no API key required)
 *
 * Uses Ollama's OpenAI-compatible API at localhost:11434.
 */

import type { DevflowModelProvider, ModelOptions, ModelResponse } from "./index.js";

export function createOllamaProvider(modelName = "llama3.2"): DevflowModelProvider {
  let model: unknown = null;

  async function ensureModel(): Promise<unknown> {
    if (model) return model;
    try {
      const { ChatOpenAI } = await import("@langchain/openai");
      model = new ChatOpenAI({
        openAIApiKey: "ollama", // not used but required by SDK
        modelName,
        temperature: 0.2,
        configuration: {
          baseURL: "http://localhost:11434/v1",
        },
      });
      return model;
    } catch {
      throw new Error(
        "Ollama not available. Install Ollama and pull a model, or install @langchain/openai."
      );
    }
  }

  return {
    name: "ollama",
    async invoke(prompt: string, options?: ModelOptions): Promise<ModelResponse> {
      const m = await ensureModel() as { invoke: (input: string) => Promise<{ content: string }> };
      const result = await m.invoke(prompt);
      return { content: result.content, modelName: options?.modelName ?? modelName };
    },
  };
}
