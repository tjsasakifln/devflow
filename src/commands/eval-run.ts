/**
 * Eval Runner Command
 *
 * Runs the evaluation suite and generates .devflow/evals/report.md.
 */

import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export async function runEvals(rootPath: string): Promise<void> {
  const evalsDir = path.join(rootPath, ".devflow", "evals");
  await mkdir(evalsDir, { recursive: true });

  console.log("Running Devflow evaluation suite...\n");

  // Stub: Full eval suite in Phase 8 with 30+ fixtures.
  // For now, report that evals need to be run via vitest.
  const report = [
    "# Devflow Eval Report",
    "",
    `> Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    "| Category | Count | Passed | Failed |",
    "|----------|-------|--------|--------|",
    "| State Detection | 0 | 0 | 0 |",
    "| Guard Pipeline | 0 | 0 | 0 |",
    "| DoD Checks | 0 | 0 | 0 |",
    "| Adversarial Reviews | 0 | 0 | 0 |",
    "| Actor Separation | 0 | 0 | 0 |",
    "| **Total** | **0** | **0** | **0** |",
    "",
    "## Note",
    "",
    "Full eval suite requires 30+ test fixtures in test/evals/fixtures/.",
    "Run `npm run test:e2e` after fixtures are installed.",
    "",
  ].join("\n");

  await writeFile(path.join(evalsDir, "report.md"), report);
  console.log("Eval report written to .devflow/evals/report.md");
  console.log("Run 'npm run test:e2e' for full evaluation suite.");
}
