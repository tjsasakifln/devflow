import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectProject } from "../../src/project/inspector.js";
import { detectState, determineFeatureState } from "../../src/engine/state-detector.js";
import type { FeatureInfo } from "../../src/types/project.js";

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
  // Reordering breaks state detection silently.

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
        hasImplementationLog: true, // also matches coding-in-progress, but done is more specific
      });
      expect(determineFeatureState(f)).toBe("feature-done");
    });

    it("returns feature-done over feature-validation when both match", () => {
      // feature-done checked first → must win even when feature-validation also matches
      const f = baseFeature({
        hasQaReport: true,
        hasRegressionWatch: true,
        hasLegacyImpact: true,
        actionsCompletionRatio: 1.0,
        hasImplementationLog: true,
        hasQualityAudit: true,
        hasRoadmap: true,
        hasActions: true,
        hasRequirements: true,
      });
      expect(determineFeatureState(f)).toBe("feature-done");
    });

    it("returns feature-validation when actions done but no QA report", () => {
      const f = baseFeature({
        actionsCompletionRatio: 1.0,
        hasRoadmap: true,
        hasActions: true,
        hasRequirements: true,
      });
      expect(determineFeatureState(f)).toBe("feature-validation");
    });

    it("returns feature-coding-in-progress when impl log exists, no QA", () => {
      const f = baseFeature({
        hasImplementationLog: true,
        hasActions: true,
      });
      expect(determineFeatureState(f)).toBe("feature-coding-in-progress");
    });

    it("returns feature-coding-in-progress over feature-todo when both match", () => {
      // impl log + actions partial → coding-in-progress, not todo
      const f = baseFeature({
        hasImplementationLog: true,
        hasActions: true,
        actionsCompletionRatio: 0.5,
        hasRequirements: true,
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
        hasLegacyImpact: true,
        hasRegressionWatch: true,
      });
      expect(determineFeatureState(f)).toBe("feature-coding-ready");
    });

    it("returns feature-pre-code-audit when reqs+roadmap+actions+audit exist", () => {
      const f = baseFeature({
        hasRequirements: true,
        hasRoadmap: true,
        hasActions: true,
        hasQualityAudit: true,
        hasLegacyImpact: true, // extra — should not change result
      });
      expect(determineFeatureState(f)).toBe("feature-pre-code-audit");
    });

    it("returns feature-pre-code-audit over feature-requirements when both match", () => {
      // has quality audit → pre-code-audit, not feature-requirements
      const f = baseFeature({
        hasRequirements: true,
        hasRoadmap: true,
        hasActions: true,
        hasQualityAudit: true,
      });
      expect(determineFeatureState(f)).toBe("feature-pre-code-audit");
    });

    it("returns feature-todo when actions have partial completion", () => {
      const f = baseFeature({
        hasActions: true,
        actionsCompletionRatio: 0.5,
      });
      expect(determineFeatureState(f)).toBe("feature-todo");
    });

    it("returns feature-planned when actions exist with 0 completion", () => {
      const f = baseFeature({
        hasActions: true,
        actionsCompletionRatio: 0,
      });
      expect(determineFeatureState(f)).toBe("feature-planned");
    });

    it("returns feature-planning when roadmap exists, no actions", () => {
      const f = baseFeature({
        hasRoadmap: true,
      });
      expect(determineFeatureState(f)).toBe("feature-planning");
    });

    it("returns feature-requirements-audited when reqs audited, no roadmap", () => {
      const f = baseFeature({
        hasRequirements: true,
        hasQualityAudit: true,
      });
      expect(determineFeatureState(f)).toBe("feature-requirements-audited");
    });

    it("returns feature-clarification-needed when reqs have doubts (no roadmap)", () => {
      // ORDER MATTERS: feature-planning (roadmap, no actions) is checked before
      // feature-clarification-needed. To reach this state, must not have roadmap.
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

    it("returns feature-done over feature-coding-ready when completion+implLog both present", () => {
      // Most critical ORDER MATTERS test: feature-done is most specific,
      // feature-coding-ready checks !hasImplementationLog.
      // If ordering were reversed, a done feature with implLog would misdetect.
      const f = baseFeature({
        hasQaReport: true,
        hasRegressionWatch: true,
        hasLegacyImpact: true,
        actionsCompletionRatio: 1.0,
        hasImplementationLog: true,
        hasRequirements: true,
        hasQualityAudit: true,
        hasRoadmap: true,
        hasActions: true,
      });
      expect(determineFeatureState(f)).toBe("feature-done");
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
