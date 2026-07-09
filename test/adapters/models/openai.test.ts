import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/adapters/models/retry.js", () => ({
  withRetry: vi.fn(),
  getDefaultConfig: vi.fn(() => ({ maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 15000, timeoutMs: 30000, providerName: "openai" })),
  warnBatchCost: vi.fn(),
}));

import { createOpenAIProvider } from "../../../src/adapters/models/openai.js";

describe("createOpenAIProvider", () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => { vi.clearAllMocks(); process.env = { ...ORIGINAL_ENV }; delete process.env.OPENAI_API_KEY; });
  afterAll(() => { process.env = ORIGINAL_ENV; });

  it("name is openai", () => { process.env.OPENAI_API_KEY = "k"; expect(createOpenAIProvider().name).toBe("openai"); });
  it("throws when no key", () => { expect(() => createOpenAIProvider()).toThrow("OPENAI_API_KEY not set"); });
  it("accepts explicit key", () => { expect(() => createOpenAIProvider("sk-k")).not.toThrow(); });
});
