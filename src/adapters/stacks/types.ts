/**
 * StackAdapter — Multi-language adapter types
 *
 * Defines the contract that every language-specific adapter must implement.
 * Adapters normalise tool invocation, dangerous-pattern scanning, and
 * report parsing across language ecosystems.
 */

// ── Command Result ──

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

// ── Dangerous Pattern ──

export interface DangerousPattern {
  pattern: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category:
    | "security"
    | "architecture"
    | "code-quality"
    | "testing"
    | "dependency";
  file: string;
  line?: number;
  match: string;
  description: string;
  recommendation: string;
}

// ── Coverage ──

export interface CoverageReport {
  linePercent: number;
  branchPercent?: number;
  functionPercent?: number;
  uncoveredLines: number;
}

// ── Test Report ──

export interface TestReport {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

// ── StackAdapter Interface ──

export interface StackAdapter {
  readonly language: string;

  /** Detect which packages/modules were changed based on file paths */
  detectChangedModules(files: string[]): Promise<string[]>;

  /** Run the project's test suite */
  runTests(cwd: string): Promise<CommandResult>;

  /** Run the project's linter */
  runLint(cwd: string): Promise<CommandResult>;

  /** Run the project's type checker */
  runTypecheck(cwd: string): Promise<CommandResult>;

  /** Scan a single file for dangerous patterns */
  detectDangerousPatterns(
    file: string,
    content: string,
  ): Promise<DangerousPattern[]>;

  /** Parse coverage output into structured report */
  parseCoverage(output: string): Promise<CoverageReport>;

  /** Parse test output into structured report */
  parseTestReport(output: string): Promise<TestReport>;

  /** Render stack-specific risk hints for the report */
  renderRiskHints(
    risks: import("../../core/report-model.js").Risk[],
  ): string[];
}
