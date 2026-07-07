/**
 * TypeScript / JavaScript StackAdapter
 *
 * Handles test-running, linting, typechecking, dangerous-pattern scanning,
 * and coverage/test-report parsing for Node.js / TS projects.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import type {
  StackAdapter,
  CommandResult,
  CoverageReport,
  TestReport,
  DangerousPattern,
} from "../types.js";
import { scanPatterns } from "./dangerous-patterns.js";

// ── Helpers ──

function runCommand(
  command: string,
  cwd: string,
  timeout = 60_000,
): CommandResult {
  const start = Date.now();
  try {
    const output = execSync(command, {
      cwd,
      encoding: "utf-8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      success: true,
      stdout: output,
      stderr: "",
      exitCode: 0,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const error = err as {
      status?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      success: false,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message ?? String(err),
      exitCode: error.status ?? 1,
      durationMs: Date.now() - start,
    };
  }
}

function findPackageJsonAncestor(filePath: string, root: string): string | null {
  let dir = path.dirname(filePath);
  while (dir.startsWith(root)) {
    const pkgPath = path.join(dir, "package.json");
    if (existsSync(pkgPath)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

// ── Adapter ──

export const typescriptAdapter: StackAdapter = {
  language: "typescript",

  async detectChangedModules(files: string[]): Promise<string[]> {
    const root = process.cwd();
    const packages = new Set<string>();

    for (const file of files) {
      const pkgDir = findPackageJsonAncestor(file, root);
      if (pkgDir && pkgDir !== root) {
        packages.add(path.relative(root, pkgDir));
      }
    }

    return [...packages].sort();
  },

  async runTests(cwd: string): Promise<CommandResult> {
    // Try vitest, jest, then npm test as fallback
    const commands = ["npx vitest run", "npx jest", "npm test"];
    for (const cmd of commands) {
      // Quick check if the tool is available
      const toolName = cmd.split(" ")[0] ?? "";
      if (toolName !== "npm") {
        try {
          execSync(`${toolName} --version 2>/dev/null`, {
            cwd,
            encoding: "utf-8",
            timeout: 5_000,
          });
        } catch {
          continue; // tool not installed, try next
        }
      }
      return runCommand(cmd, cwd);
    }
    return {
      success: false,
      stdout: "",
      stderr: "No test runner found (tried vitest, jest, npm test)",
      exitCode: 1,
      durationMs: 0,
    };
  },

  async runLint(cwd: string): Promise<CommandResult> {
    // Prefer eslint, fallback to tsc --noEmit for bare type checking
    try {
      execSync("npx eslint --version 2>/dev/null", {
        cwd,
        encoding: "utf-8",
        timeout: 5_000,
      });
    } catch {
      return {
        success: false,
        stdout: "",
        stderr: "eslint not available",
        exitCode: 1,
        durationMs: 0,
      };
    }
    return runCommand("npx eslint src/", cwd);
  },

  async runTypecheck(cwd: string): Promise<CommandResult> {
    return runCommand("npx tsc --noEmit", cwd);
  },

  async detectDangerousPatterns(
    file: string,
    content: string,
  ): Promise<DangerousPattern[]> {
    return scanPatterns(file, content);
  },

  async parseCoverage(output: string): Promise<CoverageReport> {
    try {
      const parsed = JSON.parse(output);
      // Supports both vitest JSON and jest JSON coverage reporters
      const totals = parsed.total ?? parsed;
      return {
        linePercent: totals.lines?.pct ?? totals.lines?.percent ?? 0,
        branchPercent: totals.branches?.pct ?? totals.branches?.percent,
        functionPercent: totals.functions?.pct ?? totals.functions?.percent,
        uncoveredLines: totals.lines?.covered
          ? (totals.lines.total ?? 0) - totals.lines.covered
          : 0,
      };
    } catch {
      return { linePercent: 0, uncoveredLines: 0 };
    }
  },

  async parseTestReport(output: string): Promise<TestReport> {
    try {
      const parsed = JSON.parse(output);

      // Vitest JSON reporter format
      if (parsed.testResults) {
        let total = 0;
        let passed = 0;
        let failed = 0;
        let skipped = 0;

        for (const file of parsed.testResults) {
          for (const assertion of file.assertionResults ?? []) {
            total++;
            switch (assertion.status) {
              case "passed":
                passed++;
                break;
              case "failed":
                failed++;
                break;
              case "pending":
              case "skipped":
                skipped++;
                break;
            }
          }
        }

        return {
          total,
          passed,
          failed,
          skipped,
          durationMs: parsed.testResults.reduce(
            (acc: number, r: { endTime?: number; startTime?: number }) =>
              acc + ((r.endTime ?? 0) - (r.startTime ?? 0)),
            0,
          ),
        };
      }

      // Jest JSON output format
      if (parsed.numTotalTests !== undefined) {
        return {
          total: parsed.numTotalTests,
          passed: parsed.numPassedTests,
          failed: parsed.numFailedTests,
          skipped: parsed.numPendingTests ?? parsed.numSkippedTests ?? 0,
          durationMs: parsed.testResults?.reduce(
            (acc: number, r: { duration?: number }) =>
              acc + (r.duration ?? 0),
            0,
          ) ?? 0,
        };
      }

      return { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
    } catch {
      return { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
    }
  },

  renderRiskHints(): string[] {
    // Stack-specific risk hints are TBD
    return [];
  },
};
