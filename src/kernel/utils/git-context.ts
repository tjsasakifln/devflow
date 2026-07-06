import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { ExecutionMode } from "../types/artifacts.js";

export interface GitContext {
  commitSha: string;
  branch: string;
  gitStatus: "clean" | "dirty" | "no-git";
  devflowVersion: string;
  executionMode: ExecutionMode;
}

/**
 * Capture git context at the current moment.
 * Used to stamp audit logs with verifiable provenance.
 */
export function captureGitContext(
  rootPath: string,
  mode: ExecutionMode = "local"
): GitContext {
  let commitSha = "unknown";
  let branch = "unknown";
  let gitStatus: "clean" | "dirty" | "no-git" = "no-git";

  try {
    commitSha = execSync("git rev-parse HEAD", {
      cwd: rootPath,
      encoding: "utf-8",
    }).trim();
  } catch { /* no git */ }

  try {
    branch = execSync("git branch --show-current", {
      cwd: rootPath,
      encoding: "utf-8",
    }).trim();
  } catch { /* no git */ }

  try {
    const status = execSync("git status --porcelain", {
      cwd: rootPath,
      encoding: "utf-8",
    }).trim();
    gitStatus = status.length === 0 ? "clean" : "dirty";
  } catch { /* no git */ }

  return {
    commitSha,
    branch,
    gitStatus,
    devflowVersion: "0.1.0",
    executionMode: mode,
  };
}

/**
 * Compute SHA256 hash of content for evidence integrity.
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
