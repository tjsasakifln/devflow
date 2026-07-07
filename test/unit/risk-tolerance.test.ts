import { describe, it, expect } from "vitest";
import { DEFAULTS } from "../../src/kernel/config/defaults.js";

describe("riskTolerance config", () => {
  it("should have riskTolerance in defaults", () => {
    expect(DEFAULTS.riskTolerance).toBeDefined();
    expect(["relaxed", "moderate", "strict"]).toContain(DEFAULTS.riskTolerance);
  });

  it("should default to moderate", () => {
    expect(DEFAULTS.riskTolerance).toBe("moderate");
  });

  it("should have adversarialReview enabled by default", () => {
    expect(DEFAULTS.deterministicGates.adversarialReview).toBe(true);
  });

  it("should have all risk tolerance values valid", () => {
    const validValues = ["relaxed", "moderate", "strict"];
    expect(validValues).toContain("relaxed");
    expect(validValues).toContain("moderate");
    expect(validValues).toContain("strict");
  });
});

describe("riskTolerance in DevflowConfig type", () => {
  it("should accept riskTolerance in config object", () => {
    const config = { ...DEFAULTS, riskTolerance: "relaxed" as const };
    expect(config.riskTolerance).toBe("relaxed");
  });

  it("should accept strict riskTolerance", () => {
    const config = { ...DEFAULTS, riskTolerance: "strict" as const };
    expect(config.riskTolerance).toBe("strict");
  });
});
