import type { DevflowState } from "../types/state.js";

/**
 * Stage-Aware DoD Check Filter
 *
 * Maps each feature state to the subset of DoD check IDs that are applicable.
 * This data structure centralizes the state-to-check mapping so it is NOT
 * hardcoded in the runner (Acceptance Criterion 5).
 *
 * States not listed here (project-level states, anomaly states) run all 25 checks.
 */

/**
 * Canonical mapping from feature state → applicable check IDs.
 *
 * Rules:
 * - Early states (empty, requirements, design) → artifact checks only
 * - Coding states → code quality checks + implementation log
 * - Verification → code quality + CI
 * - Review → process/review gates
 * - Done → all 25 checks
 */
export const STAGE_CHECK_MAP: ReadonlyMap<DevflowState, readonly string[]> = new Map([
  // ── Specification phase: artifact completeness only ──
  ["feature-empty",              ["1", "2", "3", "4"]],
  ["feature-requirements",       ["1", "2", "3", "4"]],
  ["feature-clarification-needed", ["1", "2", "3", "4"]],

  // ── Design phase: artifacts + ADRs ──
  ["feature-design",             ["1", "2", "3", "4", "14"]],
  ["feature-design-reviewed",    ["1", "2", "3", "4", "14"]],

  // ── Test-planning phase: artifacts + test plan check ──
  ["feature-test-plan",          ["1", "2", "3", "4", "23"]],
  ["feature-test-plan-ready",    ["1", "2", "3", "4", "23"]],

  // ── Pre-code / coding-ready: artifacts + ADRs + test plan ──
  ["feature-pre-code-audit",     ["1", "2", "3", "4", "14", "23"]],
  ["feature-coding-ready",       ["1", "2", "3", "4", "14", "23"]],

  // ── Coding: code quality + implementation log ──
  ["feature-coding-in-progress", ["5", "6", "7", "8", "9", "10", "11", "12", "13", "17", "24"]],

  // ── Verification: code quality + CI ──
  ["feature-verification",       ["5", "6", "7", "8", "9", "10", "11", "12", "13", "16", "17", "24"]],
  ["feature-ci-verified",        ["5", "6", "7", "8", "9", "10", "11", "12", "13", "16", "17", "24"]],

  // ── Review: process/review gates only ──
  ["feature-review",             ["15", "19", "20", "25"]],
  ["feature-adversarial-review", ["15", "19", "20", "25"]],

  // ── Done: all 25 checks ──
  ["feature-done",               ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25"]],
]);

/**
 * Legacy state remapping — deprecated states map to their modern equivalents.
 */
const LEGACY_STATE_MAP: ReadonlyMap<string, DevflowState> = new Map([
  ["feature-planned",  "feature-empty"],
  ["feature-planning", "feature-empty"],
  ["feature-todo",     "feature-coding-in-progress"],
]);

/**
 * States that always run all 25 checks (project-level / anomaly / unknown).
 */
const FULL_CHECK_STATES: ReadonlySet<string> = new Set([
  "no-project",
  "greenfield-idea",
  "greenfield-specified",
  "brownfield-unknown",
  "brownfield-discovered",
  "brownfield-specified",
  "drift-detected",
  "blocked",
]);

/**
 * Display label for the state that gates each check — used in "SKIPPED" messages.
 */
export const CHECK_REQUIRED_STATES: ReadonlyMap<string, string> = new Map([
  ["1",  "feature-empty"],
  ["2",  "feature-empty"],
  ["3",  "feature-empty"],
  ["4",  "feature-empty"],
  ["5",  "feature-coding-in-progress"],
  ["6",  "feature-coding-in-progress"],
  ["7",  "feature-coding-in-progress"],
  ["8",  "feature-coding-in-progress"],
  ["9",  "feature-coding-in-progress"],
  ["10", "feature-coding-in-progress"],
  ["11", "feature-coding-in-progress"],
  ["12", "feature-coding-in-progress"],
  ["13", "feature-coding-in-progress"],
  ["14", "feature-design"],
  ["15", "feature-review"],
  ["16", "feature-verification"],
  ["17", "feature-coding-in-progress"],
  ["18", "feature-verification"],
  ["19", "feature-review"],
  ["20", "feature-review"],
  ["21", "feature-verification"],
  ["22", "feature-verification"],
  ["23", "feature-test-plan"],
  ["24", "feature-coding-in-progress"],
  ["25", "feature-review"],
]);

/**
 * Resolve the applicable check IDs for a given state.
 *
 * @param state  The current feature state
 * @param runAll If true, returns null (meaning: run all checks)
 * @returns A set of applicable check IDs, or null if all checks should run
 */
export function getApplicableCheckIds(
  state: DevflowState,
  runAll: boolean,
): Set<string> | null {
  if (runAll) return null;

  // Full-check states
  if (FULL_CHECK_STATES.has(state)) return null;

  // Direct state lookup
  const direct = STAGE_CHECK_MAP.get(state);
  if (direct) return new Set(direct);

  // Legacy state remapping
  const mappedState = LEGACY_STATE_MAP.get(state);
  if (mappedState) {
    const mapped = STAGE_CHECK_MAP.get(mappedState);
    if (mapped) return new Set(mapped);
  }

  // Unknown state — run all checks
  return null;
}

/**
 * Provide a descriptive "required state" label for a skipped check.
 */
export function getCheckRequiredState(checkId: string): string {
  return CHECK_REQUIRED_STATES.get(checkId) ?? "unknown";
}
