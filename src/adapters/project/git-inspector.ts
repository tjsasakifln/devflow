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

    // Use faster git status detection:
    // git diff --quiet is much faster than git status --porcelain for dirty checking.
    // execSync throws on non-zero exit (which is what --quiet uses for "has changes").
    let gitStatus = "clean";
    try {
      // Check for staged or unstaged changes (fast - exit code only).
      // execSync throws on non-zero exit; catch to handle "has changes" case.
      let hasWorkingChanges = false;
      try {
        execSync("git diff --quiet HEAD", {
          cwd: rootPath, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        hasWorkingChanges = true;
      }

      let hasStagedChanges = false;
      try {
        execSync("git diff --cached --quiet", {
          cwd: rootPath, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        hasStagedChanges = true;
      }

      if (hasWorkingChanges || hasStagedChanges) {
        gitStatus = "dirty";
      } else {
        // Only check untracked if working tree is otherwise clean
        const untracked = execSync("git ls-files --others --exclude-standard", {
          cwd: rootPath, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        if (untracked.length > 0) {
          gitStatus = "untracked";
        }
      }
    } catch {
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
