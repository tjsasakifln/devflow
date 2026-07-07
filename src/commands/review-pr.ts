/**
 * Devflow Review-PR Command
 *
 * Generates a markdown risk report for the current branch vs base branch.
 * Designed to be pasted into PR descriptions or attached as review evidence.
 *
 * Answers: what changed, which feature justifies it, what evidence exists,
 * which gates passed, what risks remain, and whether the branch is
 * recommended for human review.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { captureGitContext } from "../kernel/utils/git-context.js";
import { detectStackProfile } from "../kernel/detection/stack.js";
import { fileExists, safeReadFile } from "../kernel/utils/fs.js";
import { getVersion } from "../kernel/utils/version.js";
import pc from "picocolors";

interface ChangedFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "unknown";
}

interface ArtifactPresence {
  name: string;
  path: string;
  exists: boolean;
  riskIfMissing: string;
}

interface PrRiskReport {
  branch: string;
  base: string;
  timestamp: string;
  commitSha: string;
  featureId: string | null;
  changedFiles: ChangedFile[];
  artifacts: ArtifactPresence[];
  implementationLogEntries: number;
  adversarialReviewExists: boolean;
  adversarialReviewVerdict: string | null;
  gatekeepApproved: boolean;
  filesOutOfScope: string[];
  testFramework: string | null;
  typeChecker: string | null;
  risks: string[];
  verdict: "RECOMMENDED" | "NEEDS EVIDENCE" | "BLOCKED";
  verdictReason: string;
}

function runGit(args: string, cwd: string): string {
  try {
    return execSync(`git ${args}`, { cwd, encoding: "utf-8", timeout: 15000 }).trim();
  } catch {
    return "";
  }
}

function parseChangedFiles(diffOutput: string): ChangedFile[] {
  if (!diffOutput.trim()) return [];
  return diffOutput
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.split("\t");
      const statusCode = parts[0]?.trim() ?? "";
      const filePath = parts[1]?.trim() ?? parts[0]?.trim() ?? "";
      let status: ChangedFile["status"] = "unknown";
      if (statusCode.startsWith("A")) status = "added";
      else if (statusCode.startsWith("M")) status = "modified";
      else if (statusCode.startsWith("D")) status = "deleted";
      else if (statusCode.startsWith("R")) status = "renamed";
      return { path: filePath, status };
    });
}

async function buildRiskReport(
  cwd: string,
  base: string,
): Promise<PrRiskReport> {
  const git = captureGitContext(cwd);
  const stack = await detectStackProfile(cwd);

  // Get branch
  const branch = runGit("branch --show-current", cwd) || "unknown";

  // Get changed files
  const mergeBase = runGit(`merge-base ${base} HEAD`, cwd);
  const diffBase = mergeBase || base;
  const nameStatus = runGit(`diff --name-status ${diffBase}..HEAD`, cwd);
  const changedFiles = parseChangedFiles(nameStatus);

  // Feature detection
  let featureId: string | null = null;
  let artifacts: ArtifactPresence[] = [];
  let implementationLogEntries = 0;
  let adversarialReviewExists = false;
  let adversarialReviewVerdict: string | null = null;
  let gatekeepApproved = false;

  try {
    const activeFeatureRaw = await safeReadFile(
      path.join(cwd, ".devflow", "active-feature.json"),
    );
    if (activeFeatureRaw) {
      const active = JSON.parse(activeFeatureRaw);
      featureId = active.featureId ?? null;

      if (featureId) {
        const featureDir = path.join(cwd, "_devflow", "features", featureId);

        // Check artifacts
        const artifactDefs: Array<{
          name: string;
          file: string;
          riskIfMissing: string;
        }> = [
          {
            name: "requirements.md",
            file: "requirements.md",
            riskIfMissing: "No functional target defined for AI or human implementer",
          },
          {
            name: "roadmap.md",
            file: "roadmap.md",
            riskIfMissing: "Architecture constraints not documented — AI may violate layer boundaries",
          },
          {
            name: "actions.md",
            file: "actions.md",
            riskIfMissing: "No task breakdown — implementation ordering is arbitrary",
          },
          {
            name: "test-plan.md",
            file: "test-plan.md",
            riskIfMissing: "No test strategy — AI-generated tests may be decorative",
          },
          {
            name: "implementation-log.jsonl",
            file: "implementation-log.jsonl",
            riskIfMissing: "No audit trail — cannot verify who did what or when",
          },
          {
            name: "legacy-impact.md",
            file: "legacy-impact.md",
            riskIfMissing:
              "No analysis of how this change affects existing code (brownfield risk)",
          },
        ];

        artifacts = await Promise.all(
          artifactDefs.map(async (a) => ({
            name: a.name,
            path: path.join(featureDir, a.file),
            exists: await fileExists(path.join(featureDir, a.file)),
            riskIfMissing: a.riskIfMissing,
          })),
        );

        // Count implementation log entries
        const logPath = path.join(featureDir, "implementation-log.jsonl");
        const logContent = await safeReadFile(logPath);
        if (logContent && logContent.trim()) {
          implementationLogEntries = logContent
            .split("\n")
            .filter((l) => l.trim()).length;
        }

        // Check adversarial review
        const arPath = path.join(
          cwd,
          ".devflow",
          "audits",
          featureId,
          "adversarial-review.md",
        );
        adversarialReviewExists = await fileExists(arPath);
        if (adversarialReviewExists) {
          const arContent = await safeReadFile(arPath);
          if (arContent) {
            const verdictMatch = arContent.match(
              /\*\*Overall:\*\*\s*(PASS|FAIL|INCONCLUSIVE)/i,
            );
            adversarialReviewVerdict = verdictMatch?.[1]?.toUpperCase() ?? null;
          }
        }

        // Check gatekeep log
        const gkPath = path.join(cwd, ".devflow", "audits", "gatekeep-log.jsonl");
        if (await fileExists(gkPath)) {
          const gkContent = await safeReadFile(gkPath);
          if (gkContent) {
            gatekeepApproved = gkContent
              .split("\n")
              .filter((l) => l.trim())
              .some((l) => {
                try {
                  const entry = JSON.parse(l);
                  return (
                    entry.featureId === featureId &&
                    entry.decision === "approved"
                  );
                } catch {
                  return false;
                }
              });
          }
        }
      }
    }
  } catch {
    // Feature detection is best-effort
  }

  // Check for files out of scope
  const filesOutOfScope: string[] = [];
  const featureArtifactDirs = ["_devflow/", ".devflow/", "DEVFLOW.md"];
  for (const f of changedFiles) {
    // Skip devflow internal files and configs
    if (featureArtifactDirs.some((d) => f.path.startsWith(d))) continue;
    if (
      f.path === "package-lock.json" ||
      f.path === "yarn.lock" ||
      f.path === "pnpm-lock.yaml"
    )
      continue;
  }

  // Build risks
  const risks: string[] = [];

  const missingArtifacts = artifacts.filter((a) => !a.exists);
  if (missingArtifacts.length > 0) {
    risks.push(
      `Missing ${missingArtifacts.length} artifacts: ${missingArtifacts.map((a) => a.name).join(", ")}`,
    );
  }

  if (implementationLogEntries === 0 && featureId) {
    risks.push(
      "No implementation log entries — cannot verify what was actually done",
    );
  }

  if (!adversarialReviewExists && featureId) {
    risks.push(
      "Adversarial review not run — bypass vectors not checked",
    );
  }

  if (!gatekeepApproved && featureId) {
    risks.push(
      "Gatekeep not approved — no independent review of this change",
    );
  }

  if (!stack.testFramework && changedFiles.length > 0) {
    risks.push(
      "No test framework detected — cannot verify test execution",
    );
  }

  if (git.gitStatus === "dirty") {
    risks.push(
      "Working tree is dirty — uncommitted changes not reflected in diff",
    );
  }

  // Determine verdict
  let verdict: PrRiskReport["verdict"] = "RECOMMENDED";
  let verdictReason = "";

  const blockingRisks: string[] = [];

  if (!featureId) {
    blockingRisks.push("No active feature — change has no declared scope");
  }

  if (missingArtifacts.some((a) => ["requirements.md", "actions.md"].includes(a.name))) {
    blockingRisks.push("Core artifacts missing (requirements.md or actions.md)");
  }

  if (implementationLogEntries === 0 && featureId) {
    blockingRisks.push("No implementation log entries");
  }

  if (!adversarialReviewExists && featureId) {
    blockingRisks.push("Adversarial review not run");
  }

  if (blockingRisks.length >= 3) {
    verdict = "BLOCKED";
    verdictReason = blockingRisks.join("; ") + ".";
  } else if (blockingRisks.length > 0 || risks.length >= 3) {
    verdict = "NEEDS EVIDENCE";
    verdictReason =
      blockingRisks.length > 0
        ? blockingRisks.join("; ") + "."
        : risks.join("; ") + ".";
  } else {
    verdictReason = "All gates passed. Evidence chain complete.";
  }

  return {
    branch,
    base,
    timestamp: new Date().toISOString(),
    commitSha: git.commitSha,
    featureId,
    changedFiles,
    artifacts,
    implementationLogEntries,
    adversarialReviewExists,
    adversarialReviewVerdict,
    gatekeepApproved,
    filesOutOfScope,
    testFramework: stack.testFramework ?? null,
    typeChecker: stack.typeChecker ?? null,
    risks,
    verdict,
    verdictReason,
  };
}

function renderMarkdownReport(report: PrRiskReport): string {
  const lines: string[] = [];

  lines.push(`# PR Risk Report — ${report.branch} → ${report.base}`);
  lines.push("");
  lines.push(
    `> **Generated:** ${report.timestamp} | **Commit:** \`${report.commitSha.slice(0, 8)}\` | **Devflow:** v${getVersion()}`,
  );
  lines.push("");

  // Verdict banner
  const verdictEmoji =
    report.verdict === "RECOMMENDED"
      ? "✅"
      : report.verdict === "NEEDS EVIDENCE"
        ? "⚠️"
        : "🚫";
  lines.push(`## Verdict: ${verdictEmoji} ${report.verdict}`);
  lines.push("");
  lines.push(`> ${report.verdictReason}`);
  lines.push("");

  // Feature
  lines.push("## Feature");
  lines.push("");
  if (report.featureId) {
    lines.push(`**Active feature:** \`${report.featureId}\``);
    lines.push(
      `**Justification:** This PR implements changes scoped to feature \`${report.featureId}\`.`,
    );
  } else {
    lines.push(
      "**No active feature.** This branch has no declared Devflow feature. Changes have no documented scope.",
    );
  }
  lines.push("");

  // What changed
  lines.push("## What Changed");
  lines.push("");
  if (report.changedFiles.length === 0) {
    lines.push("No files changed (or diff unavailable).");
  } else {
    lines.push(
      `| Status | File |`,
    );
    lines.push(`|--------|------|`);
    for (const f of report.changedFiles) {
      const icon =
        f.status === "added"
          ? "➕"
          : f.status === "modified"
            ? "✏️"
            : f.status === "deleted"
              ? "🗑️"
              : "❓";
      lines.push(`| ${icon} ${f.status} | \`${f.path}\` |`);
    }
  }
  lines.push("");

  // Artifact health
  lines.push("## Artifact Health");
  lines.push("");
  if (report.artifacts.length === 0) {
    lines.push("No feature artifacts to check.");
  } else {
    lines.push("| Artifact | Present | Risk if Missing |");
    lines.push("|----------|---------|-----------------|");
    for (const a of report.artifacts) {
      const icon = a.exists ? "✅" : "❌";
      lines.push(
        `| ${a.name} | ${icon} | ${a.exists ? "—" : a.riskIfMissing} |`,
      );
    }
  }
  lines.push("");

  // Evidence summary
  lines.push("## Evidence Summary");
  lines.push("");
  lines.push(
    `| Evidence | Status |`,
  );
  lines.push(`|----------|--------|`);
  lines.push(
    `| Implementation log entries | ${report.implementationLogEntries > 0 ? `✅ ${report.implementationLogEntries} entries` : "❌ None"}`,
  );
  lines.push(
    `| Adversarial review | ${report.adversarialReviewExists ? `✅ ${report.adversarialReviewVerdict ?? "complete"}` : "❌ Not run"}`,
  );
  lines.push(
    `| Gatekeep approved | ${report.gatekeepApproved ? "✅ Yes" : "❌ No"}`,
  );
  lines.push(
    `| Test framework | ${report.testFramework ? `✅ ${report.testFramework}` : "⚠️ Not detected"}`,
  );
  lines.push(
    `| Type checker | ${report.typeChecker ? `✅ ${report.typeChecker}` : "⚠️ Not detected"}`,
  );
  lines.push("");

  // Risks
  lines.push("## Risks Remaining");
  lines.push("");
  if (report.risks.length === 0) {
    lines.push("✅ No risks identified.");
  } else {
    for (const risk of report.risks) {
      lines.push(`- 🔴 ${risk}`);
    }
  }
  lines.push("");

  // Files out of scope
  if (report.filesOutOfScope.length > 0) {
    lines.push("## Files Outside Declared Scope");
    lines.push("");
    lines.push(
      "These files were modified but do not belong to any declared feature:",
    );
    lines.push("");
    for (const f of report.filesOutOfScope) {
      lines.push(`- \`${f}\``);
    }
    lines.push("");
  }

  // Gates checklist
  lines.push("## Gates Checklist");
  lines.push("");
  lines.push("| Gate | Status |");
  lines.push("|------|--------|");
  lines.push(
    `| Feature declared | ${report.featureId ? "✅" : "❌"} |`,
  );
  lines.push(
    `| Requirements exist | ${report.artifacts.find((a) => a.name === "requirements.md")?.exists ? "✅" : "❌"} |`,
  );
  lines.push(
    `| Actions exist | ${report.artifacts.find((a) => a.name === "actions.md")?.exists ? "✅" : "❌"} |`,
  );
  lines.push(
    `| Implementation logged | ${report.implementationLogEntries > 0 ? "✅" : "❌"} |`,
  );
  lines.push(
    `| Adversarial review | ${report.adversarialReviewExists ? "✅" : "❌"} |`,
  );
  lines.push(
    `| Gatekeep approved | ${report.gatekeepApproved ? "✅" : "❌"} |`,
  );
  lines.push("");

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(
    `*Report generated by [Devflow](https://github.com/tjsasakifln/devflow) v${getVersion()} — PR governance for AI-generated code.*`,
  );
  lines.push("");

  return lines.join("\n");
}

function renderJsonReport(report: PrRiskReport): string {
  return JSON.stringify(report, null, 2);
}

export async function reviewPrCommand(
  cwd: string,
  options: { base?: string; output?: string; json?: boolean },
): Promise<void> {
  const base = options.base ?? "main";

  console.log(pc.bold("\n📋 Devflow PR Review\n"));
  console.log(pc.dim(`Comparing ${runGit("branch --show-current", cwd) || "current"} against ${base}...\n`));

  // Verify we're in a git repo
  const inGit = runGit("rev-parse --git-dir", cwd);
  if (!inGit) {
    console.log(pc.red("Not a git repository. PR review requires git.\n"));
    return;
  }

  // Check base branch exists (try local then remote)
  const baseExists =
    runGit(`rev-parse --verify ${base}`, cwd) ||
    runGit(`rev-parse --verify origin/${base}`, cwd);
  if (!baseExists) {
    console.log(
      pc.yellow(
        `Base branch '${base}' not found locally or in origin. Using HEAD~10 as fallback.\n`,
      ),
    );
  }

  const report = await buildRiskReport(cwd, base);

  // Output
  if (options.json) {
    const json = renderJsonReport(report);
    if (options.output) {
      fs.writeFileSync(options.output, json);
      console.log(pc.green(`JSON report written to ${options.output}\n`));
    } else {
      console.log(json);
    }
  } else {
    const md = renderMarkdownReport(report);
    if (options.output) {
      fs.writeFileSync(options.output, md);
      console.log(pc.green(`Report written to ${options.output}\n`));
    } else {
      console.log(md);
    }
  }

  // Terminal summary
  const verdictColor =
    report.verdict === "RECOMMENDED"
      ? pc.green
      : report.verdict === "NEEDS EVIDENCE"
        ? pc.yellow
        : pc.red;
  console.log(
    pc.bold(`Verdict: ${verdictColor(report.verdict)}`),
  );
  console.log(pc.dim(`${report.verdictReason}\n`));

  if (report.verdict === "RECOMMENDED") {
    console.log(
      pc.green("This branch is recommended for human review. Evidence chain complete.\n"),
    );
  } else if (report.verdict === "NEEDS EVIDENCE") {
    console.log(
      pc.yellow("This branch needs more evidence before review. Address risks above.\n"),
    );
  } else {
    console.log(
      pc.red("This branch is BLOCKED. Fix blocking issues before requesting review.\n"),
    );
  }
}
