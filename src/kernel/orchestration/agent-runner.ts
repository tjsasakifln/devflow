#!/usr/bin/env node
// =============================================================================
// Parallel Agent Spawner — Agent Runner (Fork Entry Point)
// =============================================================================
// This file is executed via child_process.fork for each parallel agent.
// It receives a context file path as the first argument, reads it, performs
// analysis on the dimension's relevant files, and writes JSON results to stdout.
//
// Usage (do not invoke directly — called by parallel-spawner.ts):
//   node agent-runner.js <context-file-path>
// =============================================================================

import fs from "node:fs/promises";
import type { AgentContext, Finding, AgentResult } from "./types.js";

/**
 * Entry point for forked agent processes.
 *
 * Reads the context from a temp JSON file, runs the analysis
 * for the dimension, and outputs results as JSON on stdout.
 */
async function main(): Promise<void> {
  const contextFilePath = process.argv[2];

  if (!contextFilePath) {
    writeError("Missing context file path argument");
    process.exit(1);
  }

  let context: AgentContext;
  try {
    const raw = await fs.readFile(contextFilePath, "utf-8");
    context = JSON.parse(raw) as AgentContext;
  } catch (err) {
    writeError(
      `Failed to read context file: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const startTime = performance.now();

  try {
    const findings = await analyzeDimension(context);
    const durationMs = Math.round(performance.now() - startTime);

    const result: AgentResult = {
      dimension: context.dimension,
      findings,
      durationMs,
      exitCode: 0,
    };

    // Write result as JSON to stdout (parent reads this)
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exit(0);
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    const errorMessage =
      err instanceof Error ? err.message : String(err);

    const result: AgentResult = {
      dimension: context.dimension,
      findings: [],
      durationMs,
      exitCode: 1,
      error: errorMessage,
    };

    // Write partial result with error
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exit(1);
  }
}

/**
 * Analyze files for a given dimension.
 *
 * For each relevant file, checks file size, character encoding issues,
 * and line count. Real agent implementations would perform deep semantic
 * analysis — this is the foundation layer.
 */
async function analyzeDimension(
  context: AgentContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const dimension = context.dimension;

  for (const filePath of context.relevantFiles) {
    try {
      const fullPath = filePath.startsWith("/")
        ? filePath
        : `${context.rootPath}/${filePath}`;

      const stat = await fs.stat(fullPath).catch(() => null);
      if (!stat) continue; // File doesn't exist or is inaccessible

      // File-level check: report large files
      if (stat.size > 1_000_000) {
        // > 1MB
        findings.push({
          file: filePath,
          line: 0,
          severity: "warning",
          message: `Large file (${Math.round(stat.size / 1024)}KB) — split or lazy-load recommended`,
          dimension,
        });
      }

      // For text files, check line count
      if (
        filePath.endsWith(".ts") ||
        filePath.endsWith(".tsx") ||
        filePath.endsWith(".js") ||
        filePath.endsWith(".jsx") ||
        filePath.endsWith(".md") ||
        filePath.endsWith(".json") ||
        filePath.endsWith(".yaml") ||
        filePath.endsWith(".yml")
      ) {
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const lines = content.split("\n").length;

          if (lines > 500) {
            findings.push({
              file: filePath,
              line: 0,
              severity: "info",
              message: `Long file (${lines} lines) — consider refactoring`,
              dimension,
            });
          }

          // Dimension-specific analysis
          const dimFindings = await runDimensionSpecificCheck(
            dimension,
            filePath,
            content,
            lines,
          );
          findings.push(...dimFindings);
        } catch {
          // Binary file or encoding issue — skip content analysis
        }
      }
    } catch {
      // Skip files that can't be accessed
    }
  }

  return findings;
}

/**
 * Run dimension-specific checks on a file's content.
 */
async function runDimensionSpecificCheck(
  dimension: string,
  filePath: string,
  content: string,
  lineCount: number,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  switch (dimension) {
    case "security": {
      // Check for hardcoded secrets
      const secretPatterns = [
        /(?:api[_-]?key|apikey|secret|password|passwd|token)\s*[:=]\s*["'][^"'\s]{8,}["']/gi,
        /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
        /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g,
        /sk-[A-Za-z0-9]{32,}/g,
      ];

      for (const pattern of secretPatterns) {
        const match = content.match(pattern);
        if (match) {
          // Find the line number
          const lineNum = findLineNumber(content, match.index ?? 0);
          findings.push({
            file: filePath,
            line: lineNum,
            severity: "critical",
            message: `Potential secret/credential detected: ${match[0]!.slice(0, 20)}...`,
            dimension,
          });
        }
      }
      break;
    }

    case "performance": {
      // Check for N+1 query patterns
      if (content.includes(".findMany") || content.includes(".findAll")) {
        const loopPatterns = [
          /for\s*\(/g,
          /\.forEach\(/g,
          /\.map\(/g,
          /for\s+of/g,
        ];
        for (const pattern of loopPatterns) {
          const matches = content.match(pattern);
          if (matches && matches.length > 3) {
            const lineNum = findLineNumber(content, content.search(pattern));
            findings.push({
              file: filePath,
              line: lineNum,
              severity: "warning",
              message:
                "Query inside loop detected — potential N+1 performance issue",
              dimension,
            });
          }
        }
      }

      // Check for large arrays in hot paths
      if (lineCount > 300 && content.includes("const ")) {
        findings.push({
          file: filePath,
          line: 0,
          severity: "info",
          message: "Large module — check for unnecessary re-renders or computations",
          dimension,
        });
      }
      break;
    }

    case "architecture": {
      // Check for circular dependency indicators
      if (content.includes("import") && content.includes("../")) {
        const deepImports = content.match(/from ['"]\.\.\/\.\.\//g);
        if (deepImports && deepImports.length > 5) {
          const lineNum = findLineNumber(content, content.search(/from ['"]\.\.\/\.\.\//));
          findings.push({
            file: filePath,
            line: lineNum,
            severity: "warning",
            message:
              `Deep relative imports (${deepImports.length}x) — consider barrel exports or path aliases`,
            dimension,
          });
        }
      }

      // Check for overly long functions (simple heuristic)
      const exportFnMatches = content.match(/export (async )?function/g);
      if (exportFnMatches && exportFnMatches.length > 10) {
        findings.push({
          file: filePath,
          line: 0,
          severity: "info",
          message: `File exports ${exportFnMatches.length} functions — consider splitting`,
          dimension,
        });
      }
      break;
    }

    case "tests": {
      // Check for test file patterns
      const describeCount = (content.match(/describe\(/g) || []).length;
      const itCount = (content.match(/\bit\(/g) || []).length;
      const testCount = (content.match(/\btest\(/g) || []).length;

      if (describeCount === 0 && itCount === 0 && testCount === 0 &&
          (filePath.endsWith(".test.ts") || filePath.endsWith(".spec.ts"))) {
        findings.push({
          file: filePath,
          line: 0,
          severity: "warning",
          message: "Test file appears to have no test cases",
          dimension,
        });
      }

      // Check for missing assertions
      if (itCount > 0 || testCount > 0) {
        const expectCount = (content.match(/expect\(/g) || []).length;
        const assertCount = (content.match(/assert\./g) || []).length;
        if (expectCount + assertCount < itCount + testCount) {
          findings.push({
            file: filePath,
            line: 0,
            severity: "warning",
            message: `Possible missing assertions (${itCount + testCount} tests, ${expectCount + assertCount} assertions)`,
            dimension,
          });
        }
      }
      break;
    }

    case "docs": {
      // Check for common doc quality issues
      if (filePath.endsWith(".md")) {
        const lines = content.split("\n");
        // Check for TODO markers
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (line.includes("TODO") || line.includes("FIXME") || line.includes("XXX")) {
            findings.push({
              file: filePath,
              line: i + 1,
              severity: "info",
              message: `Unresolved marker: ${line.trim().slice(0, 60)}`,
              dimension,
            });
            break; // One finding per doc for TODO
          }
        }

        // Check for broken anchor references
        const brokenRefs = content.match(/\[.*\]\(#(?!.*\))/g);
        if (brokenRefs) {
          findings.push({
            file: filePath,
            line: 0,
            severity: "warning",
            message: `${brokenRefs.length} internal anchor references — verify they exist`,
            dimension,
          });
        }
      }
      break;
    }

    case "deps": {
      // Dependency analysis
      if (filePath === "package.json") {
        try {
          const pkg = JSON.parse(content);
          const deps = {
            ...(pkg.dependencies ?? {}),
            ...(pkg.devDependencies ?? {}),
          };
          const depCount = Object.keys(deps).length;

          if (depCount > 100) {
            findings.push({
              file: filePath,
              line: 0,
              severity: "warning",
              message: `Large dependency set (${depCount} packages) — audit for unused deps`,
              dimension,
            });
          }

          // Check for outdated patterns
          if (deps["lodash"]) {
            findings.push({
              file: filePath,
              line: 0,
              severity: "info",
              message: `lodash@${deps["lodash"]} detected — consider native alternatives`,
              dimension,
            });
          }
        } catch {
          // Invalid package.json
        }
      }

      // Check import statements
      if (
        filePath.endsWith(".ts") &&
        !filePath.endsWith(".d.ts") &&
        content.includes("import")
      ) {
        const externalImports = content.match(/from ["'][^./][^"']*["']/g);
        if (externalImports && externalImports.length > 30) {
          findings.push({
            file: filePath,
            line: 0,
            severity: "info",
            message: `File has ${externalImports.length} external imports — consider reducing coupling`,
            dimension,
          });
        }
      }
      break;
    }
  }

  return findings;
}

/**
 * Find the line number for a given character index in a string.
 */
function findLineNumber(content: string, charIndex: number): number {
  const before = content.slice(0, charIndex);
  return before.split("\n").length;
}

/**
 * Write an error message as JSON to stderr.
 */
function writeError(message: string): void {
  const error = JSON.stringify({ error: message });
  process.stderr.write(error + "\n");
}

// Execute if this is the main module (forked or invoked directly)
main();
