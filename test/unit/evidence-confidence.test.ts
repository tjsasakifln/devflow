import { describe, it, expect } from "vitest";
import {
  scoreFeatureCompletionConfidence,
  scoreConfidence,
} from "../../src/kernel/evidence/confidence.js";
import type { Evidence, CIStatus } from "../../src/kernel/types/state.js";

describe("Evidence - scoreFeatureCompletionConfidence", () => {
  const defaultParams = {
    hasActiveBlockers: false,
    ciStatuses: [] as CIStatus[],
    allActionsDone: true,
    localChecksPassing: true,
    ciGreen: true,
    independentReviewDone: true,
    gatekeeperApproved: true,
    dodChecksPassed: 8,
    dodChecksTotal: 8,
  };

  it("returns blocked when active blockers exist", () => {
    const result = scoreFeatureCompletionConfidence({ ...defaultParams, hasActiveBlockers: true });
    expect(result).toBe("blocked");
  });

  it("returns blocked when CI has failures", () => {
    const result = scoreFeatureCompletionConfidence({
      ...defaultParams,
      ciStatuses: [{ workflow: "ci", conclusion: "failure", runId: null, htmlUrl: null, headSha: null, timestamp: "", branch: "" }],
    });
    expect(result).toBe("blocked");
  });

  it("returns draft when actions not done", () => {
    const result = scoreFeatureCompletionConfidence({ ...defaultParams, allActionsDone: false });
    expect(result).toBe("draft");
  });

  it("returns complete when all gates pass", () => {
    const result = scoreFeatureCompletionConfidence(defaultParams);
    expect(result).toBe("complete");
  });

  it("returns release-candidate when dod checks not all passing but review done", () => {
    const result = scoreFeatureCompletionConfidence({
      ...defaultParams,
      dodChecksPassed: 6,
      dodChecksTotal: 8,
    });
    expect(result).toBe("release-candidate");
  });

  it("returns locally-verified when actions done and local checks pass but no review", () => {
    const result = scoreFeatureCompletionConfidence({
      ...defaultParams,
      independentReviewDone: false,
      ciGreen: false,
    });
    expect(result).toBe("locally-verified");
  });

  it("returns review-required when actions done but local checks fail", () => {
    const result = scoreFeatureCompletionConfidence({
      ...defaultParams,
      independentReviewDone: false,
      localChecksPassing: false,
    });
    expect(result).toBe("review-required");
  });

  it("returns ci-verified when CI green but no independent review", () => {
    const result = scoreFeatureCompletionConfidence({
      ...defaultParams,
      independentReviewDone: false,
      localChecksPassing: true,
      ciGreen: true,
    });
    expect(result).toBe("ci-verified");
  });
});

describe("Evidence - scoreConfidence", () => {
  it("returns high when all evidence supports state with 0.8+ ratio", () => {
    const evidence: Evidence[] = [
      { type: "file_presence", key: "has_package_json", value: true, source: "test", confidence: "high" },
      { type: "file_presence", key: "has_src_dir", value: true, source: "test", confidence: "high" },
    ];
    const result = scoreConfidence(evidence, "greenfield-idea");
    expect(result).toBe("high");
  });

  it("returns low for empty evidence", () => {
    const result = scoreConfidence([], "greenfield-idea");
    expect(result).toBe("low");
  });

  it("returns low when ratio < 0.5", () => {
    const evidence: Evidence[] = [
      { type: "file_presence", key: "has_package_json", value: false, source: "test", confidence: "high" },
    ];
    // For greenfield-idea: has_package_json=false → contradicts (returns false, negative weight 3)
    const result = scoreConfidence(evidence, "greenfield-idea");
    expect(result).toBe("low");
  });

  it("handles neutral evidence (null) correctly", () => {
    const evidence: Evidence[] = [
      { type: "count", key: "feature_count", value: 5, source: "test", confidence: "medium" },
    ];
    const result = scoreConfidence(evidence, "blocked");
    expect(result).toBe("low");
  });

  it("penalizes high-confidence contradiction", () => {
    const evidence: Evidence[] = [
      { type: "file_presence", key: "has_package_json", value: true, source: "test", confidence: "high" },
      { type: "file_presence", key: "has_package_json", value: false, source: "test", confidence: "high" },
    ];
    const result = scoreConfidence(evidence, "no-project");
    // For no-project: has_package_json=false → supports, has_package_json=true → contradicts
    // Both high confidence → positive=3, negative=3 → ratio=0.5 → medium
    // But has high-contradiction flag too → stays medium since ratio >= 0.5
    expect(result).toBe("medium");
  });
});
