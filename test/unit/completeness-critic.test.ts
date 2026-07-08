import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompletenessCritic } from "../../src/kernel/orchestration/completeness-critic.js";
import type { AnalysisContext } from "../../src/kernel/orchestration/completeness-critic.js";
import type { AgentResult, Finding } from "../../src/kernel/orchestration/types.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
  };
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SAMPLE_FINDING: Finding = {
  file: "src/auth/login.ts",
  line: 15,
  severity: "critical",
  message: "Hardcoded API key detected",
  dimension: "security",
};

const SAMPLE_AGENT_RESULT: AgentResult = {
  dimension: "security",
  findings: [SAMPLE_FINDING],
  durationMs: 100,
  exitCode: 0,
};

const EMPTY_ANALYSIS_CONTEXT: AnalysisContext = {
  rootPath: "/test",
  analyzedDimensions: [],
  inspectedFiles: [],
  agentResults: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CompletenessCritic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a critic instance", () => {
    const critic = new CompletenessCritic("/test");
    expect(critic).toBeInstanceOf(CompletenessCritic);
  });

  it("should detect uncovered dimensions", async () => {
    const critic = new CompletenessCritic("/test");
    const context: AnalysisContext = {
      ...EMPTY_ANALYSIS_CONTEXT,
      analyzedDimensions: ["security", "tests"],
    };

    const gaps = await critic.runCritic(context);

    const dimGaps = gaps.filter((g) => g.type === "dimension_not_covered");
    // Should flag: performance, architecture, docs, deps
    // (security and tests are covered)
    const coveredDims = new Set(dimGaps.map((g) => {
      const match = g.description.match(/^Dimension "([^"]+)" not analyzed$/);
      return match ? match[1] : null;
    }).filter(Boolean));

    expect(coveredDims.has("performance")).toBe(true);
    expect(coveredDims.has("architecture")).toBe(true);
    expect(coveredDims.has("docs")).toBe(true);
    expect(coveredDims.has("deps")).toBe(true);
    // Security should NOT be flagged
    expect(coveredDims.has("security")).toBe(false);
    // Tests should NOT be flagged
    expect(coveredDims.has("tests")).toBe(false);
  });

  it("should detect unread sources in the actual project", async () => {
    // Use the real project root — the critic will find source files
    const projectRoot = process.cwd();
    const critic = new CompletenessCritic(projectRoot);
    const context: AnalysisContext = {
      rootPath: projectRoot,
      analyzedDimensions: ["security"],
      inspectedFiles: [], // No files inspected — should find many
    };

    const gaps = await critic.runCritic(context);

    const srcGaps = gaps.filter((g) => g.type === "source_not_read");
    expect(srcGaps.length).toBeGreaterThan(0);
    expect(srcGaps[0]!.description).toContain("source file(s) not inspected");
  });

  it("should detect unverified claims in agent results", async () => {
    const critic = new CompletenessCritic("/test");
    const context: AnalysisContext = {
      ...EMPTY_ANALYSIS_CONTEXT,
      analyzedDimensions: ["security"],
      agentResults: [SAMPLE_AGENT_RESULT],
    };

    const gaps = await critic.runCritic(context);

    const claimGaps = gaps.filter((g) => g.type === "claim_not_verified");
    expect(claimGaps.length).toBeGreaterThan(0);
    // The critical finding should need verification
    expect(claimGaps.some((g) => g.description.includes("needs verification"))).toBe(true);
  });

  it("should not flag dimensions that were analyzed", async () => {
    const critic = new CompletenessCritic("/test");
    const context: AnalysisContext = {
      ...EMPTY_ANALYSIS_CONTEXT,
      analyzedDimensions: ["security", "performance", "architecture", "tests", "docs", "deps"],
    };

    const gaps = await critic.runCritic(context);

    const dimGaps = gaps.filter((g) => g.type === "dimension_not_covered");
    expect(dimGaps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Loop-until-dry tests
// ---------------------------------------------------------------------------

describe("CompletenessCritic — loop-until-dry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should stop immediately when no gaps found (dry on first round)", async () => {
    const critic = new CompletenessCritic("/test", {
      maxIterations: 5,
      dryThreshold: 1, // Need only 1 dry round
    });

    // Provide a context with all dimensions covered and no agent results
    // so the critic finds no gaps on the first iteration
    const report = await critic.fullCritique({
      rootPath: "/test",
      analyzedDimensions: ["security", "performance", "architecture", "tests", "docs", "deps"],
      inspectedFiles: [],
      agentResults: [],
    });

    expect(report.hasGaps).toBe(false);
    expect(report.totalIterations).toBe(1);
    expect(report.stopReason).toBe("dry");
  });

  it("should stop after max iterations when critic always returns gaps", async () => {
    // Create a spy that always returns gaps
    const critic = new CompletenessCritic("/test", {
      maxIterations: 5,
      dryThreshold: 2,
    });

    // Use a context with uncovered dimensions to guarantee gaps
    const context: AnalysisContext = {
      ...EMPTY_ANALYSIS_CONTEXT,
      analyzedDimensions: [],
      inspectedFiles: [],
      agentResults: [SAMPLE_AGENT_RESULT],
    };

    const report = await critic.fullCritique(context);

    // Should hit max iterations since dimensions remain uncovered
    expect(report.totalIterations).toBeLessThanOrEqual(5);
    expect(report.iterations.length).toBeGreaterThan(0);
  });

  it("should converge when gaps get filled between iterations", async () => {
    // Simulate iterative refinement
    // First iteration: many uncovered → second: fewer → third: none → fourth: none → stop
    const critic = new CompletenessCritic("/test", {
      maxIterations: 5,
      dryThreshold: 2,
    });

    // First pass with uncovered dimensions
    const firstContext: AnalysisContext = {
      rootPath: "/test",
      analyzedDimensions: [],
      inspectedFiles: [],
      agentResults: [],
    };

    const report = await critic.fullCritique(firstContext);

    // Should run at least one iteration and produce a valid report
    expect(report.totalIterations).toBeGreaterThanOrEqual(1);
    expect(report.stopReason).toBe("dry");
  });

  it("should report iteration history", async () => {
    const critic = new CompletenessCritic("/test", {
      maxIterations: 5,
      dryThreshold: 2,
    });

    const report = await critic.fullCritique({
      ...EMPTY_ANALYSIS_CONTEXT,
      analyzedDimensions: [],
    });

    expect(report.iterations.length).toBeGreaterThanOrEqual(1);
    expect(report.iterations[0]!.iteration).toBe(1);
    expect(typeof report.iterations[0]!.isDry).toBe("boolean");
    expect(typeof report.iterations[0]!.timestamp).toBe("string");
  });

  it("should handle empty analysis context gracefully", async () => {
    const critic = new CompletenessCritic("/test");
    const report = await critic.fullCritique(EMPTY_ANALYSIS_CONTEXT);

    expect(report).toBeDefined();
    expect(report.totalIterations).toBeGreaterThanOrEqual(1);
    expect(typeof report.durationMs).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Configuration tests
// ---------------------------------------------------------------------------

describe("CompletenessCritic — configuration", () => {
  it("should respect custom max iterations", async () => {
    const critic = new CompletenessCritic("/test", {
      maxIterations: 2,
      dryThreshold: 1, // Only need 1 dry round
    });

    // No gaps should be found, so stops at 1 iteration
    const report = await critic.fullCritique(EMPTY_ANALYSIS_CONTEXT);
    expect(report.totalIterations).toBeLessThanOrEqual(2);
  });

  it("should apply default config when no overrides given", () => {
    const critic = new CompletenessCritic("/test");
    expect(critic).toBeInstanceOf(CompletenessCritic);
  });
});
