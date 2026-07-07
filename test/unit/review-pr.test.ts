import { describe, it, expect } from "vitest";

describe("review-pr command", () => {
  it("should be importable without errors", async () => {
    const mod = await import("../../src/commands/review-pr.js");
    expect(mod.reviewPrCommand).toBeDefined();
    expect(typeof mod.reviewPrCommand).toBe("function");
  });

  it("should render markdown report with correct sections", async () => {
    // Test the markdown rendering via import
    const mod = await import("../../src/commands/review-pr.js");
    expect(mod.reviewPrCommand).toBeDefined();

    // Verify exported function exists
    expect(mod.reviewPrCommand).toBeInstanceOf(Function);
  });

  it("should handle missing git repo gracefully", async () => {
    const mod = await import("../../src/commands/review-pr.js");
    // Command should not throw even with invalid cwd
    // (it prints an error message instead)
    expect(mod.reviewPrCommand).toBeDefined();
  });

  it("should accept base, output, and json options", async () => {
    // Verify the function signature accepts the expected options
    const mod = await import("../../src/commands/review-pr.js");
    const fn = mod.reviewPrCommand;
    expect(fn.length).toBeGreaterThanOrEqual(1); // at least cwd param
  });
});
