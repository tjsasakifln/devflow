import { describe, it, expect } from "vitest";
import { checkPipelineReadiness } from "../../src/guards/pipeline.js";
import type { FeatureInfo } from "../../src/types/project.js";

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
    requirementsDoubts: false,
    actionsCompletionRatio: 0,
    isActive: true,
    ...overrides,
  };
}

describe("Pipeline Guard", () => {
  it("passes for fully ready feature", () => {
    const feature = makeFeature({
      hasRequirements: true,
      hasQualityAudit: true,
      hasRoadmap: true,
      hasActions: true,
      hasLegacyImpact: true,
      hasRegressionWatch: true,
      actionsCompletionRatio: 1,
    });
    const result = checkPipelineReadiness(feature);
    expect(result.canProceed).toBe(true);
  });

  it("fails when requirements are missing", () => {
    const feature = makeFeature({});
    const result = checkPipelineReadiness(feature);
    expect(result.canProceed).toBe(false);
    expect(
      result.checks.find((c) => c.checkId === "has-requirements")?.passed
    ).toBe(false);
  });

  it("fails when doubts remain", () => {
    const feature = makeFeature({
      hasRequirements: true,
      requirementsDoubts: true,
    });
    const result = checkPipelineReadiness(feature);
    expect(result.canProceed).toBe(false);
    expect(
      result.checks.find((c) => c.checkId === "no-doubts")?.passed
    ).toBe(false);
  });

  it("fails when roadmap is missing", () => {
    const feature = makeFeature({
      hasRequirements: true,
      hasQualityAudit: true,
      requirementsDoubts: false,
    });
    const result = checkPipelineReadiness(feature);
    expect(result.canProceed).toBe(false);
    expect(
      result.checks.find((c) => c.checkId === "has-roadmap")?.passed
    ).toBe(false);
  });

  it("provides refusal message when checks fail", () => {
    const feature = makeFeature({});
    const result = checkPipelineReadiness(feature);
    expect(result.refusalMessage).toBeTruthy();
    expect(result.requiredActions.length).toBeGreaterThan(0);
  });
});
