import { describe, it, expect } from "vitest";
import { computeRecommendation } from "../../src/engine/next-action.js";
import type { StateDetectionResult } from "../../src/types/state.js";
import type { ProjectInspection } from "../../src/types/project.js";

function makeStateResult(
  state: StateDetectionResult["currentState"]
): StateDetectionResult {
  return {
    currentState: state,
    confidence: "high",
    evidence: [],
    knownFacts: [],
    assumptions: [],
    blockers: [],
    previousState: null,
    stateTimestamp: new Date().toISOString(),
  };
}

const mockInspection = {
  rootPath: "/test",
  hasGit: true,
  hasRemote: false,
  currentBranch: "main",
  packageManager: "npm",
  hasPackageJson: true,
  hasSrcDir: true,
  hasDotDevflow: true,
  hasDevArtifacts: true,
  hasDevflowMd: true,
  hasClaudeMd: true,
  activeFeature: null,
  features: [],
  detectedFramework: null,
  language: "typescript",
  fileCount: 10,
  gitStatus: "clean",
  lastModifiedTimestamp: Date.now(),
} as ProjectInspection;

describe("Next Action Engine", () => {
  it("recommends init for no-project", () => {
    const r = computeRecommendation(makeStateResult("no-project"), mockInspection);
    expect(r.recommendedNextAction.id).toBe("init-project");
  });

  it("recommends writing requirements for feature-empty", () => {
    const r = computeRecommendation(
      makeStateResult("feature-empty"),
      mockInspection
    );
    expect(r.recommendedNextAction.id).toBe("write-requirements");
  });

  it("recommends resolving doubts for feature-clarification-needed", () => {
    const r = computeRecommendation(
      makeStateResult("feature-clarification-needed"),
      mockInspection
    );
    expect(r.recommendedNextAction.id).toBe("resolve-doubts");
  });

  it("recommends starting next feature for feature-done", () => {
    const r = computeRecommendation(
      makeStateResult("feature-done"),
      mockInspection
    );
    expect(r.recommendedNextAction.id).toBe("start-next-feature");
  });

  it("recommends reconciling drift for drift-detected", () => {
    const r = computeRecommendation(
      makeStateResult("drift-detected"),
      mockInspection
    );
    expect(r.recommendedNextAction.id).toBe("reconcile-drift");
  });

  it("includes alternatives", () => {
    const r = computeRecommendation(
      makeStateResult("feature-empty"),
      mockInspection
    );
    expect(r.alternatives.length).toBeGreaterThanOrEqual(1);
  });

  it("sets safety level to blocked when blockers present", () => {
    const blockedResult = makeStateResult("feature-empty");
    blockedResult.blockers = ["blocked"];
    const r = computeRecommendation(blockedResult, mockInspection);
    expect(r.recommendedNextAction.safetyLevel).toBe("blocked");
  });
});
