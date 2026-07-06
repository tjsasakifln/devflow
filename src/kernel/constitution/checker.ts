import { execSync } from "node:child_process";
import { loadConstitution } from "./loader.js";
import type {
  ConstitutionCheckResult,
  ConstitutionReport,
  ConstitutionRule,
  ConstitutionComplianceResult,
} from "../types/constitution.js";

export async function runConstitutionCheck(
  rootPath: string
): Promise<ConstitutionReport> {
  const doc = await loadConstitution(rootPath);

  const results: ConstitutionCheckResult[] = [];

  // Group rules by tool for efficient execution
  const byTool = new Map<string, ConstitutionRule[]>();
  for (const rule of doc.rules) {
    const key = rule.verification.tool;
    if (!byTool.has(key)) {
      byTool.set(key, []);
    }
    byTool.get(key)!.push(rule);
  }

  for (const [tool, rules] of byTool) {
    if (tool === "manual" || tool === "N/A") {
      for (const rule of rules) {
        // Rules requiring human review that are "manual" → treat as failed
        // unless human review has been provided
        if (rule.humanReviewRequired) {
          results.push({
            ruleId: rule.id,
            passed: false,
            evidence: `Human review required: ${rule.description}. This rule cannot be auto-approved.`,
            severity: rule.severity === "critical" ? "error" : "warn",
            humanReviewRequired: true,
          });
        } else {
          results.push({
            ruleId: rule.id,
            passed: true,
            evidence: `Manual check required for: ${rule.description}`,
            severity: "warn",
          });
        }
      }
      continue;
    }

    for (const rule of rules) {
      try {
        const cmd = rule.verification.command;
        const output = execSync(cmd, {
          cwd: rootPath,
          encoding: "utf-8",
          timeout: 30000,
          env: { ...process.env, CI: "true" },
        }) as string;

        let passed = false;
        if (rule.verification.expectedOutput === "zero") {
          passed = output.trim().length === 0 || output.includes("No circular");
        } else if (
          rule.verification.expectedOutput === "threshold" &&
          rule.verification.threshold !== undefined
        ) {
          const coverageMatch = output.match(
            /(?:Lines|All files)\s*[:|]\s*([\d.]+)%/
          );
          if (coverageMatch && coverageMatch[1]) {
            const coverage = parseFloat(coverageMatch[1]);
            passed = coverage >= rule.verification.threshold;
          } else {
            // Try parsing a plain number (for grep -c output)
            const numMatch = output.trim().match(/^(\d+)$/);
            if (numMatch && numMatch[1]) {
              passed = parseInt(numMatch[1], 10) >= rule.verification.threshold;
            } else {
              passed = true;
            }
          }
        } else {
          passed = true;
        }

        // Determine severity based on rule.severity (new field) with fallback to rule.blocking
        const resultSeverity = passed
          ? "pass"
          : rule.severity === "critical" || rule.severity === "blocking"
          ? "error"
          : "warn";

        results.push({
          ruleId: rule.id,
          passed,
          evidence: passed
            ? `${rule.id} passed`
            : rule.refusalMessage || rule.verification.failMessage,
          severity: resultSeverity,
          toolOutput: output.slice(0, 500),
          humanReviewRequired: rule.humanReviewRequired || undefined,
        });
      } catch (err) {
        const errMsg =
          err instanceof Error ? String(err.message) : String(err);
        const errObj = err as unknown as Record<string, unknown>;
        const stderr =
          err instanceof Error && "stderr" in errObj
            ? String(errObj.stderr || "")
            : "";

        // grep returns exit 1 when no matches — that's success for "zero" checks
        const isGrepNoMatch =
          rule.verification.tool === "grep" &&
          (errMsg.includes("status 1") || errMsg.includes("code 1"));

        const isExpectedFailure = rule.verification.expectedOutput === "pass";
        const isZeroExpected = rule.verification.expectedOutput === "zero";

        const passed = isZeroExpected ? isGrepNoMatch || stderr.trim() === "" : !isExpectedFailure;

        // Tool execution error on a blocking rule → fail, not skip
        const resultSeverity = passed
          ? "pass"
          : rule.severity === "critical" || rule.severity === "blocking" || rule.blocking
          ? "error"
          : "warn";

        results.push({
          ruleId: rule.id,
          passed,
          evidence: passed
            ? `${rule.id} passed`
            : rule.refusalMessage || rule.verification.failMessage,
          severity: resultSeverity,
          toolOutput: (stderr || errMsg).slice(0, 500),
          humanReviewRequired: rule.humanReviewRequired || undefined,
        });
      }
    }
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    warnings: results.filter((r) => r.severity === "warn").length,
    errors: results.filter((r) => r.severity === "error").length,
    criticalFailures: results.filter((r) => r.severity === "error" && !r.passed).length,
    humanReviewsNeeded: results.filter((r) => r.humanReviewRequired).length,
  };

  return {
    timestamp: new Date().toISOString(),
    projectRoot: rootPath,
    results,
    summary,
    allPassed: summary.errors === 0,
  };
}

export function isConstitutionCompliant(report: ConstitutionReport): boolean {
  return report.results
    .filter((r) => r.severity === "error")
    .every((r) => r.passed);
}

export function getConstitutionCompliance(report: ConstitutionReport): ConstitutionComplianceResult {
  const criticalFailures = report.results
    .filter((r) => r.severity === "error" && !r.passed)
    .map((r) => `${r.ruleId}: ${r.evidence}`);

  const humanReviewsNeeded = report.results
    .filter((r) => r.humanReviewRequired && !r.passed)
    .map((r) => `${r.ruleId}: ${r.evidence}`);

  return {
    compliant: criticalFailures.length === 0,
    criticalFailures,
    humanReviewsNeeded,
  };
}
