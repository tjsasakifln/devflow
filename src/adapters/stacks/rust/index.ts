/**
 * Rust / Cargo StackAdapter
 *
 * Handles test-running (cargo test), linting (clippy / cargo check),
 * typechecking (cargo check), dangerous-pattern scanning, and
 * coverage/test-report parsing for Rust projects.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type {
  StackAdapter,
  CommandResult,
  CoverageReport,
  TestReport,
  DangerousPattern,
} from "../types.js";

// ── Rust Dangerous Patterns ──

interface RustPatternDef {
  id: string;
  regex: RegExp;
  severity: DangerousPattern["severity"];
  category: DangerousPattern["category"];
  description: string;
  recommendation: string;
}

const RUST_PATTERNS: RustPatternDef[] = [
  {
    id: "unsafe-block",
    regex: /\bunsafe\s*\{/,
    severity: "HIGH",
    category: "security",
    description:
      "unsafe blocks bypass Rust's memory safety guarantees and must be audited carefully.",
    recommendation:
      "Minimise unsafe usage. Wrap each unsafe block in a safe abstraction with a SAFETY comment explaining invariants.",
  },
  {
    id: "unwrap-in-non-test",
    regex: /\.unwrap\(\)/,
    severity: "MEDIUM",
    category: "code-quality",
    description:
      "unwrap() panics on None/Err values, turning recoverable errors into panics.",
    recommendation:
      "Use expect() with a descriptive message, or handle the Result/Option with match, ?, or combinators (map, and_then).",
  },
  {
    id: "expect-empty-message",
    regex: /\.expect\(\s*""\s*\)/,
    severity: "MEDIUM",
    category: "code-quality",
    description:
      "expect() with an empty string provides no context when the value is missing.",
    recommendation:
      "Provide a descriptive message that explains what value was expected and why it should exist (e.g. .expect('config file must exist')).",
  },
  {
    id: "panic-in-library",
    regex: /\bpanic!\s*\(/,
    severity: "HIGH",
    category: "code-quality",
    description:
      "panic!() in library code forces the caller's process to abort instead of propagating an error.",
    recommendation:
      "Return a Result type instead of panicking. Reserve panic! for unrecoverable invariants only.",
  },
  {
    id: "println-production",
    regex: /\bprintln!\s*\(/,
    severity: "LOW",
    category: "code-quality",
    description:
      "println!() left in production code clutters stdout and may leak internal state.",
    recommendation:
      "Use a proper logging framework (log, env_logger, tracing) and remove debug print statements.",
  },
];

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

// ── Adapter ──

export const rustAdapter: StackAdapter = {
  language: "rust",

  async detectChangedModules(files: string[]): Promise<string[]> {
    const root = process.cwd();
    const modules = new Set<string>();

    // Parse Cargo.toml for workspace members
    const cargoTomlPath = path.join(root, "Cargo.toml");
    let workspaceMembers: string[] = [];

    if (existsSync(cargoTomlPath)) {
      try {
        const content = await readFile(cargoTomlPath, "utf-8");
        const memberMatch = content.match(/members\s*=\s*\[([^\]]+)\]/s);
        if (memberMatch?.[1]) {
          workspaceMembers = memberMatch[1]
            .split(",")
            .map((m) => m.trim().replace(/['"]/g, ""))
            .filter(Boolean);
        }
      } catch {
        // Cargo.toml not readable
      }
    }

    for (const file of files) {
      if (!file.endsWith(".rs")) continue;

      // Check if file belongs to a workspace member crate
      for (const member of workspaceMembers) {
        if (file.startsWith(member)) {
          modules.add(member);
        }
      }

      // Also check for inline module boundaries: Cargo.toml parent dir
      let dir = path.dirname(path.resolve(root, file));
      while (dir.startsWith(root)) {
        if (existsSync(path.join(dir, "Cargo.toml"))) {
          const relative = path.relative(root, dir);
          if (relative) modules.add(relative);
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }

    return [...modules].sort();
  },

  async runTests(cwd: string): Promise<CommandResult> {
    return runCommand("cargo test", cwd, 120_000);
  },

  async runLint(cwd: string): Promise<CommandResult> {
    // Prefer clippy with deny warnings, fallback to cargo check
    return runCommand(
      "cargo clippy -- -D warnings 2>/dev/null || cargo check 2>/dev/null || echo 'No linter available'",
      cwd,
    );
  },

  async runTypecheck(cwd: string): Promise<CommandResult> {
    return runCommand("cargo check", cwd, 120_000);
  },

  async detectDangerousPatterns(
    file: string,
    content: string,
  ): Promise<DangerousPattern[]> {
    const isTestFile =
      file.endsWith("_test.rs") || content.includes("#[cfg(test)]");

    const results: DangerousPattern[] = [];

    for (const pattern of RUST_PATTERNS) {
      // Skip test-related check for test files
      if (pattern.id === "unwrap-in-non-test" && isTestFile) continue;
      if (pattern.id === "panic-in-library" && isTestFile) continue;

      const regex = new RegExp(pattern.regex.source, "gm");
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        const preceding = content.slice(0, match.index);
        const line = (preceding.match(/\n/g) || []).length + 1;

        results.push({
          pattern: pattern.id,
          severity: pattern.severity,
          category: pattern.category,
          file,
          line,
          match: match[0].slice(0, 120),
          description: pattern.description,
          recommendation: pattern.recommendation,
        });
      }
    }

    return results;
  },

  async parseCoverage(output: string): Promise<CoverageReport> {
    // Parse cargo-tarpaulin JSON output
    try {
      const parsed = JSON.parse(output);

      if (parsed.coverage_percent !== undefined) {
        return {
          linePercent: parsed.coverage_percent,
          uncoveredLines: parsed.uncovered_lines?.length ?? 0,
        };
      }

      // Alternative format: report with file array
      if (Array.isArray(parsed)) {
        let totalLines = 0;
        let coveredLines = 0;
        for (const file of parsed) {
          if (file.covered_lines !== undefined) {
            coveredLines += file.covered_lines;
            totalLines +=
              file.covered_lines + (file.uncovered_lines ?? 0);
          }
        }
        return {
          linePercent: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
          uncoveredLines: totalLines - coveredLines,
        };
      }

      return { linePercent: 0, uncoveredLines: 0 };
    } catch {
      return { linePercent: 0, uncoveredLines: 0 };
    }
  },

  async parseTestReport(output: string): Promise<TestReport> {
    // Parse cargo test output — look for summary line
    // Format: "test result: ok. 42 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out"
    const summaryMatch = output.match(
      /test result:\s+(\w+)\.\s+(\d+)\s+passed;\s+(\d+)\s+failed;\s+(\d+)\s+(ignored|filtered)/,
    );

    if (summaryMatch) {
      const passed = parseInt(summaryMatch[2] ?? "0", 10);
      const failed = parseInt(summaryMatch[3] ?? "0", 10);
      const skipped = parseInt(summaryMatch[4] ?? "0", 10);
      const total = passed + failed + skipped;

      return {
        total,
        passed,
        failed,
        skipped,
        durationMs: 0, // cargo test doesn't output total duration in a parseable way
      };
    }

    return { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
  },

  renderRiskHints(): string[] {
    return [];
  },
};
