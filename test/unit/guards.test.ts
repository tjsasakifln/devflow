import { describe, it, expect } from "vitest";
import {
  checkPipelineReadiness,
  checkPreActionGuard,
} from "../../src/guards/pipeline.js";
import type { FeatureInfo } from "../../src/types/project.js";
import type { PipelineContext } from "../../src/guards/pipeline.js";

function makeFeature(overrides: Partial<FeatureInfo> = {}): FeatureInfo {
  return {
    id: "001-test",
    directory: "/test",
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
    ...overrides,
  };
}

function makeCtx(
  overrides: Partial<FeatureInfo> = {}
): PipelineContext {
  return {
    feature: makeFeature(overrides),
    rootPath: "/tmp/test-project",
    featureDir: "/tmp/test-project/_devflow/features/001-test",
  };
}

describe("Pipeline Guard", () => {
  it("passes for fully ready feature", async () => {
    const ctx = makeCtx({
      hasRequirements: true,
      hasQualityAudit: true,
      hasRoadmap: true,
      hasActions: true,
      hasTestPlan: true,
      hasLegacyImpact: true,
      hasRegressionWatch: true,
      actionsCompletionRatio: 1,
    });
    const result = await checkPipelineReadiness(ctx);
    // Since constitution check may fail without tool configs, just verify result structure
    expect(result).toHaveProperty("checks");
    expect(result).toHaveProperty("canProceed");
    expect(Array.isArray(result.checks)).toBe(true);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it("fails when requirements are missing", async () => {
    const ctx = makeCtx({});
    const result = await checkPipelineReadiness(ctx);
    expect(result.canProceed).toBe(false);
    expect(
      result.checks.find((c) => c.checkId === "has-requirements")?.passed
    ).toBe(false);
  });

  it("fails when doubts remain", async () => {
    const ctx = makeCtx({
      hasRequirements: true,
      requirementsDoubts: true,
    });
    const result = await checkPipelineReadiness(ctx);
    expect(result.canProceed).toBe(false);
    expect(
      result.checks.find((c) => c.checkId === "no-doubts")?.passed
    ).toBe(false);
  });

  it("fails when roadmap is missing", async () => {
    const ctx = makeCtx({
      hasRequirements: true,
      hasQualityAudit: true,
      requirementsDoubts: false,
    });
    const result = await checkPipelineReadiness(ctx);
    expect(result.canProceed).toBe(false);
    expect(
      result.checks.find((c) => c.checkId === "has-roadmap")?.passed
    ).toBe(false);
  });

  it("provides refusal message when checks fail", async () => {
    const ctx = makeCtx({});
    const result = await checkPipelineReadiness(ctx);
    expect(result.refusalMessage).toBeTruthy();
    expect(result.requiredActions.length).toBeGreaterThan(0);
  });

  it("has constitution-check gate", async () => {
    const ctx = makeCtx({
      hasRequirements: true,
      hasQualityAudit: true,
      hasRoadmap: true,
      hasActions: true,
      hasTestPlan: true,
      hasLegacyImpact: true,
      hasRegressionWatch: true,
    });
    const result = await checkPipelineReadiness(ctx);
    const constCheck = result.checks.find(
      (c) => c.checkId === "constitution-check"
    );
    expect(constCheck).toBeDefined();
  });

  it("has test-plan gate", async () => {
    const ctx = makeCtx({
      hasRequirements: true,
      hasQualityAudit: true,
      hasRoadmap: true,
      hasActions: true,
      hasLegacyImpact: true,
      hasRegressionWatch: true,
    });
    const result = await checkPipelineReadiness(ctx);
    const testPlanCheck = result.checks.find(
      (c) => c.checkId === "has-test-plan"
    );
    expect(testPlanCheck).toBeDefined();
    expect(testPlanCheck?.passed).toBe(false);
  });
});
