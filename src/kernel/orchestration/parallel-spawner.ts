// =============================================================================
// Parallel Agent Spawner
// =============================================================================
// Spawns N parallel agents via child_process.fork, each analyzing a different
// dimension of the codebase. Context is passed via temporary JSON files to
// avoid argv length limits. Results are collected, timed out individually,
// and returned for consolidation.
//
// Usage:
//   const spawner = new ParallelSpawner(rootPath);
//   const results = await spawner.spawnAgents(dimensions, config);
// =============================================================================

import { fork } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  DimensionDef,
  AgentContext,
  AgentResult,
  ConsolidatedResult,
  SpawnerConfig,
} from "./types.js";
import { computeDefaultMaxParallel } from "./dimensions.js";
import { consolidateResults } from "./result-merger.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default per-agent timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 120_000;

/** Temp directory prefix for context files. */
const TEMP_DIR_PREFIX = "devflow-analyze-";

// ---------------------------------------------------------------------------
// ParallelSpawner
// ---------------------------------------------------------------------------

export class ParallelSpawner {
  private rootPath: string;
  private tempDir: string | null = null;
  private agentRunnerPath: string;

  /**
   * @param rootPath Project root directory.
   */
  constructor(rootPath: string) {
    this.rootPath = rootPath;
    // Resolve the agent runner module path
    this.agentRunnerPath = this.resolveAgentRunnerPath();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Spawn N parallel agents, one per dimension.
   *
   * @param dimensions Array of dimension definitions to analyze.
   * @param config Override spawner configuration.
   * @returns Consolidated results from all agents.
   */
  async spawnAgents(
    dimensions: DimensionDef[],
    config?: Partial<SpawnerConfig>,
  ): Promise<ConsolidatedResult> {
    if (dimensions.length === 0) {
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

    const maxParallel =
      config?.maxParallel ?? computeDefaultMaxParallel();
    const timeoutPerAgent =
      config?.timeoutPerAgent ?? DEFAULT_TIMEOUT_MS;

    // Create temp directory for context files
    this.tempDir = await this.createTempDir();

    const startTime = performance.now();

    try {
      // Resolve relevant files for each dimension
      const dimensionFiles = await this.resolveFilesForDimensions(
        dimensions,
      );

      // Build agent contexts
      const agentContexts: AgentContext[] = dimensions.map((dim) => ({
        rootPath: this.rootPath,
        dimension: dim.name,
        relevantFiles: dimensionFiles.get(dim.name) ?? [],
        timeoutMs: timeoutPerAgent,
        runId: `${dim.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }));

      // Spawn with concurrency control
      const agentResults = await this.spawnWithConcurrencyLimit(
        agentContexts,
        maxParallel,
      );

      const endTime = performance.now();

      return consolidateResults(agentResults, startTime, endTime);
    } finally {
      // Clean up temp directory
      await this.cleanupTempDir();
    }
  }

  /**
   * Spawn a single agent (useful for one-off analysis).
   */
  async spawnSingleAgent(
    dimension: DimensionDef,
    config?: Partial<SpawnerConfig>,
  ): Promise<AgentResult> {
    const result = await this.spawnAgents([dimension], config);
    return result.agentResults[0] ?? {
      dimension: dimension.name,
      findings: [],
      durationMs: 0,
      exitCode: 1,
      error: "No result returned",
    };
  }

  // -------------------------------------------------------------------------
  // Concurrency-controlled spawning
  // -------------------------------------------------------------------------

  /**
   * Spawn agents with a configurable concurrency limit.
   * Processes contexts using a semaphore-like queue.
   */
  private async spawnWithConcurrencyLimit(
    contexts: AgentContext[],
    maxParallel: number,
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = new Array(contexts.length);
    let nextIndex = 0;

    const workers = new Array<Promise<void>>(maxParallel);
    for (let i = 0; i < maxParallel; i++) {
      workers[i] = this.workerLoop(contexts, results, () => {
        const idx = nextIndex++;
        return idx < contexts.length ? idx : null;
      });
    }

    await Promise.all(workers);
    return results;
  }

  /**
   * Worker loop: repeatedly picks the next unprocessed context,
   * spawns the agent, and stores the result.
   */
  private async workerLoop(
    contexts: AgentContext[],
    results: AgentResult[],
    nextIndex: () => number | null,
  ): Promise<void> {
    while (true) {
      const idx = nextIndex();
      if (idx === null) break;

      try {
        results[idx] = await this.spawnSingleAgentProcess(contexts[idx]!);
      } catch (err) {
        results[idx] = {
          dimension: contexts[idx]!.dimension,
          findings: [],
          durationMs: 0,
          exitCode: 1,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  // -------------------------------------------------------------------------
  // Subprocess spawning
  // -------------------------------------------------------------------------

  /**
   * Spawn a single agent process via child_process.fork.
   * Context is written to a temp JSON file — not passed via argv.
   */
  private async spawnSingleAgentProcess(
    context: AgentContext,
  ): Promise<AgentResult> {
    // Write context to temp file
    const ctxFilePath = path.join(
      this.tempDir!,
      `ctx-${context.dimension}-${context.runId}.json`,
    );
    await fs.promises.writeFile(ctxFilePath, JSON.stringify(context), "utf-8");

    return new Promise<AgentResult>((resolve) => {
      const startTime = performance.now();
      const child = fork(this.agentRunnerPath, [ctxFilePath], {
        cwd: this.rootPath,
        stdio: ["ignore", "pipe", "pipe"],
        execArgv: [], // Don't pass --inspect etc.
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      // Timeout handler
      const timeoutHandle = setTimeout(() => {
        // Kill the child process
        try {
          child.kill("SIGTERM");
          // If SIGTERM doesn't work within 2s, force kill
          setTimeout(() => {
            try {
              child.kill("SIGKILL");
            } catch { /* already dead */ }
          }, 2_000);
        } catch { /* already dead */ }

        const durationMs = Math.round(performance.now() - startTime);
        resolve({
          dimension: context.dimension,
          findings: [],
          durationMs,
          exitCode: -1,
          error: `Agent timed out after ${context.timeoutMs}ms`,
        });
      }, context.timeoutMs);

      child.on("close", (code: number | null) => {
        clearTimeout(timeoutHandle);
        const durationMs = Math.round(performance.now() - startTime);
        const exitCode = code ?? -1;

        // Parse stdout as JSON
        const trimmedStdout = stdout.trim();
        if (trimmedStdout) {
          try {
            const result = JSON.parse(trimmedStdout) as AgentResult;
            resolve(result);
            return;
          } catch {
            // Failed to parse — will use fallback below
          }
        }

        // Fallback: construct result from process metadata
        resolve({
          dimension: context.dimension,
          findings: [],
          durationMs,
          exitCode,
          error: exitCode !== 0
            ? (stderr.trim() || `Process exited with code ${exitCode}`)
            : undefined,
        });
      });

      child.on("error", (err: Error) => {
        clearTimeout(timeoutHandle);
        const durationMs = Math.round(performance.now() - startTime);
        resolve({
          dimension: context.dimension,
          findings: [],
          durationMs,
          exitCode: -1,
          error: err.message,
        });
      });
    });
  }

  // -------------------------------------------------------------------------
  // File resolution
  // -------------------------------------------------------------------------

  /**
   * For each dimension, resolve the list of files matching its glob patterns.
   * This filters the project's files so each agent only sees relevant files.
   */
  private async resolveFilesForDimensions(
    dimensions: DimensionDef[],
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();

    for (const dim of dimensions) {
      const files = await this.resolveFilesForGlobs(dim.globPatterns);
      result.set(dim.name, files);
    }

    return result;
  }

  /**
   * Resolve files matching a set of glob patterns.
   * Uses a simple recursive directory walk with pattern matching.
   */
  private async resolveFilesForGlobs(
    patterns: string[],
  ): Promise<string[]> {
    const matchedFiles = new Set<string>();

    // Walk the project directory (skip node_modules, .git, dist)
    const projectFiles = await this.walkDirectory(this.rootPath);

    for (const file of projectFiles) {
      const relativePath = path.relative(this.rootPath, file);
      for (const pattern of patterns) {
        if (this.matchGlob(relativePath, pattern)) {
          matchedFiles.add(relativePath);
          break;
        }
      }
    }

    return [...matchedFiles].sort();
  }

  /**
   * Simple glob matcher. Supports recursive (**) and
   * single-segment (*) wildcards plus exact file matching.
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    // Normalize separators
    const normalizedPath = filePath.replace(/\\/g, "/");
    const normalizedPattern = pattern.replace(/\\/g, "/");

    // If pattern starts with **/, match anywhere in the tree
    if (normalizedPattern.startsWith("**/")) {
      const suffix = normalizedPattern.slice(3);
      return this.matchSimple(normalizedPath, suffix) ||
        this.matchSuffix(normalizedPath, `/${suffix}`);
    }

    // Direct match
    return this.matchSimple(normalizedPath, normalizedPattern);
  }

  /**
   * Match a simple pattern (no **) against a path.
   */
  private matchSimple(filePath: string, pattern: string): boolean {
    // Exact match
    if (filePath === pattern) return true;

    // Convert glob pattern to regex
    const regexStr =
      "^" +
      pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]") +
      "$";

    try {
      return new RegExp(regexStr).test(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Check if a path ends with a given suffix.
   */
  private matchSuffix(filePath: string, suffix: string): boolean {
    return filePath.endsWith(suffix);
  }

  /**
   * Recursively walk a directory, returning all file paths.
   * Skips node_modules, .git, dist, .devflow, and hidden directories.
   */
  private async walkDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    const SKIP_DIRS = new Set([
      "node_modules",
      ".git",
      "dist",
      ".devflow",
      ".aiox",
      ".aiox-core",
      "coverage",
    ]);

    async function walk(dir: string): Promise<void> {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return; // Permission denied or not found — skip
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }

    await walk(dirPath);
    return files;
  }

  // -------------------------------------------------------------------------
  // Temp directory management
  // -------------------------------------------------------------------------

  /**
   * Create a temporary directory for context files.
   */
  private async createTempDir(): Promise<string> {
    const tmpBase = os.tmpdir();
    const dirPath = path.join(
      tmpBase,
      `${TEMP_DIR_PREFIX}${Date.now()}`,
    );
    fs.mkdirSync(dirPath, "0755");
    return dirPath;
  }

  /**
   * Clean up the temporary directory.
   */
  private async cleanupTempDir(): Promise<void> {
    if (!this.tempDir) return;
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true } as any);
    } catch {
      // Non-fatal cleanup failure
    }
    this.tempDir = null;
  }

  // -------------------------------------------------------------------------
  // Path resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve the absolute path to the agent runner module.
   * This works both at build time (JS) and dev time (TS via tsx).
   */
  private resolveAgentRunnerPath(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(currentDir, "agent-runner.js");
  }
}
