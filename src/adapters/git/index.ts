/**
 * Git Adapter
 *
 * Wraps the safe process runner for common git operations.
 * Never shells out raw — always uses spawn with args array.
 */

import { runProcess } from "../process/safe-runner.js";
import { stat, appendFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";

// ── Types ──

export interface GitContext {
  hasGit: boolean;
  branch: string | null;
  commitSha: string | null;
  isClean: boolean;
  remoteName: string | null;
}

export interface HookBypass {
  hook: string;
  timestamp: string;
  branch: string;
  sha: string;
  user: string;
  reason: string;
}

// ── Defaults ──

const GIT_DEFAULT_TIMEOUT = 10_000;

// ── Helpers ──

async function hasGit(cwd: string): Promise<boolean> {
  try {
    await stat(path.join(cwd, ".git"));
    return true;
  } catch {
    return false;
  }
}

// ── Operations ──

export async function getCurrentBranch(cwd: string): Promise<string | null> {
  if (!(await hasGit(cwd))) return null;
  const result = await runProcess({
    command: "git",
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
    cwd,
    timeout: GIT_DEFAULT_TIMEOUT,
  });
  return result.exitCode === 0 ? result.stdout : null;
}

export async function getCommitSha(cwd: string): Promise<string | null> {
  if (!(await hasGit(cwd))) return null;
  const result = await runProcess({
    command: "git",
    args: ["rev-parse", "HEAD"],
    cwd,
    timeout: GIT_DEFAULT_TIMEOUT,
  });
  return result.exitCode === 0 ? result.stdout : null;
}

export async function getStatus(cwd: string): Promise<"clean" | "dirty" | "unknown"> {
  if (!(await hasGit(cwd))) return "unknown";
  const result = await runProcess({
    command: "git",
    args: ["status", "--porcelain"],
    cwd,
    timeout: GIT_DEFAULT_TIMEOUT,
  });
  if (result.exitCode !== 0) return "unknown";
  return result.stdout.length === 0 ? "clean" : "dirty";
}

export async function isFeatureBranch(cwd: string): Promise<boolean> {
  const branch = await getCurrentBranch(cwd);
  if (!branch) return false;
  return branch !== "main" && branch !== "master";
}

export async function getGitContext(cwd: string): Promise<GitContext> {
  const gitExists = await hasGit(cwd);
  if (!gitExists) {
    return {
      hasGit: false,
      branch: null,
      commitSha: null,
      isClean: false,
      remoteName: null,
    };
  }

  const [branch, commitSha, status] = await Promise.all([
    getCurrentBranch(cwd),
    getCommitSha(cwd),
    getStatus(cwd),
  ]);

  return {
    hasGit: true,
    branch,
    commitSha,
    isClean: status === "clean",
    remoteName: null, // populated on demand
  };
}

export async function getGitUserEmail(cwd: string): Promise<string | null> {
  if (!(await hasGit(cwd))) return null;
  const result = await runProcess({
    command: "git",
    args: ["config", "user.email"],
    cwd,
    timeout: GIT_DEFAULT_TIMEOUT,
  });
  return result.exitCode === 0 ? result.stdout : null;
}

// ── Diff Helpers ──

/**
 * Get staged diff as a name-status string.
 * Returns empty string on failure.
 */
export async function getStagedDiff(cwd: string): Promise<string> {
  if (!(await hasGit(cwd))) return "";
  const result = await runProcess({
    command: "git",
    args: ["diff", "--cached", "--name-status"],
    cwd,
    timeout: GIT_DEFAULT_TIMEOUT,
  });
  return result.exitCode === 0 ? result.stdout : "";
}

/**
 * Get unstaged diff as a name-status string.
 * Returns empty string on failure.
 */
export async function getUnstagedDiff(cwd: string): Promise<string> {
  if (!(await hasGit(cwd))) return "";
  const result = await runProcess({
    command: "git",
    args: ["diff", "--name-status"],
    cwd,
    timeout: GIT_DEFAULT_TIMEOUT,
  });
  return result.exitCode === 0 ? result.stdout : "";
}

/**
 * Alias for `getStatus` — returns working tree status.
 */
export async function getWorkingTreeStatus(
  cwd: string,
): Promise<"clean" | "dirty" | "unknown"> {
  return getStatus(cwd);
}

// ── Hook Bypass Logging ──

const HOOK_BYPASS_LOG = ".devflow/audits/hook-bypass.jsonl";

/**
 * Log a git hook bypass event to `.devflow/audits/hook-bypass.jsonl`.
 *
 * Each entry is a JSON line containing timestamp, branch, commit SHA,
 * git user, hook name, and reason.
 */
export async function logHookBypass(
  cwd: string,
  hook: string,
  reason: string,
): Promise<void> {
  const logPath = path.join(cwd, HOOK_BYPASS_LOG);

  try {
    await mkdir(path.dirname(logPath), { recursive: true });
  } catch {
    // Directory may already exist — continue
  }

  const [branch, sha, user] = await Promise.all([
    getCurrentBranch(cwd),
    getCommitSha(cwd),
    getGitUserEmail(cwd),
  ]);

  const entry: HookBypass = {
    hook,
    timestamp: new Date().toISOString(),
    branch: branch ?? "unknown",
    sha: sha ?? "unknown",
    user: user ?? "unknown",
    reason,
  };

  try {
    await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf-8");
  } catch {
    // Best-effort logging — swallow errors
  }
}

/**
 * Read hook bypass log entries, optionally filtered by timestamp.
 *
 * @param since - Only return entries after this ISO timestamp.
 */
export async function getHookBypasses(
  cwd: string,
  since?: string,
): Promise<HookBypass[]> {
  const logPath = path.join(cwd, HOOK_BYPASS_LOG);
  const bypasses: HookBypass[] = [];

  try {
    const content = await readFile(logPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);

    const sinceDate = since ? new Date(since).getTime() : 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as HookBypass;
        if (!sinceDate || new Date(entry.timestamp).getTime() >= sinceDate) {
          bypasses.push(entry);
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Log file doesn't exist or can't be read — return empty
  }

  return bypasses;
}

// ── Worktree Detection ──

/**
 * Check if the current directory is inside a git worktree.
 *
 * Runs `git rev-parse --is-inside-work-tree` and returns true
 * if the output is "true".
 */
export async function isWorktree(cwd: string): Promise<boolean> {
  if (!(await hasGit(cwd))) return false;
  const result = await runProcess({
    command: "git",
    args: ["rev-parse", "--is-inside-work-tree"],
    cwd,
    timeout: GIT_DEFAULT_TIMEOUT,
  });
  return result.exitCode === 0 && result.stdout === "true";
}

/**
 * List all git worktrees for the repository.
 *
 * Parses `git worktree list` output which has the format:
 *   <path>  <branch>  [<status>]
 *
 * Returns the list of worktree paths.
 */
export async function getWorktreeList(cwd: string): Promise<string[]> {
  if (!(await hasGit(cwd))) return [];
  const result = await runProcess({
    command: "git",
    args: ["worktree", "list"],
    cwd,
    timeout: GIT_DEFAULT_TIMEOUT,
  });
  if (result.exitCode !== 0) return [];

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      // Format: /path/to/worktree  (branch)  [status]
      const parts = line.split(/\s+/);
      return parts[0] ?? "";
    })
    .filter((p) => p.length > 0);
}

// ── Submodule Detection ──

/**
 * Detect git submodules in the repository.
 *
 * Parses `git submodule status` to list all registered submodule paths.
 * Returns an empty array if no submodules exist.
 */
export async function detectSubmodules(cwd: string): Promise<string[]> {
  if (!(await hasGit(cwd))) return [];
  const result = await runProcess({
    command: "git",
    args: ["submodule", "status"],
    cwd,
    timeout: GIT_DEFAULT_TIMEOUT,
  });
  if (result.exitCode !== 0) return [];

  // Format: <status> <sha> <path> (<describe>)
  // status: - = uninitialized, + = modified, U = merge conflicts
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(/\s+/);
      // Path is the second whitespace-delimited field after the sha
      // Example: " 5a3f2c1 path/to/submodule (v1.0)"
      if (line.startsWith("-") || line.startsWith("+") || line.startsWith("U")) {
        return parts[1] ?? "";
      }
      // Without status prefix
      return parts[0] ?? "";
    })
    .filter((p) => p.length > 0);
}
