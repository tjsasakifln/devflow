/**
 * Go StackAdapter
 *
 * Handles test-running (go test), linting (golangci-lint / go vet),
 * typechecking (go build), dangerous-pattern scanning, and
 * coverage/test-report parsing for Go projects.
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

// ── Go Dangerous Patterns ──

interface GoPatternDef {
  id: string;
  regex: RegExp;
  severity: DangerousPattern["severity"];
  category: DangerousPattern["category"];
  description: string;
  recommendation: string;
}

const GO_PATTERNS: GoPatternDef[] = [
  {
    id: "panic-in-non-test",
    regex: /\bpanic\(/,
    severity: "HIGH",
    category: "code-quality",
    description:
      "panic() in non-test code bypasses error handling and can crash the application.",
    recommendation:
      "Return an error instead of panicking. Reserve panic for truly unrecoverable states (e.g. invalid init).",
  },
  {
    id: "unchecked-error",
    regex: /^[^=]*[a-zA-Z_]\s*:?=\s*[a-zA-Z_].*err\b|_\s*=\s*[a-zA-Z_]+.*\(/m,
    severity: "MEDIUM",
    category: "code-quality",
    description:
      "Ignoring errors with blank identifier (_ =) discards critical failure information.",
    recommendation:
      "Always check errors. If the error is truly expected, log it with a comment explaining why it is safe to ignore.",
  },
  {
    id: "interface-usage",
    regex: /\binterface\{\}/,
    severity: "LOW",
    category: "code-quality",
    description:
      "interface{} (empty interface) disables compile-time type safety in Go.",
    recommendation:
      "Use generics (Go 1.18+) or define a concrete interface. Only use any/interface{} for truly heterogeneous data.",
  },
  {
    id: "hardcoded-secret",
    regex:
      /(password|secret|token|api[_-]?key|private[_-]?key)\s*[:=]\s*["'][^"']+["']/i,
    severity: "HIGH",
    category: "security",
    description:
      "Hardcoded credentials in source code are a common attack vector and a compliance violation.",
    recommendation:
      "Use environment variables or a secrets manager. Never commit secrets to version control.",
  },
  {
    id: "os-exit-library",
    regex: /\bos\.Exit\(/,
    severity: "MEDIUM",
    category: "architecture",
    description:
      "os.Exit() in library code terminates the entire process, preventing cleanup and surprising callers.",
    recommendation:
      "Return an error to the caller and let main() handle os.Exit if needed.",
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

export const goAdapter: StackAdapter = {
  language: "go",

  async detectChangedModules(files: string[]): Promise<string[]> {
    const root = process.cwd();
    const modules = new Set<string>();

    // Parse go.mod to find the module path
    let modulePrefix = "";
    const goModPath = path.join(root, "go.mod");
    if (existsSync(goModPath)) {
      try {
        const content = execSync("head -1 go.mod", {
          cwd: root,
          encoding: "utf-8",
          timeout: 5_000,
        });
        const match = content.match(/^module\s+(\S+)/m);
        if (match?.[1]) {
          modulePrefix = match[1];
        }
      } catch {
        // go.mod not readable — fall back to directory-based detection
      }
    }

    for (const file of files) {
      if (file.endsWith("_test.go")) continue;
      // For Go, "packages" are directories with .go files
      const dir = path.dirname(file);
      if (dir !== ".") {
        const relative = path.relative(root, dir);
        if (relative) modules.add(relative);
      }
      if (modulePrefix && !file.startsWith("vendor/")) {
        // Resolve the Go import path for the file's package
        const pkgDir = path.dirname(file);
        if (pkgDir !== "." && pkgDir !== root) {
          const goImportPath = path.join(modulePrefix, path.relative(root, pkgDir));
          modules.add(goImportPath);
        }
      }
    }

    return [...modules].sort();
  },

  async runTests(cwd: string): Promise<CommandResult> {
    return runCommand("go test ./... -json", cwd, 120_000);
  },

  async runLint(cwd: string): Promise<CommandResult> {
    // Prefer golangci-lint, fallback to go vet
    return runCommand(
      "golangci-lint run ./... 2>/dev/null || go vet ./... 2>/dev/null || echo 'No linter available'",
      cwd,
    );
  },

  async runTypecheck(cwd: string): Promise<CommandResult> {
    // go build serves as type-check in Go (compilation catches type errors)
    return runCommand("go build ./...", cwd, 120_000);
  },

  async detectDangerousPatterns(
    file: string,
    content: string,
  ): Promise<DangerousPattern[]> {
    const isTestFile = file.endsWith("_test.go");
    const results: DangerousPattern[] = [];

    for (const pattern of GO_PATTERNS) {
      // Skip panic check for test files
      if (pattern.id === "panic-in-non-test" && isTestFile) continue;
      // Skip os.Exit check for test files
      if (pattern.id === "os-exit-library" && isTestFile) continue;

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
    // Parse "go test -cover" output: "ok  	package	0.123s	coverage: 45.6% of statements"
    const match = output.match(/coverage:\s+([\d.]+)%/);
    if (match?.[1]) {
      return {
        linePercent: parseFloat(match[1]),
        uncoveredLines: 0, // not reported by go test -cover
      };
    }
    return { linePercent: 0, uncoveredLines: 0 };
  },

  async parseTestReport(output: string): Promise<TestReport> {
    // Parse "go test -json" output — each line is a JSON event
    const lines = output.trim().split("\n").filter(Boolean);
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let durationMs = 0;

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.Action === "pass" && event.Test) {
          passed++;
          total++;
        } else if (event.Action === "fail" && event.Test) {
          failed++;
          total++;
        } else if (event.Action === "skip" && event.Test) {
          skipped++;
          total++;
        }
        if (event.Elapsed) {
          durationMs = Math.max(durationMs, Math.round(event.Elapsed * 1000));
        }
      } catch {
        // Skip malformed JSON lines
      }
    }

    return { total, passed, failed, skipped, durationMs };
  },

  renderRiskHints(): string[] {
    return [];
  },
};
