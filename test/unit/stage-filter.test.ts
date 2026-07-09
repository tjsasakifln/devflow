import { describe, it, expect } from "vitest";
import {
  getApplicableCheckIds,
  STAGE_CHECK_MAP,
  CHECK_REQUIRED_STATES,
  getCheckRequiredState,
} from "../../src/kernel/checks/stage-filter.js";
import type { DevflowState } from "../../src/kernel/types/state.js";

describe("STAGE_CHECK_MAP", () => {
  it("covers all known feature states", () => {
    const knownStates: DevflowState[] = [
      "feature-empty",
      "feature-requirements",
      "feature-clarification-needed",
      "feature-design",
      "feature-design-reviewed",
      "feature-test-plan",
      "feature-test-plan-ready",
      "feature-pre-code-audit",
      "feature-coding-ready",
      "feature-coding-in-progress",
      "feature-verification",
      "feature-ci-verified",
      "feature-review",
      "feature-adversarial-review",
      "feature-done",
    ];

    for (const state of knownStates) {
      const ids = getApplicableCheckIds(state, false);
      expect(ids).not.toBeNull();
      expect(ids!.size).toBeGreaterThan(0);
    }
  });

  it("returns null for project-level states (run all)", () => {
    const projectStates: DevflowState[] = [
      "no-project",
      "greenfield-idea",
      "greenfield-specified",
      "brownfield-unknown",
      "brownfield-discovered",
      "brownfield-specified",
      "drift-detected",
      "blocked",
    ];

    for (const state of projectStates) {
      expect(getApplicableCheckIds(state, false)).toBeNull();
    }
  });

  it("returns null for unknown states (run all)", () => {
    expect(getApplicableCheckIds("unknown" as DevflowState, false)).toBeNull();
  });

  it("returns null when runAll is true regardless of state", () => {
    expect(getApplicableCheckIds("feature-empty", true)).toBeNull();
    expect(getApplicableCheckIds("feature-done", true)).toBeNull();
    expect(getApplicableCheckIds("feature-coding-in-progress", true)).toBeNull();
  });

  it("maps legacy states to their modern equivalents", () => {
    const legacyChecks = getApplicableCheckIds("feature-planned" as DevflowState, false);
    const emptyChecks = getApplicableCheckIds("feature-empty", false);
    expect(legacyChecks).toEqual(emptyChecks);

    const todoChecks = getApplicableCheckIds("feature-todo" as DevflowState, false);
    const codingChecks = getApplicableCheckIds("feature-coding-in-progress", false);
    expect(todoChecks).toEqual(codingChecks);
  });
});

describe("State-to-check mapping correctness (AC 5)", () => {
  it("feature-empty runs only checks 1-4", () => {
    const ids = getApplicableCheckIds("feature-empty", false)!;
    expect(ids).toEqual(new Set(["1", "2", "3", "4"]));
  });

  it("feature-requirements runs only checks 1-4", () => {
    const ids = getApplicableCheckIds("feature-requirements", false)!;
    expect(ids).toEqual(new Set(["1", "2", "3", "4"]));
  });

  it("feature-design runs checks 1-4, 14", () => {
    const ids = getApplicableCheckIds("feature-design", false)!;
    expect(ids).toEqual(new Set(["1", "2", "3", "4", "14"]));
  });

  it("feature-test-plan runs checks 1-4, 23", () => {
    const ids = getApplicableCheckIds("feature-test-plan", false)!;
    expect(ids).toEqual(new Set(["1", "2", "3", "4", "23"]));
  });

  it("feature-coding-ready runs checks 1-4, 14, 23", () => {
    const ids = getApplicableCheckIds("feature-coding-ready", false)!;
    expect(ids).toEqual(new Set(["1", "2", "3", "4", "14", "23"]));
  });

  it("feature-coding-in-progress runs checks 5-13, 17, 24", () => {
    const ids = getApplicableCheckIds("feature-coding-in-progress", false)!;
    expect(ids).toEqual(new Set(["5", "6", "7", "8", "9", "10", "11", "12", "13", "17", "24"]));
  });

  it("feature-verification runs checks 5-13, 16, 17, 24", () => {
    const ids = getApplicableCheckIds("feature-verification", false)!;
    expect(ids).toEqual(new Set(["5", "6", "7", "8", "9", "10", "11", "12", "13", "16", "17", "24"]));
  });

  it("feature-review runs checks 15, 19, 20, 25", () => {
    const ids = getApplicableCheckIds("feature-review", false)!;
    expect(ids).toEqual(new Set(["15", "19", "20", "25"]));
  });

  it("feature-done returns all 25 checks", () => {
    const ids = getApplicableCheckIds("feature-done", false)!;
    expect(ids.size).toBe(25);
    for (let i = 1; i <= 25; i++) {
      expect(ids.has(String(i))).toBe(true);
    }
  });
});

describe("getCheckRequiredState", () => {
  it("returns the required state for each check ID", () => {
    expect(getCheckRequiredState("1")).toBe("feature-empty");
    expect(getCheckRequiredState("5")).toBe("feature-coding-in-progress");
    expect(getCheckRequiredState("14")).toBe("feature-design");
    expect(getCheckRequiredState("15")).toBe("feature-review");
    expect(getCheckRequiredState("23")).toBe("feature-test-plan");
  });

  it("returns 'unknown' for invalid check IDs", () => {
    expect(getCheckRequiredState("99")).toBe("unknown");
    expect(getCheckRequiredState("invalid")).toBe("unknown");
  });
});
