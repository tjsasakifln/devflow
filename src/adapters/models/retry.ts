/**
 * Shared retry with exponential backoff, timeout, and rate limit (429) handling
 * for AI model adapters.
 *
 * Story 2.7 — Rate Limiting in AI Adapters
 */
import { error as logError } from "../../kernel/utils/logger.js";

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 30_000,
};

export function getDefaultConfig(provider?: string): RetryConfig {
  const envTimeout = provider
    ? Number(process.env[`${provider.toUpperCase()}_TIMEOUT_MS`])
    : undefined;
  return {
    ...DEFAULT_CONFIG,
    timeoutMs: envTimeout && envTimeout > 0 ? envTimeout : DEFAULT_CONFIG.timeoutMs,
  };
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError?: unknown,
  ) {
    super(message);
    this.name = "RetryError";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status?: number): boolean {
  return status === 429 || (status != null && status >= 500 && status < 600);
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const result = await fn(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof Error && err.name === "AbortError") {
        throw new RetryError(
          `Request timed out after ${cfg.timeoutMs}ms (attempt ${attempt + 1}/${cfg.maxRetries + 1})`,
          attempt + 1,
          err,
        );
      }

      lastError = err;

      // Check for non-retryable errors
      const status =
        (err as Record<string, unknown>)?.status ??
        (err as Record<string, unknown>)?.statusCode;
      if (
        status != null &&
        typeof status === "number" &&
        status >= 400 &&
        status < 500 &&
        !isRetryableStatus(status)
      ) {
        throw err;
      }

      if (attempt < cfg.maxRetries) {
        const backoff = Math.min(
          cfg.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
          cfg.maxDelayMs,
        );
        logError(
          `Retry ${attempt + 1}/${cfg.maxRetries} after ${Math.round(backoff)}ms: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        await delay(backoff);
      }
    }
  }

  throw new RetryError(
    `All ${cfg.maxRetries + 1} retry attempts failed`,
    cfg.maxRetries + 1,
    lastError,
  );
}
