/**
 * Git Adapter
 *
 * Wraps the safe process runner for common git operations.
 * Never shells out raw — always uses spawn with args array.
 */

import { runProcess } from "../process/safe-runner.js";
import { stat } from "node:fs/promises";
import path from "node:path";

// ── Types ──

export interface GitContext {
  hasGit: boolean;
  branch: string | null;
  commitSha: string | null;
  isClean: boolean;
  remoteName: string | null;
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
