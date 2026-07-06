/**
 * AI Configuration
 *
 * Controls AI provider selection, usage policy, and cost limits.
 * Stored in .devflow/config.json under aiConfig key.
 * AI is disabled by default — users must explicitly opt in via 'devflow ai init'.
 */

import type { ModelProviderId } from "../../adapters/models/index.js";

export interface AIConfig {
  /** Which model provider to use. */
  provider: ModelProviderId;
  /** Model name/version. */
  modelName: string;
  /** Environment variable name holding the API key. */
  apiKeyEnvVar: string;
  /** Whether AI features are enabled. */
  enabled: boolean;
  /** Usage policy controls. */
  usagePolicy: AIUsagePolicy;
}

export interface AIUsagePolicy {
  /** Approximate cost limit per run in USD. */
  costLimitPerRun: number;
  /** Maximum tokens per request. */
  maxTokensPerRequest: number;
  /** Whether to prompt user for consent before each AI call. */
  requireUserConsent: boolean;
}

/** Default AI configuration — AI off by default. */
export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: "ollama",
  modelName: "llama3.2",
  apiKeyEnvVar: "OLLAMA_API_KEY",
  enabled: false,
  usagePolicy: {
    costLimitPerRun: 0.10,
    maxTokensPerRequest: 4096,
    requireUserConsent: true,
  },
};
