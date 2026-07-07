/**
 * Devflow CLI — Audit Command
 *
 * Zero-friction local audit for AI-generated code risks.
 * No feature setup required — works on staged, working tree, or vs base.
 */

import { runAudit } from "../core/audit-engine.js";
import type { AuditOptions } from "../core/report-model.js";
import { renderMarkdownReport } from "../renderers/markdown.js";
import { renderHtmlReport } from "../renderers/html.js";
import { renderJsonReport } from "../renderers/json.js";
import pc from "picocolors";
import fs from "node:fs";

const VERDICT_EMOJI: Record<string, string> = {
  PASS: "✅",
  WARN: "⚠️",
  FAIL: "❌",
  BLOCKED: "🚫",
};

export async function auditCommand(
  cwd: string,
  options: {
    staged?: boolean;
    workingTree?: boolean;
    base?: string;
    format?: string;
    output?: string;
    riskTolerance?: string;
  },
): Promise<void> {
  // 1. Banner
  console.log(pc.bold("\n🔍 Devflow Audit — Local AI Code Review\n"));

  // 2. Show what's being audited
  if (options.staged) {
    console.log(pc.dim("Auditing staged changes only...\n"));
  } else if (options.workingTree) {
    console.log(pc.dim("Auditing working tree (unstaged changes)...\n"));
  } else {
    console.log(
      pc.dim(`Auditing changes against base branch '${options.base ?? "main"}'...\n`),
    );
  }

  // 3. Run audit
  const opts: AuditOptions = {
    cwd,
    base: options.base ?? "main",
    staged: options.staged,
    workingTree: options.workingTree,
    riskTolerance: options.riskTolerance as AuditOptions["riskTolerance"],
  };

  const report = await runAudit(opts);

  // 4. Render based on --format flag
  const format = options.format ?? "markdown";
  let output: string;

  switch (format) {
    case "html":
      output = renderHtmlReport(report);
      break;
    case "json":
      output = renderJsonReport(report);
      break;
    default:
      output = renderMarkdownReport(report);
  }

  if (options.output) {
    fs.writeFileSync(options.output, output, "utf-8");
    console.log(pc.green(`✅ Report written to ${options.output}\n`));
  } else {
    console.log(output);
  }

  // 5. Terminal summary with colored verdict
  const emoji = VERDICT_EMOJI[report.verdict] ?? "❓";
  const verdictColor =
    report.verdict === "PASS"
      ? pc.green
      : report.verdict === "WARN"
        ? pc.yellow
        : pc.red;

  console.log("");
  console.log(pc.bold(`${emoji} Verdict: ${verdictColor(report.verdict)}`));
  console.log(pc.dim(report.executiveSummary));

  const m = report.severityMatrix;
  if (m.critical > 0 || m.high > 0 || m.medium > 0 || m.low > 0) {
    console.log(
      pc.dim(`  Critical: ${m.critical}  High: ${m.high}  Medium: ${m.medium}  Low: ${m.low}`),
    );
  }
  console.log("");

  // 6. BLOCKED → exit code 1 (for CI/git hook use)
  if (report.verdict === "BLOCKED") {
    console.log(pc.red("🚫 BLOCKED: Fix blocking issues before proceeding.\n"));
    process.exit(1);
  }

  // 7. FAIL + strict mode → exit code 1
  if (report.verdict === "FAIL" && report.metadata.executionMode === "strict") {
    console.log(pc.red("❌ FAIL: Blocking risks found in strict mode.\n"));
    process.exit(1);
  }
}
