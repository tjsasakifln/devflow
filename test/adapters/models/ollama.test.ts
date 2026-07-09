import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/adapters/models/retry.js", () => ({
  withRetry: vi.fn(),
  getDefaultConfig: vi.fn(() => ({ maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 15000, timeoutMs: 60000, providerName: "ollama" })),
  warnBatchCost: vi.fn(),
}));

import { createOllamaProvider } from "../../../src/adapters/models/ollama.js";

describe("createOllamaProvider", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("name is ollama", () => { expect(createOllamaProvider().name).toBe("ollama"); });
  it("accepts custom model name", () => { expect(createOllamaProvider("codellama").name).toBe("ollama"); });
});
