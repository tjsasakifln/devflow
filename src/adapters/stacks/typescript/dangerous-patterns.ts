/**
 * TypeScript dangerous-pattern definitions
 *
 * Extracted and generalised from the adversarial-review module so they
 * can be reused by the TypeScript StackAdapter for per-file scanning.
 */

import type { DangerousPattern } from "../types.js";

// ── Pattern Definition ──

export interface PatternDef {
  id: string;
  regex: RegExp;
  severity: DangerousPattern["severity"];
  category: DangerousPattern["category"];
  description: string;
  recommendation: string;
}

// ── Pattern Catalogue ──

export const PATTERNS: PatternDef[] = [
  {
    id: "no-expect-in-test",
    regex: /it\(|test\(/i,
    severity: "HIGH",
    category: "testing",
    description:
      "Test case defined without an assertion — these are decorative tests that always pass.",
    recommendation:
      "Add at least one expect() call per test case, or use .toHaveAssertions() linter rule.",
  },
  {
    id: "direct-instantiation",
    regex: /\bnew\s+(?!Error\b|Date\b|Map\b|Set\b|Array\b|URL\b)[A-Z][a-zA-Z]*\(/,
    severity: "MEDIUM",
    category: "architecture",
    description:
      "Direct instantiation of a class creates hard coupling that makes testing and substitution difficult.",
    recommendation:
      "Inject dependencies via constructor or use a factory function / DI container.",
  },
  {
    id: "layer-violation",
    regex: /from\s+['"].*infrastructure.*['"]/i,
    severity: "HIGH",
    category: "architecture",
    description:
      "Domain code importing from infrastructure creates an inward dependency, violating layered architecture.",
    recommendation:
      "Define an interface in the domain layer and implement it in infrastructure. Inject the implementation.",
  },
  {
    id: "eval-usage",
    regex: /\beval\s*\(/,
    severity: "CRITICAL",
    category: "security",
    description:
      "eval() executes arbitrary code and opens the application to code-injection attacks.",
    recommendation:
      "Avoid eval() entirely. Use JSON.parse for data, Function constructor only as a last resort with strict sanitisation.",
  },
  {
    id: "sensitive-env",
    regex:
      /\bprocess\.env\.(?!CI\b|USER\b|NODE_ENV\b|PATH\b|HOME\b)[A-Z_][A-Z0-9_]*/,
    severity: "HIGH",
    category: "security",
    description:
      "Accessing environment variables at module scope can leak secrets if the module is imported before dotenv runs.",
    recommendation:
      "Access env vars lazily inside functions, or validate them at startup via a central config module.",
  },
  {
    id: "any-type",
    regex: /:\s*any\b/,
    severity: "MEDIUM",
    category: "code-quality",
    description:
      "Using `any` disables TypeScript's type checker for that value, defeating the purpose of using TypeScript.",
    recommendation:
      "Replace `any` with `unknown` (requires type narrowing) or a proper interface / type alias.",
  },
  {
    id: "ts-ignore",
    regex: /@ts-ignore\b|@ts-expect-error\b/,
    severity: "MEDIUM",
    category: "code-quality",
    description:
      "Type suppression comments hide real type errors and rot as the underlying types evolve.",
    recommendation:
      "Fix the underlying type issue. If absolutely necessary, add a comment explaining why and track a debt ticket.",
  },
  {
    id: "unhandled-promise",
    regex: /\.then\(\s*\)\s*;?\s*$|new\s+Promise\s*\(/m,
    severity: "LOW",
    category: "code-quality",
    description:
      "Unhandled promises or dangling Promise constructors can cause uncaught rejections.",
    recommendation:
      "Always attach .catch() or use async/await with try/catch. Avoid the Promise constructor pattern.",
  },
  {
    id: "hardcoded-secret",
    regex:
      /(password|secret|token|api[_-]?key|private[_-]?key)\s*[:=]\s*['"][^'"]+['"]/i,
    severity: "HIGH",
    category: "security",
    description:
      "Hardcoded credentials in source code are a common attack vector and a compliance violation.",
    recommendation:
      "Use environment variables, a secrets manager, or a .env file excluded from version control.",
  },
  {
    id: "debug-true",
    regex: /debug\s*[:=]\s*true|DEBUG\s*=\s*true/i,
    severity: "LOW",
    category: "security",
    description:
      "Debug mode left enabled in production may expose sensitive information via stack traces or verbose logging.",
    recommendation:
      "Gate debug flags behind environment checks (NODE_ENV !== 'production') or CLI flags.",
  },
];

/**
 * Scan file content against all registered patterns.
 *
 * Automatically skips patterns that are irrelevant for the file type:
 * - `no-expect-in-test` is only checked when the filename matches a test pattern.
 * - `any-type` and `layer-violation` are skipped for test files.
 * - `ts-ignore` is checked everywhere.
 */
export function scanPatterns(
  file: string,
  content: string,
): DangerousPattern[] {
  const isTestFile =
    /\.(test|spec|e2e|integ)\.(ts|tsx|js|jsx)$/.test(file);

  const results: DangerousPattern[] = [];

  for (const pattern of PATTERNS) {
    // Skip test-only patterns for non-test files
    if (pattern.id === "no-expect-in-test") {
      if (!isTestFile) continue;
      // For test files, check that expect() is *missing*
      if (/expect\s*\(/.test(content)) continue;
    }

    // Skip code-quality patterns for test files
    if (isTestFile && pattern.id === "any-type") continue;
    if (isTestFile && pattern.id === "direct-instantiation") continue;
    if (pattern.id === "layer-violation" && isTestFile) continue;

    const regex = new RegExp(pattern.regex.source, "gm");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      // Calculate line number from the match index
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
}
