import { describe, it, expect } from "vitest";
import type { DevflowModelProvider, ModelOptions, ModelResponse, ModelProviderId } from "../../../src/adapters/models/index.js";

describe("ModelProviderId", () => {
  it("should be a union of known provider ids", () => {
    const ids: ModelProviderId[] = ["openai", "anthropic", "ollama", "openrouter", "google"];
    expect(ids).toHaveLength(5);
  });
});

describe("DevflowModelProvider", () => {
  it("requires name and invoke", () => {
    const p: DevflowModelProvider = { name: "test", invoke: async () => ({ content: "ok" }) };
    expect(p.name).toBe("test");
  });
  it("may implement stream", () => {
    const p: DevflowModelProvider = { name: "s", async invoke() { return { content: "x" }; }, async *stream() { yield "a"; } };
    expect(p.stream).toBeInstanceOf(Function);
  });
});

describe("ModelOptions", () => {
  it("should allow partial fields", () => {
    const o: ModelOptions = { temperature: 0.5 };
    expect(o.temperature).toBe(0.5);
  });
});

describe("ModelResponse", () => {
  it("should work with only content", () => {
    const r: ModelResponse = { content: "hello" };
    expect(r.content).toBe("hello");
  });
});
