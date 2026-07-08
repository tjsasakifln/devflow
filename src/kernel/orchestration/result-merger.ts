// =============================================================================
// Parallel Agent Spawner — Result Consolidation
// =============================================================================
// Merges results from multiple agents into a single consolidated output.
// Deduplicates findings by (file, line, dimension) to prevent overlap.
// =============================================================================

import type { Finding, AgentResult, ConsolidatedResult } from "./types.js";

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicate findings using a composite key of file+line+dimension+message.
 * The first occurrence is kept; subsequent duplicates are discarded.
 */
export function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const result: Finding[] = [];

  for (const finding of findings) {
    const key = `${finding.file}:${finding.line}:${finding.dimension}:${finding.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(finding);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** Severity weight for sorting — critical first. */
const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Sort findings by severity (critical first), then by file path, then by line.
 */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sevA = SEVERITY_WEIGHT[a.severity] ?? 99;
    const sevB = SEVERITY_WEIGHT[b.severity] ?? 99;
    if (sevA !== sevB) return sevA - sevB;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });
}

// ---------------------------------------------------------------------------
// Consolidation
// ---------------------------------------------------------------------------

/**
 * Merge results from multiple agents into a single consolidated output.
 *
 * Process:
 * 1. Collect all findings from all successful agents
 * 2. Deduplicate by (file, line, dimension, message)
 * 3. Group by dimension
 * 4. Sort top issues (critical/warning)
 */
export function consolidateResults(
  agentResults: AgentResult[],
  startTime: number,
  endTime: number,
): ConsolidatedResult {
  // Separate successful and failed agents
  const successfulResults = agentResults.filter(
    (r) => r.exitCode === 0 && !r.error,
  );
  const timedOutAgents = agentResults
    .filter((r) => r.error?.includes("timed out"))
    .map((r) => r.dimension);
  const failedAgents = agentResults
    .filter((r) => r.exitCode !== 0 || (r.error && !r.error.includes("timed out")))
    .map((r) => r.dimension);

  // Collect all findings
  const allFindings: Finding[] = [];
  for (const result of successfulResults) {
    allFindings.push(...result.findings);
  }

  // Deduplicate
  const deduped = deduplicateFindings(allFindings);

  // Group by dimension
  const byDimension: Record<string, Finding[]> = {};
  for (const finding of deduped) {
    if (!byDimension[finding.dimension]) {
      byDimension[finding.dimension] = [];
    }
    byDimension[finding.dimension]!.push(finding);
  }

  // Sort within each dimension
  for (const dim of Object.keys(byDimension)) {
    byDimension[dim] = sortFindings(byDimension[dim]!);
  }

  // Top issues: critical first, then warning
  const topIssues = sortFindings(
    deduped.filter((f) => f.severity === "critical" || f.severity === "warning"),
  );

  return {
    totalFindings: deduped.length,
    byDimension,
    topIssues,
    durationMs: endTime - startTime,
    timedOutAgents,
    failedAgents,
    agentResults,
  };
}

// ---------------------------------------------------------------------------
// Merge multiple consolidated results (for cumulative runs)
// ---------------------------------------------------------------------------

/**
 * Merge multiple ConsolidatedResult objects into one.
 * Useful for streaming or cumulative analysis runs.
 */
export function mergeConsolidatedResults(
  results: ConsolidatedResult[],
): ConsolidatedResult {
  if (results.length === 0) {
    return {
      totalFindings: 0,
      byDimension: {},
      topIssues: [],
      durationMs: 0,
      timedOutAgents: [],
      failedAgents: [],
      agentResults: [],
    };
  }

  if (results.length === 1) return results[0]!;

  // Collect all agent results
  const allAgentResults: AgentResult[] = [];
  const allTimedOut = new Set<string>();
  const allFailed = new Set<string>();
  let totalDuration = 0;

  for (const r of results) {
    allAgentResults.push(...r.agentResults);
    for (const agent of r.timedOutAgents) allTimedOut.add(agent);
    for (const agent of r.failedAgents) allFailed.add(agent);
    totalDuration += r.durationMs;
  }

  // Get start/end from first/last result
  const startTime = Date.now() - totalDuration;
  const endTime = Date.now();

  return consolidateResults(allAgentResults, startTime, endTime);
}
