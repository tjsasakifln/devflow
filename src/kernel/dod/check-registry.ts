/**
 * DoD Check Registry
 *
 * Central registry of all Definition of Done checks.
 * Each check is a self-contained module with declared metadata.
 * The registry can filter by mode and category.
 */

import type { DoDCheckDecl, DoDCheckResult, DoDCheckContext, ExecutionMode } from "./types.js";

// ── Check Imports ──
import { check01Requirements } from "./checks/01-requirements.js";
import { check02Roadmap } from "./checks/02-roadmap.js";
import { check03Actions } from "./checks/03-actions.js";
import { check04Constitution } from "./checks/04-constitution.js";
import { check05Tests } from "./checks/05-tests.js";
import { check06Typecheck } from "./checks/06-typecheck.js";
import { check07Lint } from "./checks/07-lint.js";
import { check08Coverage } from "./checks/08-coverage.js";

// ── Registry ──

/** All registered DoD checks in execution order. */
const ALL_CHECKS: DoDCheckDecl[] = [
  check01Requirements,
  check02Roadmap,
  check03Actions,
  check04Constitution,
  check05Tests,
  check06Typecheck,
  check07Lint,
  check08Coverage,
  // Additional checks registered here in subsequent phases.
  // The full 25 checks will be extracted from feature-complete.ts.
];

// ── Query ──

/** Get checks filtered by execution mode. */
export function getDoDChecks(mode: ExecutionMode): DoDCheckDecl[] {
  return ALL_CHECKS.filter((c) => c.requiredInModes.includes(mode));
}

/** Get all registered checks regardless of mode. */
export function getAllDoDChecks(): DoDCheckDecl[] {
  return [...ALL_CHECKS];
}

/** Get check count. */
export function getDoDCheckCount(): number {
  return ALL_CHECKS.length;
}

// ── Execution ──

/** Run all DoD checks for a feature. Returns results in order. */
export async function runDoDChecks(
  featureId: string,
  rootPath: string,
  mode: ExecutionMode,
  options?: {
    filterByMode?: boolean;
    abortOnFirstBlockingFailure?: boolean;
  },
): Promise<DoDCheckResult[]> {
  const checks = options?.filterByMode !== false
    ? getDoDChecks(mode)
    : ALL_CHECKS;

  const featureDir = `${rootPath}/_devflow/features/${featureId}`;
  const ctx: DoDCheckContext = { featureId, featureDir, rootPath, mode };
  const results: DoDCheckResult[] = [];

  for (const check of checks) {
    const start = Date.now();
    let result: DoDCheckResult;
    try {
      result = await check.run(ctx);
    } catch (err) {
      result = {
        checkId: check.id,
        name: check.name,
        category: check.category,
        passed: false,
        detail: `Check threw: ${err instanceof Error ? err.message : String(err)}`,
        blocking: check.blockingDefault,
        remediation: check.remediationTemplate,
        evidence: [],
        durationMs: Date.now() - start,
      };
    }
    result.durationMs = Date.now() - start;
    results.push(result);

    if (options?.abortOnFirstBlockingFailure && !result.passed && result.blocking) {
      break;
    }
  }

  return results;
}
