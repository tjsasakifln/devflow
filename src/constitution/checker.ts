import { execSync } from "node:child_process";
import { loadConstitution } from "./loader.js";
import type {
  ConstitutionCheckResult,
  ConstitutionReport,
  ConstitutionRule,
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
        results.push({
          ruleId: rule.id,
          passed: true,
          evidence: `Manual check required for: ${rule.description}`,
          severity: "warn",
        });
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
            passed = true;
          }
        } else {
          passed = true;
        }

        results.push({
          ruleId: rule.id,
          passed,
          evidence: passed
            ? `${rule.id} passed`
            : rule.verification.failMessage,
          severity: passed ? "pass" : rule.blocking ? "error" : "warn",
          toolOutput: output.slice(0, 500),
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

        results.push({
          ruleId: rule.id,
          passed,
          evidence: passed
            ? `${rule.id} passed`
            : rule.verification.failMessage,
          severity: rule.blocking ? "error" : "warn",
          toolOutput: (stderr || errMsg).slice(0, 500),
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
