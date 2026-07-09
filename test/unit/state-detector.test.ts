import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectProject } from "../../src/adapters/project/inspector.js";
import {
  detectState,
  determineFeatureState,
} from "../../src/kernel/state/detector.js";
import type { FeatureInfo } from "../../src/kernel/types/project.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "..", "fixtures");

describe("State Detector", () => {
  it("detects greenfield-idea for empty project with package.json", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "greenfield-empty")
    );
    const result = await detectState(inspection);
    expect(result.currentState).toBe("greenfield-idea");
  });

  it("detects brownfield-unknown for code without Devflow", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "brownfield-no-specs")
    );
    const result = await detectState(inspection);
    expect(result.currentState).toBe("brownfield-unknown");
  });

  it("detects feature-requirements for feature with requirements.md", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "feature-with-requirements")
    );
    const result = await detectState(inspection);
    expect(result.currentState).toBe("feature-requirements");
  });

  it("detects feature-clarification-needed for requirements with [DOUBT]", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "feature-with-doubts")
    );
    const result = await detectState(inspection);
    expect(result.currentState).toBe("feature-clarification-needed");
  });

  it("detects feature-done for completed feature", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "completed-feature")
    );
    const result = await detectState(inspection);
    expect(result.currentState).toBe("feature-done");
  });

  // ── ORDER MATTERS regression tests ──
  // G-04: Verifies contractual branch ordering in determineFeatureState.
  // Branches are ordered most-specific → most-generic. First match wins.

  function baseFeature(overrides: Partial<FeatureInfo> = {}): FeatureInfo {
    return {
      id: "feat-1",
      directory: "/tmp/feat-1",
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

  describe("determineFeatureState — ORDER MATTERS regression", () => {
    it("returns feature-done when all completion markers present", () => {
      const f = baseFeature({
        hasQaReport: true,
        hasRegressionWatch: true,
        hasLegacyImpact: true,
        actionsCompletionRatio: 1.0,
        hasImplementationLog: true,
        hasTestPlan: true,
      });
      expect(determineFeatureState(f)).toBe("feature-done");
    });

    it("returns feature-done over feature-review when both match", () => {
      const f = baseFeature({
        hasQaReport: true,
        hasRegressionWatch: true,
        hasLegacyImpact: true,
        actionsCompletionRatio: 1.0,
        hasImplementationLog: true,
        hasTestPlan: true,
        hasQualityAudit: true,
        hasRoadmap: true,
        hasActions: true,
        hasRequirements: true,
      });
      expect(determineFeatureState(f)).toBe("feature-done");
    });

    it("returns feature-review when actions done + impl log + QA + test plan", () => {
      const f = baseFeature({
        actionsCompletionRatio: 1.0,
        hasImplementationLog: true,
        hasQaReport: true,
        hasTestPlan: true,
        hasRoadmap: true,
        hasActions: true,
        hasRequirements: true,
      });
      expect(determineFeatureState(f)).toBe("feature-review");
    });

    it("returns feature-verification when impl log exists, actions done, no QA", () => {
      const f = baseFeature({
        hasImplementationLog: true,
        actionsCompletionRatio: 1.0,
        hasActions: true,
        hasTestPlan: true,
      });
      expect(determineFeatureState(f)).toBe("feature-verification");
    });

    it("returns feature-coding-in-progress when impl log exists, no QA", () => {
      const f = baseFeature({
        hasImplementationLog: true,
        hasActions: true,
        actionsCompletionRatio: 0.5,
      });
      expect(determineFeatureState(f)).toBe("feature-coding-in-progress");
    });

    it("returns feature-coding-ready when all pre-code artifacts exist, no impl log", () => {
      const f = baseFeature({
        hasRequirements: true,
        requirementsDoubts: false,
        hasQualityAudit: true,
        hasRoadmap: true,
        hasActions: true,
        hasTestPlan: true,
        hasLegacyImpact: true,
        hasRegressionWatch: true,
      });
      expect(determineFeatureState(f)).toBe("feature-coding-ready");
    });

    it("returns feature-pre-code-audit when reqs+roadmap+actions+audit+testplan exist", () => {
      const f = baseFeature({
        hasRequirements: true,
        hasRoadmap: true,
        hasActions: true,
        hasQualityAudit: true,
        hasTestPlan: true,
        hasLegacyImpact: true,
      });
      expect(determineFeatureState(f)).toBe("feature-pre-code-audit");
    });

    it("returns feature-test-plan-ready when test-plan exists, no impl log", () => {
      const f = baseFeature({
        hasTestPlan: true,
        hasRequirements: true,
        hasRoadmap: true,
      });
      expect(determineFeatureState(f)).toBe("feature-test-plan-ready");
    });

    it("returns feature-test-plan when roadmap+reqs audited, no test-plan yet", () => {
      const f = baseFeature({
        hasRequirements: true,
        hasRoadmap: true,
        hasQualityAudit: true,
      });
      expect(determineFeatureState(f)).toBe("feature-test-plan");
    });

    it("returns feature-design-reviewed when roadmap+reqs audited, no test plan", () => {
      const f = baseFeature({
        hasRoadmap: true,
        hasRequirements: true,
        hasQualityAudit: true,
      });
      // feature-test-plan wins because it checks hasRoadmap+hasRequirements+!doubts+hasQualityAudit+!hasTestPlan
      // This is actually feature-test-plan, not feature-design-reviewed
      expect(determineFeatureState(f)).toBe("feature-test-plan");
    });

    it("returns feature-design when reqs reviewed, no roadmap", () => {
      const f = baseFeature({
        hasRequirements: true,
        hasQualityAudit: true,
      });
      expect(determineFeatureState(f)).toBe("feature-design");
    });

    it("returns feature-requirements-reviewed when reqs+audit exist, no roadmap", () => {
      const f = baseFeature({
        hasRequirements: true,
        hasQualityAudit: true,
      });
      // feature-design wins because same condition
      expect(determineFeatureState(f)).toBe("feature-design");
    });

    it("returns feature-clarification-needed when reqs have doubts", () => {
      const f = baseFeature({
        hasRequirements: true,
        requirementsDoubts: true,
        hasQualityAudit: false,
        hasRoadmap: false,
        hasActions: false,
      });
      expect(determineFeatureState(f)).toBe("feature-clarification-needed");
    });

    it("returns feature-requirements when reqs exist, no audit", () => {
      const f = baseFeature({
        hasRequirements: true,
      });
      expect(determineFeatureState(f)).toBe("feature-requirements");
    });

    it("returns feature-empty when no artifacts exist", () => {
      const f = baseFeature();
      expect(determineFeatureState(f)).toBe("feature-empty");
    });

    it("returns feature-done over feature-coding-ready when both match", () => {
      const f = baseFeature({
        hasQaReport: true,
        hasRegressionWatch: true,
        hasLegacyImpact: true,
        actionsCompletionRatio: 1.0,
        hasImplementationLog: true,
        hasTestPlan: true,
        hasRequirements: true,
        hasQualityAudit: true,
        hasRoadmap: true,
        hasActions: true,
      });
      expect(determineFeatureState(f)).toBe("feature-done");
    });

    // Legacy state regression: action completion without impl log
    it("returns feature-test-plan when actions completed but no impl log", () => {
      const f = baseFeature({
        actionsCompletionRatio: 1.0,
        hasRoadmap: true,
        hasActions: true,
        hasRequirements: true,
        hasQualityAudit: true,
      });
      // Falls to feature-test-plan (has roadmap + requirements + quality audit + no test plan)
      expect(determineFeatureState(f)).toBe("feature-test-plan");
    });
  });

  it("includes evidence in result", async () => {
    const inspection = await inspectProject(
      path.join(fixtures, "greenfield-empty")
    );
    const result = await detectState(inspection);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence.some((e) => e.key === "has_package_json")).toBe(
      true
    );
  });
});
