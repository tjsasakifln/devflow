/**
 * Pre-Command Warnings — Story 2.4
 *
 * Warning definitions with conditions for 4 high-impact commands:
 *   feature prompt, feature complete, feature new, gatekeep
 *
 * Each warning is advisory (does not block) but visible.
 * Snooze persistence allows per-feature, per-warning suppression.
 */

import path from "node:path";
import pc from "picocolors";
import { fileExists, safeReadFile, atomicWrite } from "../utils/fs.js";

// ── Types ──

export interface HookContext {
  /** The command being executed (e.g., "feature prompt", "feature new") */
  commandName: string;
  /** Feature ID if applicable */
  featureId?: string;
  /** Project root path */
  rootPath: string;
  /** If true, suppress all proactive warnings */
  noWarnings: boolean;
}

export interface WarningResult {
  /** Unique warning identifier (kebab-case) */
  warningId: string;
  /** Human-readable warning message */
  message: string;
  /** Icon prefix */
  icon: string;
  /** Whether this warning supports snoozing */
  canSnooze: boolean;
}

// ── Snooze Persistence ──

interface SnoozeState {
  [warningId: string]: {
    [featureId: string]: string; // ISO 8601 expiration date
  };
}

function getSnoozePath(rootPath: string): string {
  return path.join(rootPath, ".devflow", "warnings-snooze.json");
}

async function loadSnoozeState(rootPath: string): Promise<SnoozeState> {
  const snoozePath = getSnoozePath(rootPath);
  try {
    const content = await safeReadFile(snoozePath);
    if (content) return JSON.parse(content) as SnoozeState;
  } catch {
    // Corrupt or missing file — treat as empty
  }
  return {};
}

async function saveSnoozeState(
  rootPath: string,
  state: SnoozeState,
): Promise<void> {
  const dir = path.dirname(getSnoozePath(rootPath));
  const { execSync } = await import("node:child_process");
  try {
    execSync(`mkdir -p "${dir}"`, { encoding: "utf-8" });
  } catch {
    // Directory may already exist
  }
  await atomicWrite(getSnoozePath(rootPath), JSON.stringify(state, null, 2));
}

/**
 * Check if a warning is currently snoozed for a given feature.
 */
export async function isWarningSnoozed(
  warningId: string,
  featureId: string | undefined,
  rootPath: string,
): Promise<boolean> {
  if (!featureId) return false;
  const state = await loadSnoozeState(rootPath);
  const entry = state[warningId]?.[featureId];
  if (!entry) return false;
  try {
    return new Date(entry) > new Date();
  } catch {
    return false;
  }
}

/**
 * Snooze a warning for a given duration.
 */
export async function snoozeWarning(
  warningId: string,
  featureId: string,
  rootPath: string,
  durationHours = 24,
): Promise<void> {
  const state = await loadSnoozeState(rootPath);
  if (!state[warningId]) state[warningId] = {};
  const expiration = new Date(
    Date.now() + durationHours * 60 * 60 * 1000,
  ).toISOString();
  state[warningId][featureId] = expiration;
  await saveSnoozeState(rootPath, state);
}

/**
 * Clear all snoozed warnings for a given feature.
 */
export async function clearSnoozesForFeature(
  featureId: string,
  rootPath: string,
): Promise<void> {
  const state = await loadSnoozeState(rootPath);
  for (const warningId of Object.keys(state)) {
    if (state[warningId]?.[featureId]) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete state[warningId]![featureId];
    }
  }
  await saveSnoozeState(rootPath, state);
}

// ── Shared: Required artifacts list for content checks ──

const REQUIRED_ARTIFACTS = [
  "requirements.md",
  "roadmap.md",
  "actions.md",
  "test-plan.md",
] as const;

// ── Warning 1: feature prompt without complete artifacts ──

export async function warnIncompleteArtifacts(
  ctx: HookContext,
): Promise<WarningResult | null> {
  if (ctx.commandName !== "feature prompt" || !ctx.featureId) return null;

  if (
    await isWarningSnoozed("incomplete-artifacts", ctx.featureId, ctx.rootPath)
  ) {
    return null;
  }

  const featureDir = path.join(
    ctx.rootPath,
    "_devflow",
    "features",
    ctx.featureId,
  );

  const missing: string[] = [];
  for (const artifact of REQUIRED_ARTIFACTS) {
    const content = await safeReadFile(path.join(featureDir, artifact));
    if (!content || content.trim().length === 0) {
      missing.push(artifact.replace(".md", ""));
    }
  }

  if (missing.length > 0) {
    return {
      warningId: "incomplete-artifacts",
      message:
        `${pc.yellow("⚠️  Warning:")} Required artifacts missing or empty: ${pc.bold(missing.join(", "))}\n` +
        `  ${pc.dim("The generated prompt will contain placeholders. Complete these artifacts first.")}\n` +
        `  ${pc.dim("Run `devflow next` to see remaining steps.")}`,
      icon: "⚠️",
      canSnooze: true,
    };
  }

  return null;
}

// ── Warning 2: feature complete with low artifact fill ──

const COMPLETION_ARTIFACTS = [
  "requirements.md",
  "roadmap.md",
  "actions.md",
  "test-plan.md",
  "legacy-impact.md",
  "regression-watch.md",
  "quality-audit.md",
] as const;

export async function warnLowArtifactCompletion(
  ctx: HookContext,
): Promise<WarningResult | null> {
  if (ctx.commandName !== "feature complete" || !ctx.featureId) return null;

  if (
    await isWarningSnoozed(
      "low-artifact-completion",
      ctx.featureId,
      ctx.rootPath,
    )
  ) {
    return null;
  }

  const featureDir = path.join(
    ctx.rootPath,
    "_devflow",
    "features",
    ctx.featureId,
  );

  let filled = 0;
  for (const artifact of COMPLETION_ARTIFACTS) {
    const content = await safeReadFile(path.join(featureDir, artifact));
    if (content && content.trim().length > 50) {
      filled++;
    }
  }

  const total = COMPLETION_ARTIFACTS.length;
  const ratio = filled / total;

  if (ratio < 0.5) {
    return {
      warningId: "low-artifact-completion",
      message:
        `${pc.yellow("⚠️  Warning:")} Low artifact completion — ${filled}/${total} filled (${Math.round(ratio * 100)}%)\n` +
        `  ${pc.dim("Most DoD checks will likely fail at this stage.")}\n` +
        `  ${pc.dim("Complete requirements, roadmap, actions, test-plan, and legacy-impact first.")}`,
      icon: "⚠️",
      canSnooze: true,
    };
  }

  return null;
}

// ── Warning 3: feature new in brownfield without discover ──

export async function warnBrownfieldWithoutDiscover(
  ctx: HookContext,
): Promise<WarningResult | null> {
  if (ctx.commandName !== "feature new") return null;

  // Check if project has _devflow/features dir and _devflow/discovery dir
  const featuresDir = path.join(ctx.rootPath, "_devflow", "features");
  const discoveryDir = path.join(ctx.rootPath, "_devflow", "discovery");

  const hasFeatures = await fileExists(featuresDir);
  const hasDiscovery = await fileExists(discoveryDir);

  // Only warn if features exist (brownfield) but discovery doesn't
  if (hasFeatures && !hasDiscovery) {
    // Check if there are actual feature entries
    const { listDir } = await import("../utils/fs.js");
    let featureCount = 0;
    try {
      const entries = await listDir(featuresDir);
      featureCount = entries.filter(
        (e: string) => e !== ".gitkeep" && !e.startsWith("."),
      ).length;
    } catch {
      featureCount = 0;
    }

    if (featureCount > 0) {
      return {
        warningId: "brownfield-no-discover",
        message:
          `${pc.yellow("⚠️  Warning:")} Brownfield project with ${featureCount} existing feature(s) without prior discovery.\n` +
          `  ${pc.dim("Consider running `devflow discover` first to map the existing codebase.")}\n` +
          `  ${pc.dim("Discovery generates architecture, domain, and risk reports for safer changes.")}`,
        icon: "⚠️",
        canSnooze: false,
      };
    }
  }

  return null;
}

// ── Warning 4: gatekeep without adversarial-review ──

export async function warnGatekeepWithoutAdversarial(
  ctx: HookContext,
): Promise<WarningResult | null> {
  if (ctx.commandName !== "gatekeep" || !ctx.featureId) return null;

  if (
    await isWarningSnoozed(
      "gatekeep-no-adversarial",
      ctx.featureId,
      ctx.rootPath,
    )
  ) {
    return null;
  }

  const auditDir = path.join(
    ctx.rootPath,
    ".devflow",
    "audits",
    ctx.featureId,
  );
  const advReviewPath = path.join(auditDir, "adversarial-review.md");
  const hasAdvReview = await fileExists(advReviewPath);

  if (!hasAdvReview) {
    return {
      warningId: "gatekeep-no-adversarial",
      message:
        `${pc.yellow("⚠️  Warning:")} Adversarial review not yet completed for feature ${pc.bold(ctx.featureId)}.\n` +
        `  ${pc.dim("Consider running `devflow adversarial-review " + ctx.featureId + "` first.")}\n` +
        `  ${pc.dim("Adversarial review tests the feature against 12 attack vectors before gatekeeping.")}`,
      icon: "⚠️",
      canSnooze: true,
    };
  }

  return null;
}
