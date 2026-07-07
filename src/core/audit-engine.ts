/**
 * Devflow Core — Audit Engine
 *
 * Zero-friction audit of local changes. No feature setup required.
 * Answers: "Can I trust this code before commit/PR?"
 *
 * Absence of feature artifacts is registered as risk, not blocker.
 */

import path from "node:path";
import { captureGitContext } from "../kernel/utils/git-context.js";
import { buildDiffModel } from "../adapters/git/diff-model.js";
import { loadExclusionRules, filterExcludedFiles } from "../adapters/git/exclusion-rules.js";
import { detectStackProfile, type StackProfile } from "../kernel/detection/stack.js";
import { fileExists, safeReadFile } from "../kernel/utils/fs.js";
import { getVersion } from "../kernel/utils/version.js";
import { getStackAdapter, detectStackFromFiles } from "../adapters/stacks/index.js";
import type { StackAdapter } from "../adapters/stacks/types.js";
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

// ── Language detection ──

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
  const branch = git.branch;

  // Stack detection
  let stack: StackProfile | null = null;
  try {
    stack = await detectStackProfile(cwd);
  } catch { /* best-effort */ }

  // Get changed files
  let changedFiles: ChangedFile[] = [];
  let scopeDescription = "";
  const allRisks: Risk[] = [];

  if (opts.staged && !opts.workingTree) {
    // Staged changes only
    const model = await buildDiffModel(cwd, { staged: true, workingTree: false });
    changedFiles = model.stagedFiles.map(f => ({
      path: f.path,
      status: f.status as ChangedFile["status"],
      additions: f.additions,
      deletions: f.deletions,
      language: detectLanguageFromPath(f.path),
    }));
    scopeDescription = `${changedFiles.length} staged file(s)`;
  } else if (opts.workingTree && !opts.staged) {
    // Working tree (unstaged) only
    const model = await buildDiffModel(cwd, { staged: false, workingTree: true });
    changedFiles = model.unstagedFiles.map(f => ({
      path: f.path,
      status: f.status as ChangedFile["status"],
      additions: f.additions,
      deletions: f.deletions,
      language: detectLanguageFromPath(f.path),
    }));
    scopeDescription = `${changedFiles.length} unstaged file(s)`;
  } else if (opts.base && !opts.staged && !opts.workingTree) {
    // Base diff only
    const model = await buildDiffModel(cwd, { base: opts.base, staged: true, workingTree: false });
    changedFiles = model.stagedFiles.map(f => ({
      path: f.path,
      status: f.status as ChangedFile["status"],
      additions: f.additions,
      deletions: f.deletions,
      language: detectLanguageFromPath(f.path),
    }));
    scopeDescription = `${changedFiles.length} file(s) vs ${opts.base}`;
  } else {
    // Default: all three scopes merged
    const wdModel = await buildDiffModel(cwd, {});
    const baseModel = await buildDiffModel(cwd, { base });

    const stagedFiles: ChangedFile[] = wdModel.stagedFiles.map(f => ({
      path: f.path,
      status: f.status as ChangedFile["status"],
      additions: f.additions,
      deletions: f.deletions,
      language: detectLanguageFromPath(f.path),
    }));
    const unstagedFiles: ChangedFile[] = wdModel.unstagedFiles.map(f => ({
      path: f.path,
      status: f.status as ChangedFile["status"],
      additions: f.additions,
      deletions: f.deletions,
      language: detectLanguageFromPath(f.path),
    }));
    const baseDiffFiles: ChangedFile[] = baseModel.stagedFiles.map(f => ({
      path: f.path,
      status: f.status as ChangedFile["status"],
      additions: f.additions,
      deletions: f.deletions,
      language: detectLanguageFromPath(f.path),
    }));

    // Merge and deduplicate by path
    const merged = new Map<string, ChangedFile>();
    for (const file of [...stagedFiles, ...unstagedFiles, ...baseDiffFiles]) {
      merged.set(file.path, file);
    }
    changedFiles = Array.from(merged.values());

    scopeDescription = `${stagedFiles.length} staged, ${unstagedFiles.length} unstaged, ${baseDiffFiles.length} vs ${base} — ${changedFiles.length} unique file(s)`;
  }

  // Apply exclusion rules
  const rules = loadExclusionRules(cwd);
  const includedPaths = filterExcludedFiles(changedFiles.map(f => f.path), rules);
  const includedSet = new Set(includedPaths);
  changedFiles = changedFiles.filter(f => includedSet.has(f.path));

  // Feature detection
  const { featureId, artifactRisks, evidenceChecks } =
    await detectFeature(cwd);

  allRisks.push(...artifactRisks);

  // Stack-specific hints collected from adapters
  const stackHints: string[] = [];

  // Detect unique languages from changed files
  const changedPaths = changedFiles.map(f => f.path);
  const languages = detectStackFromFiles(changedPaths);

  // Resolve adapters per language
  const adapters = new Map<string, StackAdapter | null>();
  for (const lang of languages) {
    adapters.set(lang, getStackAdapter(lang));
  }

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

    // 1. Run universal patterns (always)
    const universalRisks = scanFileForPatterns(file.path, content, tolerance);
    allRisks.push(...universalRisks);

    // 2. Run stack-specific patterns via adapter
    const lang = file.language?.toLowerCase();
    const adapter = lang ? (adapters.get(lang) ?? null) : null;

    if (adapter && adapter.detectDangerousPatterns) {
      try {
        const stackPatterns = await adapter.detectDangerousPatterns(file.path, content);
        const stackRisks = stackPatterns.map(p => createRisk(
          p.severity,
          p.category,
          `${p.description} (${p.pattern})`,
          p.recommendation,
          tolerance,
          { file: p.file, line: p.line },
        ));
        allRisks.push(...stackRisks);
      } catch {
        // Adapter pattern detection is best-effort
      }
    }

    // 3. Collect stack-specific risk hints
    if (adapter && adapter.renderRiskHints) {
      try {
        const hints = adapter.renderRiskHints(allRisks);
        if (hints.length > 0) {
          stackHints.push(...hints);
        }
      } catch {
        // Hints are best-effort
      }
    }

    // Set file risk level based on max severity found
    const fileRisks = allRisks.filter(r => r.file === file.path);
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

  // Stack adapter coverage
  if (languages.length > 0) {
    const adapterNames = languages
      .map(l => adapters.get(l))
      .filter((a): a is StackAdapter => a !== null)
      .map(a => a.language);
    evidenceChecks.push({
      type: "test-result",
      label: "Stack Adapters",
      present: adapterNames.length > 0,
      detail: adapterNames.length > 0
        ? `Active: ${adapterNames.join(", ")} (${languages.length - adapterNames.length} without adapter)`
        : `No stack adapters available for: ${languages.join(", ")}`,
    });
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
  if (git.gitStatus === "dirty" && opts.staged === true) {
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
    scopeDescription,
    stackHints,
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
