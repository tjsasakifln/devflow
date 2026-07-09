import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

vi.mock("../../../src/adapters/models/retry.js", () => ({
  withRetry: vi.fn(),
  getDefaultConfig: vi.fn(() => ({ maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 15000, timeoutMs: 30000, providerName: "anthropic" })),
  warnBatchCost: vi.fn(),
}));

import { createAnthropicProvider } from "../../../src/adapters/models/anthropic.js";

describe("createAnthropicProvider", () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => { vi.clearAllMocks(); process.env = { ...ORIGINAL_ENV }; delete process.env.ANTHROPIC_API_KEY; });
  afterAll(() => { process.env = ORIGINAL_ENV; });

  it("name is anthropic", () => { process.env.ANTHROPIC_API_KEY = "k"; expect(createAnthropicProvider().name).toBe("anthropic"); });
  it("throws when no key", () => { expect(() => createAnthropicProvider()).toThrow("ANTHROPIC_API_KEY not set"); });
  it("accepts explicit key", () => { expect(() => createAnthropicProvider("sk-k")).not.toThrow(); });
  it("has invoke method", () => { process.env.ANTHROPIC_API_KEY = "k"; expect(createAnthropicProvider().invoke).toBeInstanceOf(Function); });
});
