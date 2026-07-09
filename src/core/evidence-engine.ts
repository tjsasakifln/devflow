/**
 * Devflow Core — Evidence Engine
 *
 * Validates what evidence exists for a feature or audit.
 * Extracted from kernel/evidence/gatherer.ts and commands/feature-complete.ts
 * into a dedicated core module.
 */

import path from "node:path";
import { execSync } from "node:child_process";
import { fileExists, safeReadFile } from "../kernel/utils/fs.js";
import { AUDITS_DIR, ADVERSARIAL_REVIEW_FILENAME, GATEKEEP_LOG_RELPATH } from "../kernel/constants/paths.js";
import type { Evidence, EvidenceType } from "./report-model.js";

// ── EvidenceCheck (consumer-facing interface) ──

export interface EvidenceCheck {
  type: EvidenceType;
  label: string;
  check: () => Promise<boolean>;
  detail?: () => Promise<string | undefined>;
}

// ── Artifact paths ──

const FEATURE_ARTIFACTS = [
  "requirements.md",
  "roadmap.md",
  "actions.md",
  "test-plan.md",
  "implementation-log.jsonl",
  "legacy-impact.md",
] as const;

// ── Public API ──

/**
 * Gather all evidence for a feature (or entire project in audit mode).
 *
 * When featureId is null (audit mode): artifact evidences are marked absent
 * with a note that no feature scope was declared.
 */
export async function gatherEvidence(
  cwd: string,
  featureId: string | null,
): Promise<Evidence[]> {
  const evidences: Evidence[] = [];

  // ── Feature-level artifact checks ──
  const featureDir = featureId
    ? path.join(cwd, "_devflow", "features", featureId)
    : null;

  if (featureDir) {
    for (const artifact of FEATURE_ARTIFACTS) {
      const present = await checkArtifactPresence(featureDir, artifact);
      const label = artifactLabel(artifact);
      let detail: string | undefined;
      if (present) {
        detail = `${artifact} found`;
      } else {
        detail = `${artifact} missing`;
      }
      evidences.push({
        type: "artifact",
        label,
        present,
        detail,
      });
    }
  } else {
    // Audit mode — no feature scope declared
    for (const artifact of FEATURE_ARTIFACTS) {
      evidences.push({
        type: "artifact",
        label: artifactLabel(artifact),
        present: false,
        detail: `Not required — no feature scope declared`,
      });
    }
  }

  // ── Deterministic tool results ──
  const toolEvidences = await gatherDeterministicEvidences(cwd);
  evidences.push(...toolEvidences);

  // ── Adversarial review ──
  if (featureId) {
    const advReview = await checkAdversarialReview(cwd, featureId);
    evidences.push({
      type: "adversarial-review",
      label: "Adversarial review completed and passing",
      present: advReview.exists && advReview.verdict === "PASS",
      detail: advReview.exists
        ? advReview.verdict === "PASS"
          ? "Adversarial review PASS"
          : `Adversarial review verdict: ${advReview.verdict ?? "unknown"}`
        : "adversarial-review.md not found",
    });
  } else {
    evidences.push({
      type: "adversarial-review",
      label: "Adversarial review completed and passing",
      present: false,
      detail: "Not required — no feature scope declared",
    });
  }

  // ── Gatekeep approval ──
  if (featureId) {
    const gatekeepApproved = await checkGatekeepApproval(cwd, featureId);
    evidences.push({
      type: "gatekeep",
      label: "Gatekeep independent approval",
      present: gatekeepApproved,
      detail: gatekeepApproved
        ? "Gatekeep approval found in log"
        : "No gatekeep approval record found",
    });
  } else {
    evidences.push({
      type: "gatekeep",
      label: "Gatekeep independent approval",
      present: false,
      detail: "Not required — no feature scope declared",
    });
  }

  // ── CI status ──
  const ciEvidence = await gatherCIEvidence(cwd, featureId);
  evidences.push(ciEvidence);

  // ── Implementation log entries count (when feature scope exists) ──
  if (featureDir) {
    const logCount = await countImplementationLogEntries(featureDir);
    evidences.push({
      type: "implementation-log",
      label: "Implementation log entries",
      present: logCount > 0,
      detail: logCount > 0
        ? `${logCount} entries in implementation-log.jsonl`
        : "implementation-log.jsonl is empty or missing",
    });
  }

  return evidences;
}

/**
 * Check whether a single artifact file exists in the feature directory.
 */
export async function checkArtifactPresence(
  featureDir: string,
  artifactName: string,
): Promise<boolean> {
  return fileExists(path.join(featureDir, artifactName));
}

/**
 * Count how many non-empty lines exist in the implementation log.
 */
export async function countImplementationLogEntries(
  featureDir: string,
): Promise<number> {
  const logPath = path.join(featureDir, "implementation-log.jsonl");
  const exists = await fileExists(logPath);
  if (!exists) return 0;

  const raw = await safeReadFile(logPath);
  if (!raw) return 0;

  return raw
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0).length;
}

/**
 * Check whether an adversarial review report exists and its verdict.
 *
 * The review file is expected at `.devflow/audits/{featureId}/adversarial-review.md`.
 * A PASS verdict is determined by the presence of "PASS" in the file content.
 */
export async function checkAdversarialReview(
  cwd: string,
  featureId: string,
): Promise<{ exists: boolean; verdict: string | null }> {
  const reviewPath = path.join(
    cwd,
    AUDITS_DIR,
    featureId,
    ADVERSARIAL_REVIEW_FILENAME,
  );
  const exists = await fileExists(reviewPath);
  if (!exists) {
    return { exists: false, verdict: null };
  }

  const content = await safeReadFile(reviewPath);
  if (!content) {
    return { exists: true, verdict: null };
  }

  const passed = content.includes("PASS");
  return {
    exists: true,
    verdict: passed ? "PASS" : "FAIL",
  };
}

/**
 * Check whether a gatekeep approval exists for the given feature.
 *
 * Reads `.devflow/audits/gatekeep-log.jsonl` and searches for entries
 * matching the feature ID with an "APPROVED" verdict.
 */
export async function checkGatekeepApproval(
  cwd: string,
  featureId: string,
): Promise<boolean> {
  const gatekeepLogPath = path.join(cwd, GATEKEEP_LOG_RELPATH);
  const exists = await fileExists(gatekeepLogPath);
  if (!exists) return false;

  const raw = await safeReadFile(gatekeepLogPath);
  if (!raw) return false;

  const lines = raw.trim().split("\n").filter((l) => l.trim());
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (
        entry.featureId === featureId &&
        (entry.verdict === "APPROVED" || entry.verdict === "approved")
      ) {
        return true;
      }
    } catch {
      // skip malformed lines
    }
  }

  return false;
}

/**
 * Return human-readable descriptions for all absent evidences.
 */
export function getMissingEvidences(evidences: Evidence[]): string[] {
  return evidences
    .filter((e) => !e.present)
    .map((e) => {
      const base = e.detail ? `${e.label}: ${e.detail}` : e.label;
      return base;
    });
}

// ── Internal helpers ──

function artifactLabel(artifact: string): string {
  const labels: Record<string, string> = {
    "requirements.md": "Requirements document",
    "roadmap.md": "Design roadmap",
    "actions.md": "Actions with evidence",
    "test-plan.md": "Test plan",
    "implementation-log.jsonl": "Implementation log",
    "legacy-impact.md": "Legacy impact analysis",
  };
  return labels[artifact] ?? artifact;
}

async function gatherDeterministicEvidences(
  cwd: string,
): Promise<Evidence[]> {
  const evidences: Evidence[] = [];

  try {
    const { detectStackProfile } = await import(
      "../kernel/detection/stack.js"
    );
    const stack = await detectStackProfile(cwd);

    // Test results
    const testCmd = getTestCommand(stack);
    if (testCmd) {
      const testPassed = await runToolCheck(testCmd, cwd);
      evidences.push({
        type: "test-result",
        label: "Test results",
        present: testPassed,
        detail: testPassed
          ? "Tests pass"
          : "Tests fail or could not be verified",
      });
    } else {
      evidences.push({
        type: "test-result",
        label: "Test results",
        present: false,
        detail: "No test command configured for this stack",
      });
    }

    // Lint results
    const lintCmd = getLintCommand(stack);
    if (lintCmd) {
      const lintPassed = await runToolCheck(lintCmd, cwd);
      evidences.push({
        type: "lint-result",
        label: "Lint results",
        present: lintPassed,
        detail: lintPassed
          ? "Lint passes"
          : "Lint violations detected",
      });
    } else {
      evidences.push({
        type: "lint-result",
        label: "Lint results",
        present: false,
        detail: "No lint command configured for this stack",
      });
    }

    // Typecheck results
    const typeCheckCmd = getTypeCheckCommand(stack);
    if (typeCheckCmd) {
      const tcPassed = await runToolCheck(typeCheckCmd, cwd);
      evidences.push({
        type: "typecheck-result",
        label: "Typecheck results",
        present: tcPassed,
        detail: tcPassed
          ? "Type checking passes"
          : "Type checking errors detected",
      });
    } else if (stack.language === "typescript") {
      evidences.push({
        type: "typecheck-result",
        label: "Typecheck results",
        present: false,
        detail: "No typecheck command configured for TypeScript project",
      });
    } else if (stack.language === "javascript") {
      evidences.push({
        type: "typecheck-result",
        label: "Typecheck results",
        present: true,
        detail: "Type checking not applicable — JavaScript project",
      });
    }
  } catch {
    // Stack detection unavailable — report as absent
    const labels: Array<{ type: EvidenceType; label: string }> = [
      { type: "test-result", label: "Test results" },
      { type: "lint-result", label: "Lint results" },
      { type: "typecheck-result", label: "Typecheck results" },
    ];
    for (const item of labels) {
      evidences.push({
        type: item.type,
        label: item.label,
        present: false,
        detail: "Stack detection unavailable — cannot verify",
      });
    }
  }

  return evidences;
}

function getTestCommand(
  stack: Record<string, any>,
): string | null {
  if (stack.testCommand) return stack.testCommand;
  return null;
}

function getLintCommand(
  stack: Record<string, any>,
): string | null {
  if (stack.lintCommand) return stack.lintCommand;
  return null;
}

function getTypeCheckCommand(
  stack: Record<string, any>,
): string | null {
  if (stack.typeCheckCommand) return stack.typeCheckCommand;
  return null;
}

async function runToolCheck(
  command: string,
  cwd: string,
): Promise<boolean> {
  try {
    execSync(command, {
      cwd,
      encoding: "utf-8",
      timeout: 60000,
      stdio: "pipe",
      env: { ...process.env, CI: "true" },
    });
    return true;
  } catch {
    return false;
  }
}

async function gatherCIEvidence(
  cwd: string,
  _featureId: string | null,
): Promise<Evidence> {
  const base: Pick<Evidence, "type" | "label"> = {
    type: "ci-status",
    label: "CI status",
  };

  try {
    const { verifyCIStatus } = await import("../kernel/ci/verifier.js");
    const { ConfigManager } = await import("../kernel/config/index.js");
    const configMgr = new ConfigManager(cwd);
    const config = await configMgr.load();

    if (!config.ciIntegration?.enabled) {
      return {
        ...base,
        present: false,
        detail: "CI integration not enabled in config",
      };
    }

    const ciStatus = await verifyCIStatus(cwd, config);
    const passed = ciStatus.conclusion === "success";

    return {
      ...base,
      present: passed,
      detail: passed
        ? `CI workflow ${ciStatus.workflow} passed on ${ciStatus.branch}`
        : `CI status: ${ciStatus.conclusion ?? "unknown"}`,
    };
  } catch {
    return {
      ...base,
      present: false,
      detail: "CI verifier not available or not configured",
    };
  }
}
