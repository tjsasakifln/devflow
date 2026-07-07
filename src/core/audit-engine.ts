/**
 * Devflow Core — Audit Engine
 *
 * Zero-friction audit of local changes. No feature setup required.
 * Answers: "Can I trust this code before commit/PR?"
 *
 * Absence of feature artifacts is registered as risk, not blocker.
 */

import path from "node:path";
import { execSync } from "node:child_process";
import { captureGitContext } from "../kernel/utils/git-context.js";
import { detectStackProfile, type StackProfile } from "../kernel/detection/stack.js";
import { fileExists, safeReadFile } from "../kernel/utils/fs.js";
import { getVersion } from "../kernel/utils/version.js";
import {
  type AuditReport,
  type AuditOptions,
  type ChangedFile,
  type Risk,
  type Evidence,
  type AuditMetadata,
} from "./report-model.js";
import {
  type PolicyConfig,
  computeVerdict,
  buildSeverityMatrix,
  createRisk,
} from "./policy-engine.js";

// ── Git helpers ──

function runGit(args: string, cwd: string): string {
  try {
    return execSync(`git ${args}`, { cwd, encoding: "utf-8", timeout: 15000 }).trim();
  } catch {
    return "";
  }
}

// ── Diff parsing ──

function parseChangedFiles(nameStatus: string, numStat: string): ChangedFile[] {
  if (!nameStatus.trim()) return [];

  const numMap = new Map<string, { additions: number; deletions: number }>();
  for (const line of numStat.split("\n")) {
    if (!line.trim()) continue;
    const [add, del, filePath] = line.split("\t");
    if (add && del && filePath) {
      numMap.set(filePath, {
        additions: add === "-" ? 0 : parseInt(add, 10),
        deletions: del === "-" ? 0 : parseInt(del, 10),
      });
    }
  }

  return nameStatus
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
      else if (statusCode.startsWith("C")) status = "copied";

      const nums = numMap.get(filePath);
      return {
        path: filePath,
        status,
        additions: nums?.additions,
        deletions: nums?.deletions,
        language: detectLanguageFromPath(filePath),
      };
    });
}

function detectLanguageFromPath(filePath: string): string | undefined {
  if (/\.(ts|tsx)$/.test(filePath)) return "TypeScript";
  if (/\.(js|jsx|mjs|cjs)$/.test(filePath)) return "JavaScript";
  if (/\.py$/.test(filePath)) return "Python";
  if (/\.go$/.test(filePath)) return "Go";
  if (/\.rs$/.test(filePath)) return "Rust";
  if (/\.rb$/.test(filePath)) return "Ruby";
  if (/\.php$/.test(filePath)) return "PHP";
  if (/\.java$/.test(filePath)) return "Java";
  return undefined;
}

// ── Exclusion ──

const DEFAULT_EXCLUDES = [
  "dist/", "build/", ".next/", "__pycache__/", "*.generated.*",
  "*.min.js", "*.min.css", "node_modules/", ".git/", "coverage/",
  ".nyc_output/", "*.pyc", ".mypy_cache/", ".ruff_cache/",
  "target/", "vendor/", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  ".devflow/", "_devflow/", "DEVFLOW.md",
];

function shouldExclude(filePath: string): boolean {
  return DEFAULT_EXCLUDES.some((pattern) => {
    if (pattern.endsWith("/")) return filePath.startsWith(pattern);
    if (pattern.startsWith("*.")) return filePath.endsWith(pattern.slice(1));
    return filePath === pattern;
  });
}

// ── Dangerous pattern scan ──

interface PatternCheck {
  id: string;
  severity: Risk["severity"];
  category: Risk["category"];
  description: string;
  recommendation: string;
  test: (content: string) => boolean;
}

const UNIVERSAL_PATTERNS: PatternCheck[] = [
  {
    id: "eval-usage",
    severity: "CRITICAL",
    category: "security",
    description: "eval() or exec() usage detected — arbitrary code execution risk",
    recommendation: "Replace eval()/exec() with safe alternatives (JSON.parse, structured parsing, or sandboxed evaluation)",
    test: (c) => /\beval\s*\(/.test(c) || /\bexec\s*\(/.test(c),
  },
  {
    id: "hardcoded-secret",
    severity: "HIGH",
    category: "security",
    description: "Potential hardcoded secret (password, token, key, secret) found",
    recommendation: "Use environment variables or a secrets manager. Never commit secrets to source control.",
    test: (c) => /(?:password|secret|api[_-]?key|auth[_-]?token)\s*[:=]\s*["'][^"']{8,}["']/i.test(c),
  },
  {
    id: "debug-flag",
    severity: "LOW",
    category: "code-quality",
    description: "Debug flag or print statement found — may leak information in production",
    recommendation: "Remove debug statements or guard with environment check before committing.",
    test: (c) => /\b(debug\s*=\s*true|console\.(log|debug|warn)|print\s*\(|fmt\.Println|eprintln!)/.test(c),
  },
  {
    id: "todo-without-ticket",
    severity: "MEDIUM",
    category: "traceability",
    description: "TODO/FIXME found without ticket reference — untracked technical debt",
    recommendation: "Add ticket reference (e.g., TODO(#123)) or create an issue before merging.",
    test: (c) => /\b(TODO|FIXME|HACK)\b(?!\s*\(#\d+\))/.test(c),
  },
  {
    id: "empty-catch",
    severity: "MEDIUM",
    category: "code-quality",
    description: "Empty catch/except block — error silently swallowed",
    recommendation: "At minimum, log the error. Better: handle it explicitly or re-throw.",
    test: (c) => /catch\s*\([^)]*\)\s*\{\s*\}/.test(c) || /except\s*:\s*\n\s*pass/.test(c),
  },
];

function scanFileForPatterns(
  filePath: string,
  content: string,
  tolerance: "relaxed" | "moderate" | "strict",
): Risk[] {
  const risks: Risk[] = [];
  const lines = content.split("\n");

  for (const pattern of UNIVERSAL_PATTERNS) {
    if (pattern.test(content)) {
      // Find line number
      let lineNum: number | undefined;
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i]!)) {
          lineNum = i + 1;
          break;
        }
      }
      risks.push(createRisk(
        pattern.severity,
        pattern.category,
        pattern.description,
        pattern.recommendation,
        tolerance,
        { file: filePath, line: lineNum },
      ));
    }
  }

  return risks;
}

// ── Feature detection (best-effort) ──

async function detectFeature(cwd: string): Promise<{
  featureId: string | null;
  artifactRisks: Risk[];
  evidenceChecks: Evidence[];
  implLogEntries: number;
  arExists: boolean;
  arVerdict: string | null;
  gkApproved: boolean;
}> {
  const artifactRisks: Risk[] = [];
  const evidenceChecks: Evidence[] = [];
  let featureId: string | null = null;
  let implLogEntries = 0;
  let arExists = false;
  let arVerdict: string | null = null;
  let gkApproved = false;

  try {
    const raw = await safeReadFile(path.join(cwd, ".devflow", "active-feature.json"));
    if (raw) {
      const active = JSON.parse(raw);
      featureId = active.featureId ?? null;

      if (featureId) {
        const featureDir = path.join(cwd, "_devflow", "features", featureId);

        // Check core artifacts
        const coreArtifacts = [
          { file: "requirements.md", label: "Requirements", risk: "No functional target defined for AI or human implementer" },
          { file: "roadmap.md", label: "Architecture Roadmap", risk: "Architecture constraints not documented — AI may violate layer boundaries" },
          { file: "actions.md", label: "Actions / Task Breakdown", risk: "No task breakdown — implementation ordering is arbitrary" },
          { file: "test-plan.md", label: "Test Plan", risk: "No test strategy — AI-generated tests may be decorative" },
        ];

        for (const a of coreArtifacts) {
          const exists = await fileExists(path.join(featureDir, a.file));
          if (exists) {
            evidenceChecks.push({
              type: "artifact",
              label: a.label,
              present: true,
              detail: `_devflow/features/${featureId}/${a.file}`,
            });
          } else {
            artifactRisks.push(createRisk(
              "MEDIUM",
              "missing-artifact",
              `Missing ${a.label} (${a.file}) — ${a.risk}`,
              `Run 'devflow next' to see what artifacts to create next, or use 'devflow audit' without feature setup for quick checks.`,
              "moderate",
            ));
            evidenceChecks.push({
              type: "artifact",
              label: a.label,
              present: false,
              detail: a.risk,
            });
          }
        }

        // Implementation log
        const logPath = path.join(featureDir, "implementation-log.jsonl");
        const logContent = await safeReadFile(logPath);
        if (logContent?.trim()) {
          implLogEntries = logContent.split("\n").filter((l) => l.trim()).length;
          evidenceChecks.push({
            type: "implementation-log",
            label: "Implementation Log",
            present: true,
            detail: `${implLogEntries} entries`,
          });
        } else {
          evidenceChecks.push({
            type: "implementation-log",
            label: "Implementation Log",
            present: false,
            detail: "No audit trail — cannot verify who did what or when",
          });
        }

        // Adversarial review
        const arPath = path.join(cwd, ".devflow", "audits", featureId, "adversarial-review.md");
        arExists = await fileExists(arPath);
        if (arExists) {
          const arContent = await safeReadFile(arPath);
          arVerdict = arContent?.match(/\*\*Overall:\*\*\s*(PASS|FAIL|INCONCLUSIVE)/i)?.[1]?.toUpperCase() ?? null;
          evidenceChecks.push({
            type: "adversarial-review",
            label: "Adversarial Review",
            present: true,
            detail: arVerdict ?? "complete",
          });
        } else {
          evidenceChecks.push({
            type: "adversarial-review",
            label: "Adversarial Review",
            present: false,
            detail: "Bypass vectors not checked",
          });
        }

        // Gatekeep
        const gkPath = path.join(cwd, ".devflow", "audits", "gatekeep-log.jsonl");
        if (await fileExists(gkPath)) {
          const gkContent = await safeReadFile(gkPath);
          if (gkContent) {
            gkApproved = gkContent.split("\n").filter((l) => l.trim()).some((l) => {
              try {
                const e = JSON.parse(l);
                return e.featureId === featureId && e.decision === "approved";
              } catch { return false; }
            });
          }
        }
        evidenceChecks.push({
          type: "gatekeep",
          label: "Gatekeep Approval",
          present: gkApproved,
          detail: gkApproved ? "Independent review approved" : "No independent approval",
        });
      }
    }
  } catch {
    // Feature detection is best-effort
  }

  // If no feature detected, register as risks (not blockers for audit mode)
  if (!featureId) {
    artifactRisks.push(createRisk(
      "MEDIUM",
      "missing-artifact",
      "No active Devflow feature — changes have no declared scope or requirements traceability",
      "For full governance, run 'devflow feature new <name>'. For quick checks, this audit still scans for dangerous patterns.",
      "moderate",
    ));
    artifactRisks.push(createRisk(
      "LOW",
      "missing-evidence",
      "No adversarial review or gatekeep available without a feature",
      "Create a feature to enable adversarial review and gatekeeper approval.",
      "moderate",
    ));
  }

  return { featureId, artifactRisks, evidenceChecks, implLogEntries, arExists, arVerdict, gkApproved };
}

// ── Main audit function ──

export async function runAudit(opts: AuditOptions): Promise<AuditReport> {
  const cwd = opts.cwd;
  const base = opts.base ?? "main";
  const tolerance = opts.riskTolerance ?? "moderate";

  // Load execution mode from config
  let execMode: "local" | "experimental" | "strict" | "release" = "local";
  try {
    const { ConfigManager } = await import("../config/index.js");
    const cfgMgr = new ConfigManager(cwd);
    const cfg = await cfgMgr.load();
    execMode = cfg.executionMode ?? "local";
  } catch { /* use default */ }

  const policyConfig: PolicyConfig = {
    riskTolerance: tolerance,
    executionMode: execMode,
  };

  // Git context
  const git = captureGitContext(cwd);
  const branch = runGit("branch --show-current", cwd) || "unknown";

  // Stack detection
  let stack: StackProfile | null = null;
  try {
    stack = await detectStackProfile(cwd);
  } catch { /* best-effort */ }

  // Get changed files
  let changedFiles: ChangedFile[] = [];
  const allRisks: Risk[] = [];

  if (opts.staged) {
    // Staged changes only
    const nameStatus = runGit("diff --cached --name-status", cwd);
    const numStat = runGit("diff --cached --numstat", cwd);
    changedFiles = parseChangedFiles(nameStatus, numStat);
  } else if (opts.workingTree) {
    // Unstaged changes only
    const nameStatus = runGit("diff --name-status", cwd);
    const numStat = runGit("diff --numstat", cwd);
    changedFiles = parseChangedFiles(nameStatus, numStat);
  } else {
    // Default: diff vs base branch
    const mergeBase = runGit(`merge-base ${base} HEAD`, cwd);
    const diffBase = mergeBase || base;

    // Verify base exists
    const baseExists = runGit(`rev-parse --verify ${base}`, cwd) ||
      runGit(`rev-parse --verify origin/${base}`, cwd);
    const effectiveBase = baseExists ? diffBase : "HEAD~10";

    const nameStatus = runGit(`diff --name-status ${effectiveBase}..HEAD`, cwd);
    const numStat = runGit(`diff --numstat ${effectiveBase}..HEAD`, cwd);
    changedFiles = parseChangedFiles(nameStatus, numStat);
  }

  // Filter excluded files
  changedFiles = changedFiles.filter((f) => !shouldExclude(f.path));

  // Feature detection
  const { featureId, artifactRisks, evidenceChecks } =
    await detectFeature(cwd);

  allRisks.push(...artifactRisks);

  // Scan changed files for dangerous patterns
  for (const file of changedFiles) {
    if (file.status === "deleted") continue;

    const filePath = path.join(cwd, file.path);
    const content = await safeReadFile(filePath);
    if (!content) continue;

    // Skip binary/large files (>500KB)
    if (content.length > 500_000) {
      file.riskLevel = "LOW";
      continue;
    }

    const fileRisks = scanFileForPatterns(file.path, content, tolerance);
    allRisks.push(...fileRisks);

    // Set file risk level based on max severity found
    if (fileRisks.length > 0) {
      const severities = fileRisks.map((r) => r.severity);
      if (severities.includes("CRITICAL")) file.riskLevel = "CRITICAL";
      else if (severities.includes("HIGH")) file.riskLevel = "HIGH";
      else if (severities.includes("MEDIUM")) file.riskLevel = "MEDIUM";
      else file.riskLevel = "LOW";
    }
  }

  // Evidence for tooling
  if (stack?.testFramework) {
    evidenceChecks.push({ type: "test-result", label: "Test Framework", present: true, detail: stack.testFramework });
  } else if (changedFiles.length > 0) {
    evidenceChecks.push({ type: "test-result", label: "Test Framework", present: false, detail: "No test framework detected" });
  }

  if (stack?.typeChecker) {
    evidenceChecks.push({ type: "typecheck-result", label: "Type Checker", present: true, detail: stack.typeChecker });
  } else {
    evidenceChecks.push({ type: "typecheck-result", label: "Type Checker", present: false, detail: "No type checker detected" });
  }

  if (stack?.linter) {
    evidenceChecks.push({ type: "lint-result", label: "Linter", present: true, detail: stack.linter });
  } else {
    evidenceChecks.push({ type: "lint-result", label: "Linter", present: false, detail: "No linter detected" });
  }

  // CI status
  const hasCI = await fileExists(path.join(cwd, ".github", "workflows")) ||
    await fileExists(path.join(cwd, ".gitlab-ci.yml"));
  evidenceChecks.push({
    type: "ci-status",
    label: "CI Pipeline",
    present: hasCI,
    detail: hasCI ? "CI configuration detected" : "No CI configuration found",
  });

  // Working tree cleanliness
  if (git.gitStatus === "dirty" && !opts.staged) {
    allRisks.push(createRisk(
      "LOW",
      "governance",
      "Working tree is dirty — uncommitted changes not reflected in this audit",
      "Commit or stash changes before running full audit. Use --working-tree to include unstaged changes.",
      tolerance,
    ));
  }

  // Compute verdict
  const severityMatrix = buildSeverityMatrix(allRisks);
  const { verdict } = computeVerdict(allRisks, policyConfig);

  // Missing evidences
  const missingEvidences = evidenceChecks
    .filter((e) => !e.present)
    .map((e) => e.detail ?? e.label);

  // What could have shipped broken
  const whatCouldHaveShippedBroken = allRisks
    .filter((r) => r.severity === "CRITICAL" || r.severity === "HIGH")
    .map((r) => `**${r.severity}:** ${r.description} — without this audit, this would have reached production silently`)
    .slice(0, 5);

  if (whatCouldHaveShippedBroken.length === 0 && allRisks.length > 0) {
    whatCouldHaveShippedBroken.push(
      `${allRisks.length} risk(s) identified — while none are critical, each represents technical debt that compounds over time`,
    );
  }

  if (whatCouldHaveShippedBroken.length === 0) {
    whatCouldHaveShippedBroken.push(
      "No dangerous patterns detected. This does not guarantee correctness — it means automated checks found nothing.",
    );
  }

  // Executive summary
  const summaryParts: string[] = [];
  if (verdict === "PASS") {
    summaryParts.push("Audit passed with no blocking risks.");
  } else if (verdict === "WARN") {
    summaryParts.push(`${allRisks.length} risk(s) identified, none blocking.`);
  } else if (verdict === "FAIL") {
    const blockingCount = allRisks.filter((r) => r.blocking).length;
    summaryParts.push(`${blockingCount} blocking risk(s) found. Address before merging.`);
  } else {
    summaryParts.push(`BLOCKED: ${allRisks.filter((r) => r.blocking).length} critical issues must be resolved.`);
  }
  summaryParts.push(`${changedFiles.length} file(s) changed across ${changedFiles.filter((f) => f.language).length} language(s).`);

  if (!featureId) {
    summaryParts.push("No feature scope declared — full governance requires `devflow feature new`.");
  }

  // PR snippet
  const prSnippet = buildPrSnippet(verdict, severityMatrix, changedFiles.length, allRisks.length, featureId, branch);

  // Metadata
  const metadata: AuditMetadata = {
    devflowVersion: getVersion(),
    timestamp: new Date().toISOString(),
    commitSha: git.commitSha,
    branch,
    base,
    executionMode: execMode,
    workingTreeClean: git.gitStatus === "clean" || opts.staged === true,
  };

  return {
    verdict,
    executiveSummary: summaryParts.join(" "),
    severityMatrix,
    changedFiles,
    risks: allRisks,
    evidences: evidenceChecks,
    missingEvidences,
    metadata,
    whatCouldHaveShippedBroken,
    devflowGovernedBadge: "[![Devflow Governed](https://img.shields.io/badge/Devflow-Governed-6e3af2)](https://github.com/tjsasakifln/devflow)",
    featureId,
    prSnippet,
  };
}

function buildPrSnippet(
  verdict: string,
  matrix: { critical: number; high: number; medium: number; low: number },
  fileCount: number,
  riskCount: number,
  featureId: string | null,
  branch: string,
): string {
  const verdictEmoji =
    verdict === "PASS" ? "✅" : verdict === "WARN" ? "⚠️" : verdict === "FAIL" ? "❌" : "🚫";

  return [
    `<details>`,
    `<summary>${verdictEmoji} Devflow Audit: ${verdict} — ${branch}</summary>`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Verdict** | ${verdictEmoji} ${verdict} |`,
    `| **Files** | ${fileCount} changed |`,
    `| **Risks** | ${riskCount} found (C:${matrix.critical} H:${matrix.high} M:${matrix.medium} L:${matrix.low}) |`,
    `| **Feature** | ${featureId ? `\`${featureId}\`` : "none"} |`,
    ``,
    `> Generated by [Devflow](https://github.com/tjsasakifln/devflow) — local AI coding governance.`,
    `</details>`,
  ].join("\n");
}
