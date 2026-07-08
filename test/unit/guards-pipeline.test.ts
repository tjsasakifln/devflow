import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies
const mockExecSync = vi.hoisted(() => vi.fn());
const mockSafeReadFile = vi.hoisted(() => vi.fn());
const mockValidateRequirements = vi.hoisted(() => vi.fn());
const mockValidateRoadmap = vi.hoisted(() => vi.fn());
const mockRunConstitutionCheck = vi.hoisted(() => vi.fn());
const mockLoadConstitution = vi.hoisted(() => vi.fn());
const mockDetectStackProfile = vi.hoisted(() => vi.fn());
const mockConfigLoad = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({ execSync: mockExecSync }));
vi.mock("../src/kernel/utils/fs.js", () => ({ safeReadFile: mockSafeReadFile }));
vi.mock("../src/kernel/validators/structural.js", () => ({
  validateRequirements: mockValidateRequirements,
  validateRoadmap: mockValidateRoadmap,
}));
vi.mock("../src/kernel/constitution/checker.js", () => ({
  runConstitutionCheck: mockRunConstitutionCheck,
}));
vi.mock("../src/kernel/constitution/loader.js", () => ({
  loadConstitution: mockLoadConstitution,
}));
vi.mock("../src/kernel/detection/stack.js", () => ({
  detectStackProfile: mockDetectStackProfile,
}));
vi.mock("../src/kernel/config/index.js", () => ({
  ConfigManager: vi.fn().mockImplementation(() => ({
    load: mockConfigLoad,
  })),
}));

import { checkPipelineReadiness, checkPreActionGitGuard } from "../../src/kernel/guards/pipeline.js";

describe("checkPreActionGitGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when on feature branch and worktree is clean", () => {
    mockExecSync
      .mockReturnValueOnce("feature/my-feature\n") // branch
      .mockReturnValueOnce(""); // status

    const result = checkPreActionGitGuard("/fake/repo");
    expect(result.canProceed).toBe(true);
    expect(result.checks.find((c) => c.checkId === "not-on-main")!.passed).toBe(true);
    expect(result.checks.find((c) => c.checkId === "clean-worktree")!.passed).toBe(true);
  });

  it("blocks when on main branch", () => {
    mockExecSync
      .mockReturnValueOnce("main\n") // branch
      .mockReturnValueOnce(""); // status

    const result = checkPreActionGitGuard("/fake/repo");
    expect(result.canProceed).toBe(false);
    expect(result.checks.find((c) => c.checkId === "not-on-main")!.passed).toBe(false);
    expect(result.checks.find((c) => c.checkId === "not-on-main")!.blocking).toBe(true);
  });

  it("blocks when on master branch", () => {
    mockExecSync
      .mockReturnValueOnce("master\n")
      .mockReturnValueOnce("");

    const result = checkPreActionGitGuard("/fake/repo");
    expect(result.canProceed).toBe(false);
    expect(result.checks.find((c) => c.checkId === "not-on-main")!.passed).toBe(false);
  });

  it("blocks when worktree is dirty", () => {
    mockExecSync
      .mockReturnValueOnce("feature/my-feature\n")
      .mockReturnValueOnce(" M src/test.ts\n");

    const result = checkPreActionGitGuard("/fake/repo");
    expect(result.canProceed).toBe(false);
    expect(result.checks.find((c) => c.checkId === "clean-worktree")!.passed).toBe(false);
  });

  it("blocks when git is not available", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("git not found");
    });

    const result = checkPreActionGitGuard("/fake/repo");
    expect(result.canProceed).toBe(false);
    expect(result.checks.find((c) => c.checkId === "git-available")!.passed).toBe(false);
  });
});

describe("checkPipelineReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    mockConfigLoad.mockResolvedValue({
      deterministicGates: { typecheck: false, lint: false, ooMetrics: false },
      constitution: { blockingGates: false },
      implementerApproverSeparation: { enabled: false },
      ciIntegration: { enabled: false },
    });
    mockLoadConstitution.mockResolvedValue({ rules: [] });
    mockDetectStackProfile.mockResolvedValue({
      language: "typescript",
      packageManager: "npm",
      typeCheckCommand: "npx tsc --noEmit",
      lintCommand: "npx eslint src/",
      linter: "eslint",
      sourceDir: "src",
      testDir: "test",
      testFramework: "vitest",
      testCommand: "npx vitest run",
      typeChecker: "tsc",
      formatter: null,
      hasDocker: false,
      hasCI: false,
      ciProvider: null,
    });
    mockSafeReadFile.mockResolvedValue("");
  });

  it("returns blocking failed for missing requirements", async () => {
    const result = await checkPipelineReadiness({
      feature: {
        id: "test-feature",
        directory: "/tmp/feature",
        hasRequirements: false,
        hasClarification: false,
        hasQualityAudit: false,
        hasRoadmap: false,
        hasActions: false,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: false,
        hasRegressionWatch: false,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: false,
        requirementsDoubts: false,
        actionsCompletionRatio: 0,
        isActive: true,
      },
      rootPath: "/tmp/project",
      featureDir: "/tmp/feature",
    });

    expect(result.canProceed).toBe(false);
    expect(result.blockingFailed).toBeGreaterThan(0);
    // Gate 1: has-requirements should fail
    expect(result.checks.find((c) => c.checkId === "has-requirements")!.passed).toBe(false);
  });

  it("passes basic gates when feature has all artifacts and requirements exist", async () => {
    mockSafeReadFile.mockResolvedValue("## Test\nsome content\n");
    mockValidateRequirements.mockReturnValue({
      valid: true,
      missingSections: [],
      emptySections: [],
      errors: [],
      doubts: 0,
    });
    mockValidateRoadmap.mockReturnValue({
      valid: true,
      missingSections: [],
      emptySections: [],
      errors: [],
    });

    mockExecSync
      .mockReturnValueOnce("feature/branch\n")
      .mockReturnValueOnce("");

    const result = await checkPipelineReadiness({
      feature: {
        id: "test-feature",
        directory: "/tmp/feature",
        hasRequirements: true,
        hasClarification: false,
        hasQualityAudit: true,
        hasRoadmap: true,
        hasActions: true,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: true,
        hasRegressionWatch: true,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: true,
        requirementsDoubts: false,
        actionsCompletionRatio: 0.5,
        isActive: true,
      },
      rootPath: "/tmp/project",
      featureDir: "/tmp/feature",
    });

    // Has-requirements should pass
    expect(result.checks.find((c) => c.checkId === "has-requirements")!.passed).toBe(true);
    // No-doubts should pass
    expect(result.checks.find((c) => c.checkId === "no-doubts")!.passed).toBe(true);
    // Quality audit pass
    expect(result.checks.find((c) => c.checkId === "has-quality-audit")!.passed).toBe(true);
    // Roadmap pass
    expect(result.checks.find((c) => c.checkId === "has-roadmap")!.passed).toBe(true);
    // Actions pass
    expect(result.checks.find((c) => c.checkId === "has-actions")!.passed).toBe(true);
    // Legacy impact pass
    expect(result.checks.find((c) => c.checkId === "has-legacy-impact")!.passed).toBe(true);
    // Regression watch pass
    expect(result.checks.find((c) => c.checkId === "has-regression-watch")!.passed).toBe(true);
  });

  it("reports requirements doubts when doubts exist", async () => {
    const result = await checkPipelineReadiness({
      feature: {
        id: "test-feature",
        directory: "/tmp/feature",
        hasRequirements: true,
        hasClarification: false,
        hasQualityAudit: false,
        hasRoadmap: false,
        hasActions: false,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: false,
        hasRegressionWatch: false,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: false,
        requirementsDoubts: true,
        actionsCompletionRatio: 0,
        isActive: true,
      },
      rootPath: "/tmp/project",
      featureDir: "/tmp/feature",
    });

    const noDoubts = result.checks.find((c) => c.checkId === "no-doubts");
    expect(noDoubts!.passed).toBe(false);
    expect(noDoubts!.blocking).toBe(true);
  });

  it("handles missing testPlan gracefully", async () => {
    const result = await checkPipelineReadiness({
      feature: {
        id: "test-feature",
        directory: "/tmp/feature",
        hasRequirements: true,
        hasClarification: false,
        hasQualityAudit: true,
        hasRoadmap: true,
        hasActions: true,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: true,
        hasRegressionWatch: true,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: false,
        requirementsDoubts: false,
        actionsCompletionRatio: 0.5,
        isActive: true,
      },
      rootPath: "/tmp/project",
      featureDir: "/tmp/feature",
    });

    const testPlanGate = result.checks.find((c) => c.checkId === "has-test-plan");
    expect(testPlanGate!.passed).toBe(false);
  });

  it("returns requiredActions as list of remediations", async () => {
    const result = await checkPipelineReadiness({
      feature: {
        id: "test-feature",
        directory: "/tmp/feature",
        hasRequirements: false,
        hasClarification: false,
        hasQualityAudit: false,
        hasRoadmap: false,
        hasActions: false,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: false,
        hasRegressionWatch: false,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: false,
        requirementsDoubts: false,
        actionsCompletionRatio: 0,
        isActive: true,
      },
      rootPath: "/tmp/project",
      featureDir: "/tmp/feature",
    });

    expect(result.requiredActions.length).toBeGreaterThan(0);
    expect(result.refusalMessage).not.toBeNull();
    expect(result.refusalMessage).toContain("Blocked");
  });

  it("builds a refusal message with all failed checks", async () => {
    const result = await checkPipelineReadiness({
      feature: {
        id: "broken",
        directory: "/tmp/feature",
        hasRequirements: false,
        hasClarification: false,
        hasQualityAudit: false,
        hasRoadmap: false,
        hasActions: false,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: false,
        hasRegressionWatch: false,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: false,
        requirementsDoubts: false,
        actionsCompletionRatio: 0,
        isActive: true,
      },
      rootPath: "/tmp/project",
      featureDir: "/tmp/feature",
    });

    expect(result.refusalMessage).not.toBeNull();
    expect(result.refusalMessage).toContain("Blocked");
    expect(result.refusalMessage).toContain("Next Steps");
    expect(result.refusalMessage).toContain("Why This Matters");
  });
});
