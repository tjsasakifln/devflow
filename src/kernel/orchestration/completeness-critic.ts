// =============================================================================
// Completeness Critic Pattern
// =============================================================================
// Post-analysis critic that asks "what's missing?" and generates gaps:
//   - Dimensions not covered (security, performance, architecture, etc.)
//   - Sources not read (files that exist but weren't inspected)
//   - Claims not verified (statements that need additional verification)
//
// Loop-until-dry: runs the critic → collects gaps → feeds as input for
// re-analysis → repeats. Stops when dry condition is met (0 items in 2
// consecutive rounds). Max 5 iterations.
//
// The critic does NOT fix gaps — it only reports them. Remediation is
// the responsibility of @dev or the user.
// =============================================================================

import path from "node:path";
import fs from "node:fs";
import { DEFAULT_DIMENSIONS } from "./dimensions.js";
import type {
  CriticGap,
  CriticGapType,
  CriticIteration,
  CriticReport,
  CriticConfig,
  AgentResult,
  Finding,
  ConsolidatedResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default critic configuration. */
const DEFAULT_CRITIC_CONFIG: CriticConfig = {
  maxIterations: 5,
  dryThreshold: 2,
  useSpawner: false,
  spawnerTimeoutMs: 30_000,
};

/** The standard set of analysis dimensions. */
const ALL_DIMENSIONS = new Set(DEFAULT_DIMENSIONS.map((d) => d.name));

/** Directories to skip during file scanning. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".devflow",
  ".aiox",
  ".aiox-core",
  "coverage",
  "_devflow",
  "templates",
]);

// =============================================================================
// CompletenessCritic
// =============================================================================

export class CompletenessCritic {
  private rootPath: string;
  private config: CriticConfig;

  /**
   * @param rootPath Project root directory.
   * @param config Optional overrides for critic configuration.
   */
  constructor(
    rootPath: string,
    config?: Partial<CriticConfig>,
  ) {
    this.rootPath = path.resolve(rootPath);
    this.config = { ...DEFAULT_CRITIC_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Run a full completeness critique with loop-until-dry.
   *
   * @param analysisContext Information about what was already analyzed.
   * @returns A comprehensive CriticReport with gaps and iteration history.
   */
  async fullCritique(
    analysisContext: AnalysisContext,
  ): Promise<CriticReport> {
    const startTime = performance.now();
    const iterations: CriticIteration[] = [];
    let dryStreak = 0;
    let iteration = 0;
    let stopReason: CriticReport["stopReason"] = "dry";
    let currentContext = analysisContext;

    while (iteration < this.config.maxIterations) {
      iteration++;

      // Run the critic on the current context
      const gaps = await this.runCritic(currentContext);

      const isDry = gaps.length === 0;
      const iterationRecord: CriticIteration = {
        iteration,
        gaps,
        gapCount: gaps.length,
        isDry,
        timestamp: new Date().toISOString(),
      };
      iterations.push(iterationRecord);

      if (isDry) {
        dryStreak++;
        if (dryStreak >= this.config.dryThreshold) {
          // Dry condition met — stop
          break;
        }
      } else {
        dryStreak = 0;
        // Feed gaps as input for the next iteration
        currentContext = this.enrichContextWithGaps(currentContext, gaps);
      }
    }

    const endTime = performance.now();

    // Determine stop reason
    if (iteration >= this.config.maxIterations) {
      // Only determine if we actually hit the limit
      const lastIteration = iterations[iterations.length - 1];
      if (lastIteration && lastIteration.isDry && dryStreak >= this.config.dryThreshold) {
        stopReason = "dry";
      } else {
        stopReason = "max-iterations";
      }
    } else if (iterations.some((it) => it.isDry)) {
      stopReason = "dry";
    }

    // Aggregate all gaps from the last iteration
    const lastIteration = iterations[iterations.length - 1];
    const finalGaps = lastIteration?.gaps ?? [];

    // Group by type
    const byType: Record<CriticGapType, CriticGap[]> = {
      dimension_not_covered: [],
      source_not_read: [],
      claim_not_verified: [],
    };

    for (const gap of finalGaps) {
      byType[gap.type].push(gap);
    }

    return {
      totalGaps: finalGaps.length,
      byType,
      gaps: finalGaps,
      iterations,
      totalIterations: iteration,
      stopReason,
      hasGaps: finalGaps.length > 0,
      durationMs: Math.round(endTime - startTime),
    };
  }

  /**
   * Run a single critic pass (one iteration).
   * Checks dimensions not covered, sources not read, and claims not verified.
   *
   * @param context What was already analyzed.
   * @returns Gaps found in this pass.
   */
  async runCritic(context: AnalysisContext): Promise<CriticGap[]> {
    const gaps: CriticGap[] = [];

    // 1. Check dimensions not covered
    const dimGaps = await this.checkDimensionsNotCovered(context);
    gaps.push(...dimGaps);

    // 2. Check sources not read
    const srcGaps = await this.checkSourcesNotRead(context);
    gaps.push(...srcGaps);

    // 3. Check claims not verified
    const claimGaps = await this.checkClaimsNotVerified(context);
    gaps.push(...claimGaps);

    return gaps;
  }

  // -------------------------------------------------------------------------
  // Dimension Coverage Analysis
  // -------------------------------------------------------------------------

  /**
   * Compare dimensions that were analyzed against the full set of available
   * dimensions. Report any that were not covered.
   */
  private async checkDimensionsNotCovered(
    context: AnalysisContext,
  ): Promise<CriticGap[]> {
    const gaps: CriticGap[] = [];
    const coveredDims = new Set(
      (context.analyzedDimensions ?? []).map((d) => d.toLowerCase().trim()),
    );

    // Allow gaps to override covered dimensions (for iterative refinement)
    if (context.coveredDimensionsOverride) {
      for (const d of context.coveredDimensionsOverride) {
        coveredDims.add(d.toLowerCase().trim());
      }
    }

    for (const dim of ALL_DIMENSIONS) {
      if (!coveredDims.has(dim)) {
        const dimDef = DEFAULT_DIMENSIONS.find((d) => d.name === dim);
        gaps.push({
          type: "dimension_not_covered",
          description: `Dimension "${dim}" not analyzed`,
          details: dimDef
            ? `${dimDef.description}. Relevant patterns: ${dimDef.globPatterns.join(", ")}`
            : `No analysis was performed for the ${dim} dimension`,
          severity: dim === "security" ? "critical" : "warning",
          suggestion: `Run analysis for the "${dim}" dimension to ensure complete coverage`,
        });
      }
    }

    return gaps;
  }

  // -------------------------------------------------------------------------
  // Source Coverage Analysis
  // -------------------------------------------------------------------------

  /**
   * Walk the project directory and compare files present against files
   * that were inspected. Report un-inspected source files.
   */
  private async checkSourcesNotRead(
    context: AnalysisContext,
  ): Promise<CriticGap[]> {
    const gaps: CriticGap[] = [];
    const inspectedFiles = new Set(
      (context.inspectedFiles ?? []).map((f) =>
        path.normalize(f).replace(/\\/g, "/"),
      ),
    );

    // Allow gaps to override inspected files (for iterative refinement)
    if (context.inspectedFilesOverride) {
      for (const f of context.inspectedFilesOverride) {
        inspectedFiles.add(path.normalize(f).replace(/\\/g, "/"));
      }
    }

    // Discover all source files in the project
    const projectFiles = await this.discoverSourceFiles();

    const unreadFiles: string[] = [];
    for (const filePath of projectFiles) {
      const normalized = path.normalize(filePath).replace(/\\/g, "/");
      if (!inspectedFiles.has(normalized)) {
        unreadFiles.push(filePath);
      }
    }

    if (unreadFiles.length > 0) {
      // Limit the report to a reasonable number
      const maxToReport = Math.min(unreadFiles.length, 20);
      const reported = unreadFiles.slice(0, maxToReport);

      gaps.push({
        type: "source_not_read",
        description: `${unreadFiles.length} source file(s) not inspected`,
        details: `Files not analyzed: ${reported.join(", ")}${unreadFiles.length > maxToReport ? `, and ${unreadFiles.length - maxToReport} more` : ""}`,
        severity: unreadFiles.length > 10 ? "warning" : "info",
        suggestion: "Review un-inspected files for relevance to the current analysis scope",
      });
    }

    return gaps;
  }

  // -------------------------------------------------------------------------
  // Claim Verification Analysis
  // -------------------------------------------------------------------------

  /**
   * Scan the analysis output for claims that need additional verification.
   * This checks for unsubstantiated statements, TODO markers, and missing
   * evidence in the results.
   */
  private async checkClaimsNotVerified(
    context: AnalysisContext,
  ): Promise<CriticGap[]> {
    const gaps: CriticGap[] = [];

    // Check analysis results for unverified claims
    const agentResults = context.agentResults ?? [];
    for (const result of agentResults) {
      for (const finding of result.findings ?? []) {
        // Mark critical findings as needing verification
        if (finding.severity === "critical" && !finding.message.includes("[verified]")) {
          gaps.push({
            type: "claim_not_verified",
            description: `Critical finding in "${result.dimension}" needs verification`,
            details: `[${finding.file}:${finding.line}] ${finding.message}`,
            severity: "warning",
            suggestion: `Verify the critical finding in ${finding.file} before acting on it`,
          });
        }
      }
    }

    // Check for unresolved TODO/FIXME markers referenced in findings
    const todoGaps = await this.checkForUnresolvedMarkers(context);
    gaps.push(...todoGaps);

    return gaps;
  }

  /**
   * Scan for unresolved TODO/FIXME markers in the analysis context.
   */
  private async checkForUnresolvedMarkers(
    context: AnalysisContext,
  ): Promise<CriticGap[]> {
    const gaps: CriticGap[] = [];

    // Check for TODO markers in inspected files (limited scan)
    const inspectedFiles = context.inspectedFiles ?? [];
    const filesToScan = inspectedFiles.slice(0, 30); // limit scanning

    for (const filePath of filesToScan) {
      const fullPath = filePath.startsWith("/")
        ? filePath
        : path.join(this.rootPath, filePath);

      try {
        const content = await fs.promises.readFile(fullPath, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (/TODO|FIXME|XXX|HACK/.test(line)) {
            gaps.push({
              type: "claim_not_verified",
              description: `Unresolved marker in inspected file`,
              details: `${filePath}:${i + 1} — ${line.trim().slice(0, 80)}`,
              severity: "info",
              suggestion: "Resolve or document the marker before considering analysis complete",
            });
            break; // one marker per file
          }
        }
      } catch {
        // Cannot read — skip file
      }
    }

    return gaps;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Discover all source files in the project, skipping common non-source dirs.
   */
  private async discoverSourceFiles(): Promise<string[]> {
    const files: string[] = [];
    await this.walkDir(this.rootPath, files);
    return files;
  }

  /**
   * Recursively walk a directory, collecting relative file paths.
   */
  private async walkDir(dirPath: string, files: string[]): Promise<void> {
    let entries;
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    // Add source file extensions filter
    const SOURCE_EXTS = new Set([
      ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
      ".json", ".yaml", ".yml", ".md",
      ".py", ".go", ".rs", ".java", ".kt",
      ".css", ".scss", ".less",
      ".vue", ".svelte",
      ".sql",
    ]);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          await this.walkDir(fullPath, files);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SOURCE_EXTS.has(ext)) {
          const relativePath = path.relative(this.rootPath, fullPath);
          files.push(relativePath);
        }
      }
    }
  }

  /**
   * Enrich the analysis context with gaps found, so the next iteration
   * can check if those gaps were addressed.
   */
  private enrichContextWithGaps(
    context: AnalysisContext,
    gaps: CriticGap[],
  ): AnalysisContext {
    // Build override sets from gaps so the next iteration knows
    // these were flagged and can check if coverage expanded
    const coveredDimsOverride = new Set(context.coveredDimensionsOverride ?? []);
    const inspectedFilesOverride = new Set(context.inspectedFilesOverride ?? []);

    for (const gap of gaps) {
      if (gap.type === "dimension_not_covered") {
        // Extract dimension name: "Dimension "X" not analyzed" → X
        const match = gap.description.match(/^Dimension "([^"]+)" not analyzed$/);
        if (match && match[1]) {
          coveredDimsOverride.add(match[1].toLowerCase().trim());
        }
      }
    }

    return {
      ...context,
      coveredDimensionsOverride: [...coveredDimsOverride],
      inspectedFilesOverride: [...inspectedFilesOverride],
    };
  }
}

// =============================================================================
// Context Types
// =============================================================================

/**
 * Information about what was already analyzed — passed to the critic
 * so it can determine what is missing.
 */
export interface AnalysisContext {
  /** Root path of the project. */
  rootPath: string;

  /** Dimensions that were already analyzed. */
  analyzedDimensions?: string[];

  /** Files that were inspected during analysis. */
  inspectedFiles?: string[];

  /** Agent results from previous analysis runs. */
  agentResults?: AgentResult[];

  /** Consolidated results (if available). */
  consolidatedResults?: ConsolidatedResult;

  /** Original findings grouped by dimension. */
  findings?: Finding[];

  /** Any previous critic gaps (for iteration tracking). */
  previousGaps?: CriticGap[];

  /**
   * Internal: dimensions that the critic already flagged in previous
   * iterations, used to track whether coverage expanded.
   */
  coveredDimensionsOverride?: string[];

  /**
   * Internal: files the critic already flagged in previous iterations.
   */
  inspectedFilesOverride?: string[];
}
