import { execSync } from "node:child_process";

/**
 * Result of solo developer detection.
 */
export interface SoloDetectionResult {
  /** Number of unique committers in the last 30 days */
  committerCount: number;
  /** Whether the project appears to be solo-developed (1 committer in 30 days) */
  isSolo: boolean;
  /** Raw list of committer names/emails found */
  committers: string[];
  /** Error message if git command failed */
  error?: string;
}

/**
 * Detect whether the project at rootPath is solo-developed.
 *
 * Runs `git shortlog -sne --since="30 days ago"` in the project root
 * and counts unique committers.
 *
 * @param rootPath - Absolute path to the git repository root
 * @returns SoloDetectionResult with committer count and solo flag
 */
export function detectSoloDeveloper(rootPath: string): SoloDetectionResult {
  const result: SoloDetectionResult = {
    committerCount: 0,
    isSolo: false,
    committers: [],
  };

  try {
    const output = execSync('git shortlog -sne --since="30 days ago"', {
      cwd: rootPath,
      encoding: "utf-8",
      timeout: 10_000,
    });

    const lines = output.trim().split("\n").filter((l) => l.trim());

    // Each line looks like: "     5\tDeveloper Name <email@example.com>"
    for (const line of lines) {
      const match = line.match(/^\s*\d+\s+(.+)$/);
      if (match?.[1]) {
        result.committers.push(match[1].trim());
      }
    }

    result.committerCount = result.committers.length;
    result.isSolo = result.committerCount <= 1;
  } catch (err: unknown) {
    result.error = err instanceof Error ? err.message : String(err);
    // If git is not available or not a git repo, assume safety: not solo
    result.isSolo = false;
    result.committerCount = 0;
  }

  return result;
}
