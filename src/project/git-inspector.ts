import { execSync } from "node:child_process";

export interface GitInfo {
  hasGit: boolean;
  hasRemote: boolean;
  currentBranch: string | null;
  gitStatus: string; // "clean" | "dirty" | "untracked" | "no-git"
}

export function inspectGit(rootPath: string): GitInfo {
  try {
    const hasGit = execSync("git rev-parse --is-inside-work-tree", {
      cwd: rootPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (hasGit !== "true") {
      return { hasGit: false, hasRemote: false, currentBranch: null, gitStatus: "no-git" };
    }

    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: rootPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    let hasRemote = false;
    try {
      const remotes = execSync("git remote", {
        cwd: rootPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      hasRemote = remotes.length > 0;
    } catch {
      hasRemote = false;
    }

    const status = execSync("git status --porcelain", {
      cwd: rootPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    let gitStatus: string;
    if (status.length === 0) {
      gitStatus = "clean";
    } else if (status.split("\n").every((line) => line.startsWith("??"))) {
      gitStatus = "untracked";
    } else {
      gitStatus = "dirty";
    }

    return {
      hasGit: true,
      hasRemote,
      currentBranch: currentBranch || null,
      gitStatus,
    };
  } catch {
    return { hasGit: false, hasRemote: false, currentBranch: null, gitStatus: "no-git" };
  }
}
