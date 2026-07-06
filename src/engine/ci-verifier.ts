import { execSync } from "node:child_process";
import type { CIStatus } from "../types/state.js";
import type { DevflowConfig } from "../types/artifacts.js";

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
