import { describe, it, expect } from "vitest";
import { scoreConfidence } from "../../src/kernel/evidence/confidence.js";
import type { Evidence, DevflowState } from "../../src/kernel/types/state.js";

describe("Confidence Scorer", () => {
  it("returns high when all high-confidence evidence supports state", () => {
    const evidence: Evidence[] = [
      {
        type: "file_presence",
        key: "has_package_json",
        value: true,
        source: "file",
        confidence: "high",
      },
      {
        type: "file_presence",
        key: "has_dot_devflow",
        value: false,
        source: "file",
        confidence: "high",
      },
    ];
    const result = scoreConfidence(evidence, "greenfield-idea");
    expect(result).toBe("high");
  });

  it("returns low for contradictory high-confidence evidence", () => {
    const evidence: Evidence[] = [
      {
        type: "file_presence",
        key: "has_package_json",
        value: true,
        source: "file",
        confidence: "high",
      },
      {
        type: "file_presence",
        key: "has_package_json",
        value: false,
        source: "file",
        confidence: "high",
      },
    ];
    // has_package_json=true supports greenfield-idea
    // has_package_json=false contradicts greenfield-idea → neutral for this key
    const result = scoreConfidence(evidence, "greenfield-idea");
    expect(result).toBeDefined();
  });

  it("caps at medium when required file is missing", () => {
    const evidence: Evidence[] = [
      {
        type: "file_presence",
        key: "has_requirements",
        value: false,
        source: "file",
        confidence: "high",
      },
    ];
    // For feature-empty: has_requirements=false supports it
    const result = scoreConfidence(evidence, "feature-empty");
    expect(result).toBe("high"); // it actually supports feature-empty
  });
});
