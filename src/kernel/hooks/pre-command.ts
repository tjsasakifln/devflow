/**
 * Pre-Command Hook System
 *
 * Centralized pre-command hook/warning system for proactive feedback.
 * Hooks are registered in src/main.ts and executed by each command
 * before they perform their primary action.
 *
 * Story 2.4 — Feedback Loop Continuo: Hooks Pre-Comando
 */

import type { HookContext, WarningResult } from "./warnings.js";
import { logger } from "../utils/logger.js";
import pc from "picocolors";
import path from "node:path";
import { fileExists, safeReadFile } from "../utils/fs.js";

// ── Hook Registration ──

type WarningFn = (ctx: HookContext) => Promise<WarningResult | null>;

const registeredWarnings: WarningFn[] = [];

/**
 * Register a pre-command warning function.
 * Called during startup in src/main.ts to wire up centralized warnings.
 */
export function registerWarning(warningFn: WarningFn): void {
  registeredWarnings.push(warningFn);
}

// ── Hook Execution ──

export interface ExecutionResult {
  warnings: WarningResult[];
  healthSummary?: HealthSummary;
}

export interface HealthSummary {
  passed: number;
  total: number;
  items: Array<{ name: string; passed: boolean; label: string }>;
}

/**
 * Execute all registered warnings for a given command context.
 * Returns array of triggered warnings (empty if none or noWarnings).
 */
export async function executePreCommandHooks(
  ctx: HookContext,
): Promise<WarningResult[]> {
  if (ctx.noWarnings) return [];

  const results: WarningResult[] = [];
  for (const warnFn of registeredWarnings) {
    try {
      const result = await warnFn(ctx);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      logger.warn(`[HOOK] Warning function error: ${error}`);
    }
  }
  return results;
}

// ── Warning Rendering ──

/**
 * Render a list of warning results to stderr (so stdout pipe is clean).
 */
export function renderWarnings(warnings: WarningResult[]): void {
  if (warnings.length === 0) return;

  for (const w of warnings) {
    console.error("");
    console.error(w.message);
  }

  // Hint about suppression
  if (warnings.length > 0) {
    console.error(
      pc.dim("\n  Tip: Use --no-warnings to suppress proactive warnings.\n"),
    );
  }
}

// ── Health Summary ──

const HEALTH_ARTIFACTS: Array<{ file: string; label: string }> = [
  { file: "requirements.md", label: "Requirements" },
  { file: "roadmap.md", label: "Roadmap" },
  { file: "actions.md", label: "Actions" },
  { file: "test-plan.md", label: "Test Plan" },
  { file: "legacy-impact.md", label: "Legacy Impact" },
  { file: "regression-watch.md", label: "Regression Watch" },
  { file: "quality-audit.md", label: "Quality Audit" },
];

/**
 * Compute a health summary for a feature directory.
 * Checks artifact presence and basic content validation.
 */
export async function computeHealthSummary(
  featureDir: string,
): Promise<HealthSummary> {
  const items: HealthSummary["items"] = [];

  for (const artifact of HEALTH_ARTIFACTS) {
    const artifactPath = path.join(featureDir, artifact.file);
    const exists = await fileExists(artifactPath);
    let passed = false;
    let label: string;

    if (exists) {
      const content = await safeReadFile(artifactPath);
      if (content && content.trim().length > 50) {
        passed = true;
        label = pc.green("complete");
      } else if (content && content.trim().length > 0) {
        passed = true;
        label = pc.yellow("partial");
      } else {
        label = pc.yellow("empty");
      }
    } else {
      label = pc.red("missing");
    }

    items.push({ name: artifact.label, passed, label });
  }

  const total = items.length;
  const passed = items.filter((i) => i.passed).length;

  return { passed, total, items };
}

/**
 * Render mini health summary after state-transitioning commands.
 */
export function renderHealthSummary(summary: HealthSummary): void {
  const width = 56;
  const border = pc.dim("─".repeat(width));

  console.error("");
  console.error(`┌${border}┐`);
  console.error(`│ ${pc.bold("Feature Health Summary")}${" ".repeat(width - 22)}│`);
  console.error(`├${border}┤`);

  for (const item of summary.items) {
    const icon = item.passed ? pc.green("✓") : pc.yellow("∼");
    const name = item.name.padEnd(22);
    const label = typeof item.label === "string" ? item.label : String(item.label);
    console.error(
      `│ ${icon} ${pc.dim(name)}${label}${" ".repeat(Math.max(1, width - 26 - label.length))}│`,
    );
  }

  console.error(`├${border}┤`);
  const passText = `${summary.passed}/${summary.total} artifacts healthy`;
  const spacer = " ".repeat(Math.max(1, width - passText.length - 4));
  console.error(`│ ${pc.bold(passText)}${spacer}│`);
  console.error(`└${border}┘`);
  console.error("");
}

// ── Snooze Integration ──

import { isWarningSnoozed } from "./warnings.js";

/**
 * Execute hooks with snooze check and auto-skip for snoozed warnings.
 * Filters out snoozed warnings before execution.
 */
export async function executeWithSnooze(
  ctx: HookContext,
): Promise<WarningResult[]> {
  if (ctx.noWarnings) return [];

  const results: WarningResult[] = [];
  for (const warnFn of registeredWarnings) {
    try {
      const result = await warnFn(ctx);
      if (result) {
        // Check if snoozed after the fact (warning function already
        // does its own snooze check for efficiency, but double-check)
        if (result.canSnooze && ctx.featureId) {
          const snoozed = await isWarningSnoozed(
            result.warningId,
            ctx.featureId,
            ctx.rootPath,
          );
          if (!snoozed) {
            results.push(result);
          }
        } else {
          results.push(result);
        }
      }
    } catch (error) {
      logger.warn(`[HOOK] Warning function error: ${error}`);
    }
  }
  return results;
}

export { isWarningSnoozed, snoozeWarning } from "./warnings.js";
