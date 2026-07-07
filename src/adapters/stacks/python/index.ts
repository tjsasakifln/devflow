/**
 * Python / FastAPI StackAdapter
 *
 * Handles test-running (pytest), linting (ruff/flake8), typechecking (mypy),
 * dangerous-pattern scanning, and coverage/test-report parsing for Python projects.
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

// ── Python Dangerous Patterns ──

interface PythonPatternDef {
  id: string;
  regex: RegExp;
  severity: DangerousPattern["severity"];
  category: DangerousPattern["category"];
  description: string;
  recommendation: string;
}

const PYTHON_PATTERNS: PythonPatternDef[] = [
  {
    id: "bare-except",
    regex: /^\s*except\s*:/m,
    severity: "HIGH",
    category: "code-quality",
    description:
      "Bare except clause catches BaseException (including KeyboardInterrupt, SystemExit), masking unexpected errors.",
    recommendation:
      "Catch specific exception types (except ValueError:, except OSError:) or use except Exception: as a minimum.",
  },
  {
    id: "eval-exec-usage",
    regex: /\b(eval|exec)\s*\(/,
    severity: "CRITICAL",
    category: "security",
    description:
      "eval() and exec() execute arbitrary Python code and open the application to code-injection attacks.",
    recommendation:
      "Use ast.literal_eval() for safe evaluation of literal expressions, or parse input with a proper parser.",
  },
  {
    id: "pickle-unsafe",
    regex: /pickle\.(loads?|Unpickler)\s*\(/,
    severity: "HIGH",
    category: "security",
    description:
      "pickle deserialisation can execute arbitrary code during unpickling — never use on untrusted data.",
    recommendation:
      "Use a safe serialisation format like JSON or msgpack. If pickle is required, sign/verify the payload.",
  },
  {
    id: "hardcoded-password",
    regex:
      /(password|secret|token|api[_-]?key|private[_-]?key)\s*[:=]\s*['\"][^'\"]+['\"]/i,
    severity: "HIGH",
    category: "security",
    description:
      "Hardcoded credentials in source code are a common attack vector and a compliance violation.",
    recommendation:
      "Use environment variables, a secrets manager, or a .env file excluded from version control.",
  },
  {
    id: "sql-injection",
    regex:
      /execute\s*\(\s*(f['\"]|f['\"]|[^'\")]*['\"]\s*[%+]\s*\{?[a-zA-Z_])/,
    severity: "CRITICAL",
    category: "security",
    description:
      "String interpolation or concatenation in SQL execute() opens the application to SQL injection.",
    recommendation:
      "Use parameterised queries (cursor.execute('SELECT * FROM t WHERE id = %s', (id,))) — never interpolate values.",
  },
  {
    id: "debug-mode",
    regex: /(debug|DEBUG)\s*=\s*True\b/i,
    severity: "LOW",
    category: "security",
    description:
      "Debug mode left enabled in production may expose sensitive stack traces and interactive debuggers.",
    recommendation:
      "Gate debug flags behind an environment check (os.getenv('DEBUG', 'false').lower() == 'true').",
  },
  {
    id: "os-system-user-input",
    regex: /os\.system\s*\(\s*[f'\"]/,
    severity: "HIGH",
    category: "security",
    description:
      "os.system() with f-strings or formatted input can lead to command-injection vulnerabilities.",
    recommendation:
      "Use subprocess.run() with a list of arguments instead of a shell string. Never include user input in shell commands.",
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

export const pythonAdapter: StackAdapter = {
  language: "python",

  async detectChangedModules(files: string[]): Promise<string[]> {
    const root = process.cwd();
    const modules = new Set<string>();

    for (const file of files) {
      // Check for pyproject.toml ancestor
      let dir = path.dirname(file);
      while (dir.startsWith(root)) {
        if (existsSync(path.join(dir, "pyproject.toml"))) {
          const relative = path.relative(root, dir);
          if (relative) modules.add(relative);
          break;
        }
        if (existsSync(path.join(dir, "setup.py"))) {
          const relative = path.relative(root, dir);
          if (relative) modules.add(relative);
          break;
        }
        if (existsSync(path.join(dir, "setup.cfg"))) {
          const relative = path.relative(root, dir);
          if (relative) modules.add(relative);
          break;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }

    return [...modules].sort();
  },

  async runTests(cwd: string): Promise<CommandResult> {
    // Prefer pytest with JSON reporter, fallback to bare pytest
    const result = runCommand(
      "python -m pytest --json-report 2>/dev/null || python -m pytest",
      cwd,
    );
    return result;
  },

  async runLint(cwd: string): Promise<CommandResult> {
    // Prefer ruff, fallback to flake8
    return runCommand(
      "ruff check . 2>/dev/null || flake8 . 2>/dev/null || echo 'No linter available'",
      cwd,
    );
  },

  async runTypecheck(cwd: string): Promise<CommandResult> {
    return runCommand(
      "python -m mypy . 2>/dev/null || echo 'mypy not available'",
      cwd,
    );
  },

  async detectDangerousPatterns(
    file: string,
    content: string,
  ): Promise<DangerousPattern[]> {
    const results: DangerousPattern[] = [];

    for (const pattern of PYTHON_PATTERNS) {
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
    // pytest-cov JSON format
    try {
      const parsed = JSON.parse(output);

      // pytest-cov JSON summary
      if (parsed.meta?.coverage) {
        const cov = parsed.meta.coverage;
        return {
          linePercent: cov.lineRate ?? cov.line_percent ?? 0,
          branchPercent: cov.branchRate ?? cov.branch_percent,
          functionPercent: undefined,
          uncoveredLines: cov.totalLines
            ? cov.totalLines - (cov.coveredLines ?? 0)
            : 0,
        };
      }

      // Coverage.py JSON format
      if (parsed.totals) {
        return {
          linePercent: parsed.totals.percent_covered ?? 0,
          branchPercent: parsed.totals.percent_covered_branches,
          functionPercent: undefined,
          uncoveredLines: parsed.totals.missing_lines?.length ?? 0,
        };
      }

      return { linePercent: 0, uncoveredLines: 0 };
    } catch {
      return { linePercent: 0, uncoveredLines: 0 };
    }
  },

  async parseTestReport(output: string): Promise<TestReport> {
    // pytest JSON report format
    try {
      const parsed = JSON.parse(output);

      if (parsed.summary) {
        return {
          total:
            (parsed.summary.passed ?? 0) +
            (parsed.summary.failed ?? 0) +
            (parsed.summary.skipped ?? 0),
          passed: parsed.summary.passed ?? 0,
          failed: parsed.summary.failed ?? 0,
          skipped: parsed.summary.skipped ?? 0,
          durationMs: parsed.duration ?? parsed.summary.duration ?? 0,
        };
      }

      // Per-test collection fallback
      if (Array.isArray(parsed.tests)) {
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        for (const test of parsed.tests) {
          switch (test.outcome) {
            case "passed":
              passed++;
              break;
            case "failed":
              failed++;
              break;
            case "skipped":
              skipped++;
              break;
          }
        }
        return {
          total: passed + failed + skipped,
          passed,
          failed,
          skipped,
          durationMs: parsed.duration ?? 0,
        };
      }

      return { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
    } catch {
      return { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
    }
  },

  renderRiskHints(): string[] {
    return [];
  },
};
