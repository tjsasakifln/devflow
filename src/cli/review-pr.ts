/**
 * Devflow CLI — Review-PR Command (thinned)
 *
 * Thin CLI wrapper that delegates to core audit engine and renderers.
 * Backward compatible: --json maps to --format json.
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

export async function reviewPrCommand(
  cwd: string,
  options: { base?: string; output?: string; format?: string; json?: boolean; riskTolerance?: string },
): Promise<void> {
  // Backward compat: --json flag maps to --format json
  const format = options.json ? "json" : (options.format ?? "markdown");
  const base = options.base ?? "main";
  const tolerance = (options.riskTolerance as "relaxed" | "moderate" | "strict" | undefined) ?? undefined;

  // Banner to stderr when JSON stdout to keep stdout clean for piping
  const isJsonStdout = format === "json" && !options.output;
  const banner = (msg: string) => {
    if (isJsonStdout) console.error(msg);
    else console.log(msg);
  };

  banner(pc.bold("\n📋 Devflow PR Review\n"));
  banner(pc.dim(`Reviewing changes against ${base}...\n`));

  const opts: AuditOptions = { cwd, base, riskTolerance: tolerance };
  const report = await runAudit(opts);

  // Render based on format
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
    process.stdout.write(output);
    if (format !== "json") process.stdout.write("\n");
  }

  // Terminal summary — to stderr when JSON stdout
  const log = isJsonStdout ? console.error : console.log;
  const emoji = VERDICT_EMOJI[report.verdict] ?? "❓";
  const verdictColor =
    report.verdict === "PASS"
      ? pc.green
      : report.verdict === "WARN"
        ? pc.yellow
        : pc.red;

  log("");
  log(pc.bold(`${emoji} Verdict: ${verdictColor(report.verdict)}`));
  log(pc.dim(report.executiveSummary));
  log("");

  if (report.verdict === "PASS") {
    log(
      pc.green("This branch is recommended for human review. Evidence chain complete.\n"),
    );
  } else if (report.verdict === "WARN") {
    log(
      pc.yellow("This branch needs more evidence before review. Address risks above.\n"),
    );
  } else {
    log(
      pc.red("This branch is BLOCKED. Fix blocking issues before requesting review.\n"),
    );
  }
}
