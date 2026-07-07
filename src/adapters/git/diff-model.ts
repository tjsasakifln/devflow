/**
 * Git Diff Model
 *
 * Unified model for parsing and representing git diffs
 * with support for staged, unstaged, and branch-based diffs.
 *
 * All git commands use execSync with a 15s timeout, wrapped in try/catch
 * returning sensible defaults on failure.
 */

import { execSync } from "node:child_process";

// ── Types ──

export interface DiffFile {
  path: string;
  oldPath?: string;
  status:
    | "added"
    | "modified"
    | "deleted"
    | "renamed"
    | "copied"
    | "unmerged"
    | "unknown";
  staged: boolean;
  unstaged: boolean;
  binary: boolean;
  additions?: number;
  deletions?: number;
}

export interface DiffModel {
  files: DiffFile[];
  stagedFiles: DiffFile[];
  unstagedFiles: DiffFile[];
  baseFiles: DiffFile[];
  mergeBase: string;
  baseBranch: string;
  headRef: string;
}

// ── Constants ──

const DIFF_TIMEOUT = 15_000;

// ── Internal Helpers ──

/**
 * Run a git command via execSync, return trimmed stdout.
 * Returns empty string on failure (no git, timeout, non-zero exit).
 */
function tryExecGit(command: string, cwd: string): string {
  try {
    const output = execSync(`git ${command}`, {
      cwd,
      timeout: DIFF_TIMEOUT,
      encoding: "utf-8",
    });
    return (output ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Compute the merge base between two refs.
 */
export function getMergeBase(cwd: string, base: string): string {
  return tryExecGit(`merge-base ${base} HEAD`, cwd);
}

// ── Parsers ──

/**
 * Parse git diff --name-status output.
 *
 * Status format:
 *   M\tfile.ts                          (modified)
 *   A\tfile.ts                          (added)
 *   D\tfile.ts                          (deleted)
 *   R100\told.ts\tnew.ts                (renamed, with similarity)
 *   C100\told.ts\tnew.ts                (copied, with similarity)
 */
export function parseNameStatus(
  output: string,
): Array<{ status: string; path: string; oldPath?: string }> {
  if (!output) return [];

  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const parts = line.split("\t");
    const rawStatus = parts[0] ?? "";
    // Strip similarity percentage from R/C status codes (e.g. R100 -> R)
    const status = rawStatus.replace(/[0-9]+$/, "");

    if (status === "R" || status === "C") {
      return {
        status,
        path: parts[2] ?? parts[1] ?? "",
        oldPath: parts[1],
      };
    }

    return {
      status,
      path: parts[1] ?? "",
    };
  });
}

/**
 * Parse git diff --numstat output.
 *
 * Numstat format:
 *   1\t2\tpath/to/file.ts
 *   -\t-\tpath/to/binary.png     (binary file, add/del are dashes)
 *   1\t2\told.ts\tnew.ts         (rename shows both paths)
 */
export function parseNumStat(
  output: string,
): Array<{
  additions: number;
  deletions: number;
  path: string;
  binary: boolean;
}> {
  if (!output) return [];

  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const parts = line.split("\t");
    const addRaw = parts[0] ?? "";
    const delRaw = parts[1] ?? "";

    // Binary files have dashes instead of line counts
    if (addRaw === "-" && delRaw === "-") {
      // Numstat for renames may have two paths: old<tab>new
      const path = parts.slice(2).join("\t");
      return { additions: 0, deletions: 0, path, binary: true };
    }

    const additions = parseInt(addRaw, 10);
    const deletions = parseInt(delRaw, 10);
    // For renames, the last path is the new (current) path
    const path = parts.slice(2).join("\t");

    return {
      additions: Number.isNaN(additions) ? 0 : additions,
      deletions: Number.isNaN(deletions) ? 0 : deletions,
      path,
      binary: false,
    };
  });
}

// ── Binary Detection ──

/**
 * Check if a file is binary using `git diff --numstat`.
 *
 * Runs a git diff against HEAD. If the output contains "-\t-", the file
 * is binary. Falls back to false when git info is unavailable.
 */
export function isBinary(filePath: string, cwd: string): boolean {
  try {
    const output = execSync(`git diff --numstat HEAD -- ${escapeShellArg(filePath)}`, {
      cwd,
      timeout: DIFF_TIMEOUT,
      encoding: "utf-8",
    });
    const trimmed = (output ?? "").trim();
    if (!trimmed) return false; // no diff available, assume text
    return trimmed.startsWith("-\t-");
  } catch {
    return false;
  }
}

/**
 * Minimal shell argument escaping for git paths.
 * Wraps in single quotes with proper handling of embedded single quotes.
 */
function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

// ── DiffModel Builder ──

/**
 * Build a DiffModel for the given working directory.
 *
 * @param cwd - Git repository working directory.
 * @param opts - Options controlling what diffs to include.
 * @param opts.base - Compare against this base ref (merge-base..HEAD).
 * @param opts.staged - Only include staged (cached) changes.
 * @param opts.workingTree - Only include unstaged working tree changes.
 *
 * When neither `staged` nor `workingTree` is set, both are included.
 * When `base` is set, staged changes are computed against the base ref.
 */
export async function buildDiffModel(
  cwd: string,
  opts: { base?: string; staged?: boolean; workingTree?: boolean } = {},
): Promise<DiffModel> {
  const headRef = tryExecGit("rev-parse HEAD", cwd);
  const baseBranch =
    opts.base ??
    (tryExecGit("rev-parse --abbrev-ref HEAD", cwd) || "HEAD");
  const mergeBase = opts.base
    ? tryExecGit(`merge-base ${opts.base} HEAD`, cwd)
    : "";

  // If we have no git context, return empty model
  if (!headRef) {
    return {
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      baseFiles: [],
      mergeBase,
      baseBranch,
      headRef: "",
    };
  }

  // Determine what to show
  const showStaged = opts.staged !== false || !opts.workingTree;
  const showUnstaged = opts.workingTree !== false || !opts.staged;

  let stagedFiles: DiffFile[] = [];
  let unstagedFiles: DiffFile[] = [];
  let baseFiles: DiffFile[] = [];

  // ── Staged changes (or base diff when base is provided) ──
  if (showStaged) {
    if (opts.base) {
      const mb = mergeBase || opts.base;
      const nameStatus = tryExecGit(
        `diff --name-status -M ${mb}..HEAD`,
        cwd,
      );
      const numStat = tryExecGit(`diff --numstat ${mb}..HEAD`, cwd);
      baseFiles = buildFileList(nameStatus, numStat);
      baseFiles = baseFiles.map((f) => ({
        ...f,
        staged: false,
        unstaged: false,
      }));
    } else {
      const nameStatus = tryExecGit(
        "diff --cached --name-status -M",
        cwd,
      );
      const numStat = tryExecGit("diff --cached --numstat", cwd);
      stagedFiles = buildFileList(nameStatus, numStat);
      stagedFiles = stagedFiles.map((f) => ({
        ...f,
        staged: true,
        unstaged: false,
      }));
    }
  }

  // ── Unstaged changes ──
  if (showUnstaged) {
    const nameStatus = tryExecGit("diff --name-status -M", cwd);
    const numStat = tryExecGit("diff --numstat", cwd);
    unstagedFiles = buildFileList(nameStatus, numStat);
    unstagedFiles = unstagedFiles.map((f) => ({
      ...f,
      staged: false,
      unstaged: true,
    }));
  }

  // ── Detect unmerged files ──
  const unmergedRaw = tryExecGit(
    "diff --name-only --diff-filter=U --cached",
    cwd,
  );
  if (unmergedRaw) {
    const unmergedPaths = unmergedRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const unmergedSet = new Set(unmergedPaths);

    for (const f of stagedFiles) {
      if (unmergedSet.has(f.path)) {
        f.status = "unmerged";
      }
    }
    for (const f of unstagedFiles) {
      if (unmergedSet.has(f.path)) {
        f.status = "unmerged";
      }
    }

    // Add unmerged entries not already in staged/unstaged
    for (const up of unmergedPaths) {
      const alreadyTracked =
        stagedFiles.some((f) => f.path === up) ||
        unstagedFiles.some((f) => f.path === up);
      if (!alreadyTracked) {
        stagedFiles.push({
          path: up,
          status: "unmerged",
          staged: true,
          unstaged: false,
          binary: isBinary(up, cwd),
        });
      }
    }
  }

  // ── Merge staged + unstaged + base into a single deduplicated list ──
  const files = mergeFileLists(mergeFileLists(stagedFiles, unstagedFiles), baseFiles);

  return {
    files,
    stagedFiles,
    unstagedFiles,
    baseFiles,
    mergeBase,
    baseBranch,
    headRef,
  };
}

// ── Internal: Build DiffFile list from name-status and numstat ──

function buildFileList(nameStatusOutput: string, numStatOutput: string): DiffFile[] {
  const statusEntries = parseNameStatus(nameStatusOutput);
  const countEntries = parseNumStat(numStatOutput);

  const countMap = new Map<string, {
    additions: number;
    deletions: number;
    binary: boolean;
  }>();

  for (const entry of countEntries) {
    // Use the first path segment before tab if rename split into two paths
    // Numstat for renames shows: additions<tab>deletions<tab>oldpath<tab>newpath
    // We stored the concatenation (parts.slice(2).join("\t")), so check both
    const pathKey = entry.path;
    countMap.set(pathKey, {
      additions: entry.additions,
      deletions: entry.deletions,
      binary: entry.binary,
    });
  }

  return statusEntries.map((entry) => {
    const counts = countMap.get(entry.path);
    const binary = counts
      ? counts.binary
      : false;
    const additions = counts?.additions;
    const deletions = counts?.deletions;

    return {
      path: entry.path,
      oldPath: entry.oldPath,
      status: normalizeStatus(entry.status),
      staged: false,
      unstaged: false,
      binary,
      additions,
      deletions,
    };
  });
}

/**
 * Normalize single-letter git status codes to our enum values.
 */
function normalizeStatus(
  status: string,
): DiffFile["status"] {
  switch (status) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "U":
      return "unmerged";
    default:
      return "unknown";
  }
}

/**
 * Merge two DiffFile lists, combining entries that appear in both.
 * When a file is both staged and unstaged, the combined entry gets
 * summed addition/deletion counts and both flags set to true.
 */
function mergeFileLists(staged: DiffFile[], unstaged: DiffFile[]): DiffFile[] {
  const map = new Map<string, DiffFile>();

  for (const f of staged) {
    map.set(f.path, { ...f });
  }

  for (const f of unstaged) {
    const existing = map.get(f.path);
    if (existing) {
      existing.unstaged = true;
      existing.additions =
        (existing.additions ?? 0) + (f.additions ?? 0);
      existing.deletions =
        (existing.deletions ?? 0) + (f.deletions ?? 0);
      // If either is binary, the combined result is binary
      if (f.binary) existing.binary = true;
    } else {
      map.set(f.path, { ...f });
    }
  }

  return Array.from(map.values());
}
