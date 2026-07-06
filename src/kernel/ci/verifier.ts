import { execSync } from "node:child_process";
import type { CIStatus } from "../types/state.js";
import type { DevflowConfig, ExecutionMode } from "../types/artifacts.js";

/**
 * Check if CI verification is required (blocking) for the given execution mode.
 * In strict and release modes, CI must be green — no exceptions.
 * In local and experimental, CI is advisory.
 */
export function isCIRequired(mode: ExecutionMode): boolean {
  return mode === "strict" || mode === "release";
}

/**
 * Check if CI unavailability should block the feature.
 * CI unavailable = gh CLI missing, workflow not found, integration error.
 * In strict/release: blocks. In local/experimental: advisory.
 */
export function isCIUnavailableBlocking(mode: ExecutionMode): boolean {
  return mode === "strict" || mode === "release";
}

/**
 * Verify CI status using gh CLI (primary) or GitHub API (fallback).
 * Returns CIStatus with workflow run conclusion for the current branch.
 */
export async function verifyCIStatus(
  rootPath: string,
  config: DevflowConfig
): Promise<CIStatus> {
  const branch = getCurrentBranch(rootPath);
  const now = new Date().toISOString();

  if (!config.ciIntegration.enabled) {
    return {
      workflow: config.ciIntegration.requiredChecks[0] || "ci",
      conclusion: "skipped",
      runId: null,
      htmlUrl: null,
      headSha: null,
      timestamp: now,
      branch,
    };
  }

  // Try gh CLI first
  try {
    const workflow = config.ciIntegration.requiredChecks[0] || "ci";
    const cmd = `gh run list --branch=${branch} --workflow=${workflow} --limit=1 --json=conclusion,status,databaseId,headSha,url`;
    const output = execSync(cmd, {
      cwd: rootPath,
      encoding: "utf-8",
      timeout: config.ciIntegration.timeoutSeconds * 1000,
    });

    const parsed = JSON.parse(output);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const run = parsed[0];
      return {
        workflow,
        conclusion: run.conclusion || "pending",
        runId: run.databaseId || null,
        htmlUrl: run.url || null,
        headSha: run.headSha || null,
        timestamp: now,
        branch,
      };
    }

    return {
      workflow,
      conclusion: null,
      runId: null,
      htmlUrl: null,
      headSha: null,
      timestamp: now,
      branch,
    };
  } catch {
    // gh CLI not available — return pending/unknown
    return {
      workflow: config.ciIntegration.requiredChecks[0] || "ci",
      conclusion: null,
      runId: null,
      htmlUrl: null,
      headSha: null,
      timestamp: now,
      branch,
    };
  }
}

/**
 * Verify all required workflows pass. Returns array of CIStatus per workflow.
 */
export async function checkRequiredWorkflows(
  rootPath: string,
  config: DevflowConfig
): Promise<CIStatus[]> {
  const results: CIStatus[] = [];
  for (const workflow of config.ciIntegration.requiredChecks) {
    const tempConfig: DevflowConfig = {
      ...config,
      ciIntegration: { ...config.ciIntegration, requiredChecks: [workflow] },
    };
    results.push(await verifyCIStatus(rootPath, tempConfig));
  }
  return results;
}

/**
 * Check if all required CI workflows are green.
 */
export function isCIGreen(statuses: CIStatus[]): boolean {
  if (statuses.length === 0) return false;
  return statuses.every(
    (s) => s.conclusion === "success"
  );
}

/**
 * Check if CI verification is available (gh CLI installed or GH_TOKEN set).
 */
export function isCIAvailable(): boolean {
  try {
    execSync("gh auth status", { encoding: "utf-8", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function getCurrentBranch(rootPath: string): string {
  try {
    return execSync("git branch --show-current", {
      cwd: rootPath,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "unknown";
  }
}
