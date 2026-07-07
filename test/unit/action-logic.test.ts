import { describe, it, expect } from "vitest";
import { failOnSeverity, severityBlocks, computeVerdict, buildSeverityMatrix, createRisk } from "../../src/core/policy-engine.js";
import type { Risk } from "../../src/core/report-model.js";

function makeRisks(severities: Array<Risk["severity"]>): Risk[] {
  return severities.map((s, i) => createRisk(s, "security", `Risk ${i}`, "Fix it", "moderate"));
}

describe("failOnSeverity", () => {
  it("should return true when CRITICAL threshold has CRITICAL risk", () => {
    const risks = makeRisks(["CRITICAL"]);
    expect(failOnSeverity("CRITICAL", risks)).toBe(true);
  });

  it("should return false when CRITICAL threshold has only MEDIUM risk", () => {
    const risks = makeRisks(["MEDIUM"]);
    expect(failOnSeverity("CRITICAL", risks)).toBe(false);
  });

  it("should return true when HIGH threshold has HIGH risk", () => {
    const risks = makeRisks(["HIGH"]);
    expect(failOnSeverity("HIGH", risks)).toBe(true);
  });

  it("should return true when HIGH threshold has CRITICAL risk", () => {
    const risks = makeRisks(["CRITICAL"]);
    expect(failOnSeverity("HIGH", risks)).toBe(true);
  });

  it("should return false when HIGH threshold has only MEDIUM risk", () => {
    const risks = makeRisks(["MEDIUM"]);
    expect(failOnSeverity("HIGH", risks)).toBe(false);
  });

  it("should return true when MEDIUM threshold has MEDIUM risk", () => {
    const risks = makeRisks(["MEDIUM"]);
    expect(failOnSeverity("MEDIUM", risks)).toBe(true);
  });

  it("should return true when MEDIUM threshold has HIGH risk", () => {
    const risks = makeRisks(["HIGH"]);
    expect(failOnSeverity("MEDIUM", risks)).toBe(true);
  });

  it("should return false when MEDIUM threshold has only LOW risk", () => {
    const risks = makeRisks(["LOW"]);
    expect(failOnSeverity("MEDIUM", risks)).toBe(false);
  });

  it("should return false for never threshold regardless of risks", () => {
    const risks = makeRisks(["CRITICAL", "HIGH", "MEDIUM"]);
    expect(failOnSeverity("never", risks)).toBe(false);
  });

  it("should return true when LOW threshold has LOW risk", () => {
    const risks = makeRisks(["LOW"]);
    expect(failOnSeverity("LOW", risks)).toBe(true);
  });

  it("should return false for empty risks at any threshold", () => {
    expect(failOnSeverity("CRITICAL", [])).toBe(false);
    expect(failOnSeverity("HIGH", [])).toBe(false);
    expect(failOnSeverity("MEDIUM", [])).toBe(false);
    expect(failOnSeverity("LOW", [])).toBe(false);
    expect(failOnSeverity("never", [])).toBe(false);
  });
});

describe("severityBlocks", () => {
  it("CRITICAL always blocks", () => {
    expect(severityBlocks("CRITICAL", "relaxed")).toBe(true);
    expect(severityBlocks("CRITICAL", "moderate")).toBe(true);
    expect(severityBlocks("CRITICAL", "strict")).toBe(true);
  });

  it("HIGH blocks at moderate and strict", () => {
    expect(severityBlocks("HIGH", "relaxed")).toBe(false);
    expect(severityBlocks("HIGH", "moderate")).toBe(true);
    expect(severityBlocks("HIGH", "strict")).toBe(true);
  });

  it("MEDIUM blocks only at strict", () => {
    expect(severityBlocks("MEDIUM", "relaxed")).toBe(false);
    expect(severityBlocks("MEDIUM", "moderate")).toBe(false);
    expect(severityBlocks("MEDIUM", "strict")).toBe(true);
  });

  it("LOW never blocks", () => {
    expect(severityBlocks("LOW", "relaxed")).toBe(false);
    expect(severityBlocks("LOW", "moderate")).toBe(false);
    expect(severityBlocks("LOW", "strict")).toBe(false);
  });
});

describe("computeVerdict", () => {
  it("BLOCKED with 3+ blocking risks", () => {
    const risks = [
      createRisk("CRITICAL", "security", "R1", "fix", "moderate"),
      createRisk("CRITICAL", "security", "R2", "fix", "moderate"),
      createRisk("HIGH", "security", "R3", "fix", "moderate"),
    ];
    const result = computeVerdict(risks, { riskTolerance: "moderate", executionMode: "local" });
    expect(result.verdict).toBe("BLOCKED");
  });

  it("PASS with no risks", () => {
    const result = computeVerdict([], { riskTolerance: "moderate", executionMode: "local" });
    expect(result.verdict).toBe("PASS");
  });

  it("WARN with non-blocking risks >= 3", () => {
    const risks = [
      createRisk("LOW", "governance", "R1", "fix", "moderate"),
      createRisk("LOW", "governance", "R2", "fix", "moderate"),
      createRisk("LOW", "governance", "R3", "fix", "moderate"),
    ];
    const result = computeVerdict(risks, { riskTolerance: "moderate", executionMode: "local" });
    expect(result.verdict).toBe("WARN");
  });

  it("FAIL with 1 blocking risk", () => {
    const risks = [createRisk("CRITICAL", "security", "Critical vuln", "fix", "moderate")];
    const result = computeVerdict(risks, { riskTolerance: "moderate", executionMode: "local" });
    expect(result.verdict).toBe("FAIL");
  });

  it("PASS with 1-2 non-blocking risks", () => {
    const risks = [
      createRisk("LOW", "governance", "R1", "fix", "moderate"),
    ];
    const result = computeVerdict(risks, { riskTolerance: "moderate", executionMode: "local" });
    expect(result.verdict).toBe("PASS");
  });

  it("BLOCKED with mixed blocking and non-blocking risks", () => {
    const risks = [
      createRisk("CRITICAL", "security", "R1", "fix", "moderate"),
      createRisk("CRITICAL", "security", "R2", "fix", "moderate"),
      createRisk("CRITICAL", "security", "R3", "fix", "moderate"),
      createRisk("LOW", "governance", "R4", "fix", "moderate"),
    ];
    const result = computeVerdict(risks, { riskTolerance: "moderate", executionMode: "local" });
    expect(result.verdict).toBe("BLOCKED");
  });

  it("BLOCKED with 3 CRITICAL at relaxed tolerance", () => {
    const risks = [
      createRisk("CRITICAL", "security", "R1", "fix", "relaxed"),
      createRisk("CRITICAL", "security", "R2", "fix", "relaxed"),
      createRisk("CRITICAL", "security", "R3", "fix", "relaxed"),
    ];
    const result = computeVerdict(risks, { riskTolerance: "relaxed", executionMode: "local" });
    expect(result.verdict).toBe("BLOCKED");
  });

  it("should include reason in result", () => {
    const risks = [createRisk("CRITICAL", "security", "Critical vuln", "fix", "moderate")];
    const result = computeVerdict(risks, { riskTolerance: "moderate", executionMode: "local" });
    expect(result.reason).toBeDefined();
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.reason).toContain("Critical vuln");
  });
});

describe("buildSeverityMatrix", () => {
  it("counts correctly", () => {
    const risks = makeRisks(["CRITICAL", "HIGH", "HIGH", "MEDIUM", "LOW", "LOW", "LOW"]);
    const matrix = buildSeverityMatrix(risks);
    expect(matrix.critical).toBe(1);
    expect(matrix.high).toBe(2);
    expect(matrix.medium).toBe(1);
    expect(matrix.low).toBe(3);
  });

  it("returns all zeros for empty risks", () => {
    const matrix = buildSeverityMatrix([]);
    expect(matrix.critical).toBe(0);
    expect(matrix.high).toBe(0);
    expect(matrix.medium).toBe(0);
    expect(matrix.low).toBe(0);
  });

  it("handles single risk", () => {
    const risks = makeRisks(["CRITICAL"]);
    const matrix = buildSeverityMatrix(risks);
    expect(matrix.critical).toBe(1);
    expect(matrix.high).toBe(0);
    expect(matrix.medium).toBe(0);
    expect(matrix.low).toBe(0);
  });
});
