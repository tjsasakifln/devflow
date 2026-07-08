// =============================================================================
// devflow analyze — Parallel Analysis Command
// =============================================================================
// CLI entry point for parallel agent-based analysis.
// Spawns N parallel agents to analyze different code dimensions.
//
// Usage:
//   devflow analyze --parallel=security,performance
//   devflow analyze --parallel=all
//   devflow analyze --parallel=custom --dimensions ./custom-dims.json
//   devflow analyze --parallel --json          # JSON output (pipe-safe)
// =============================================================================

import path from "node:path";
import pc from "picocolors";

import { ParallelSpawner } from "../kernel/orchestration/parallel-spawner.js";
import {
  DEFAULT_DIMENSIONS,
  resolveDimensions,
  resolveDimensionsFromFile,
} from "../kernel/orchestration/dimensions.js";
import type {
  DimensionDef,
  ConsolidatedResult,

} from "../kernel/orchestration/types.js";

export interface AnalyzeOptions {
  /** Comma-separated list of dimensions, "all", or "custom". */
  parallel?: string;
  /** Path to custom dimension config file. */
  dimensionsFile?: string;
  /** Output as JSON (pipe-safe). */
  json?: boolean;
  /** Maximum parallel agents. */
  maxParallel?: number;
  /** Per-agent timeout in seconds. */
  timeout?: number;
}

/**
 * Execute the `devflow analyze` command.
 */
export async function analyzeCommand(
  cwd: string,
  options: AnalyzeOptions,
): Promise<void> {
  const rootPath = path.resolve(cwd);

  // Parse dimension selection
  let dimensions: DimensionDef[];
  try {
    dimensions = await parseDimensionSelection(options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`[analyze] Error: ${msg}`));
    process.exit(1);
  }

  if (dimensions.length === 0) {
    console.log(pc.yellow("[analyze] No dimensions selected. Nothing to analyze."));
    return;
  }

  // Build spawner config
  const spawnerOptions: { maxParallel?: number; timeoutPerAgent?: number } = {};
  if (options.maxParallel !== undefined) {
    spawnerOptions.maxParallel = options.maxParallel;
  }
  if (options.timeout !== undefined) {
    spawnerOptions.timeoutPerAgent = options.timeout * 1000;
  }

  // Create spawner and run
  const spawner = new ParallelSpawner(rootPath);

  if (!options.json) {
    console.log(pc.bold("\n[analyze] Parallel Analysis"));
    console.log(pc.dim(`  Dimensions: ${dimensions.map((d) => d.name).join(", ")}`));
    console.log(pc.dim(`  Max parallel: ${spawnerOptions.maxParallel ?? "auto"}`));
    console.log(pc.dim(`  Timeout: ${options.timeout ?? 120}s per agent\n`));
  }

  let result: ConsolidatedResult;
  try {
    result = await spawner.spawnAgents(dimensions, spawnerOptions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`[analyze] Spawn failed: ${msg}`));
    process.exit(1);
  }

  // Output
  if (options.json) {
    // Pipe-safe JSON output
    console.log(JSON.stringify(result, null, 2));
  } else {
    renderHumanReadable(result);
  }
}

/**
 * Parse dimension selection from CLI options.
 */
async function parseDimensionSelection(
  options: AnalyzeOptions,
): Promise<DimensionDef[]> {
  const selection = options.parallel ?? "all";

  if (selection === "all" || selection === "default") {
    return [...DEFAULT_DIMENSIONS];
  }

  if (selection === "custom") {
    if (!options.dimensionsFile) {
      throw new Error(
        "Custom dimension set requires --dimensions-file <path>",
      );
    }
    return resolveDimensionsFromFile(options.dimensionsFile);
  }

  // Comma-separated list of dimension names
  const names = selection.split(",").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) {
    throw new Error(
      `Invalid dimension selection: "${options.parallel}". ` +
        `Use "all", a comma-separated list, or "custom".`,
    );
  }

  return resolveDimensions(names);
}

/**
 * Render analysis results in a human-readable format.
 */
function renderHumanReadable(result: ConsolidatedResult): void {
  console.log(pc.bold("\n[analyze] Results"));
  console.log(pc.dim(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`));
  console.log(pc.dim(`  Total findings: ${result.totalFindings}`));

  // Timed out agents
  if (result.timedOutAgents.length > 0) {
    console.log(
      pc.yellow(
        `\n  Warning: ${result.timedOutAgents.length} agent(s) timed out: ` +
          result.timedOutAgents.join(", "),
      ),
    );
  }

  // Failed agents
  if (result.failedAgents.length > 0) {
    console.log(
      pc.red(
        `\n  Error: ${result.failedAgents.length} agent(s) failed: ` +
          result.failedAgents.join(", "),
      ),
    );
  }

  // Per-dimension summary
  console.log("");
  for (const [dimName, findings] of Object.entries(result.byDimension)) {
    const criticalCount = findings.filter((f) => f.severity === "critical").length;
    const warningCount = findings.filter((f) => f.severity === "warning").length;
    const infoCount = findings.filter((f) => f.severity === "info").length;

    const color =
      criticalCount > 0
        ? pc.red
        : warningCount > 0
          ? pc.yellow
          : pc.green;

    console.log(
      color(
        `  ${pc.bold(dimName)}: ${findings.length} findings ` +
          `(${criticalCount} critical, ${warningCount} warning, ${infoCount} info)`,
      ),
    );
  }

  // Top issues (show up to 10)
  const criticalIssues = result.topIssues.filter((f) => f.severity === "critical");
  const warningIssues = result.topIssues.filter((f) => f.severity === "warning");

  if (criticalIssues.length > 0) {
    console.log(pc.bold("\n  Critical Issues:"));
    for (const issue of criticalIssues) {
      console.log(
        pc.red(
          `    [${issue.file}:${issue.line}] ${issue.message}`,
        ),
      );
    }
  }

  if (warningIssues.length > 0) {
    const showWarnings = warningIssues.slice(0, 10);
    console.log(pc.bold("\n  Top Warnings:"));
    for (const issue of showWarnings) {
      console.log(
        pc.yellow(
          `    [${issue.file}:${issue.line}] ${issue.message}`,
        ),
      );
    }
    if (warningIssues.length > 10) {
      console.log(
        pc.dim(
          `    ... and ${warningIssues.length - 10} more warnings`,
        ),
      );
    }
  }

  if (result.totalFindings === 0) {
    console.log(pc.green("\n  No issues found. Clean analysis.\n"));
  } else {
    console.log("");
  }
}
