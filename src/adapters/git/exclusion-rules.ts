/**
 * Exclusion Rules
 *
 * Provides gitignore-style exclusion rules for filtering files
 * from analysis, diffs, and other operations.
 *
 * Supports .devflowignore (same syntax as .gitignore) merged with
 * built-in defaults and the project's .gitignore.
 */

import { readFileSync, readdirSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// ── Types ──

export interface ExclusionRules {
  patterns: string[];
  defaultExcludes: string[];
}

// ── Default Exclusions ──

/**
 * Return the built-in default exclusion patterns.
 *
 * These cover common build output directories, generated files,
 * minified assets, dependency directories, and coverage output.
 */
export function defaultExclusionPatterns(): string[] {
  return [
    // Build outputs
    "dist/",
    "build/",
    ".next/",
    "out/",

    // Python
    "__pycache__/",
    "*.pyc",
    ".mypy_cache/",
    ".ruff_cache/",
    ".pytest_cache/",

    // Generated / minified
    "*.generated.*",
    "*.min.js",
    "*.min.css",

    // Dependencies
    "node_modules/",

    // VCS
    ".git/",
    ".git/**/*",

    // Coverage
    "coverage/",
    ".nyc_output/",

    // Rust
    "target/",

    // Composer (PHP)
    "vendor/",
  ];
}

// ── Pattern Loading ──

/**
 * Load exclusion rules for the given working directory.
 *
 * Load order (later patterns override earlier ones):
 * 1. Built-in defaults
 * 2. Patterns from .gitignore (if exists)
 * 3. Patterns from .devflowignore (if exists)
 *
 * All file reads use synchronous I/O (config-level operation).
 */
export function loadExclusionRules(cwd: string): ExclusionRules {
  const defaultExcludes = defaultExclusionPatterns();
  const patterns: string[] = [...defaultExcludes];

  // Load .gitignore
  const gitignorePath = path.join(cwd, ".gitignore");
  try {
    const content = readFileSync(gitignorePath, "utf-8");
    const gitignorePatterns = parseIgnoreFile(content);
    patterns.push(...gitignorePatterns);
  } catch {
    // .gitignore doesn't exist or can't be read — skip
  }

  // Load .devflowignore
  const devflowignorePath = path.join(cwd, ".devflowignore");
  try {
    const content = readFileSync(devflowignorePath, "utf-8");
    const devflowPatterns = parseIgnoreFile(content);
    patterns.push(...devflowPatterns);
  } catch {
    // .devflowignore doesn't exist — skip
  }

  return { patterns, defaultExcludes };
}

/**
 * Parse a .gitignore-style file into an array of patterns.
 * Strips comments, empty lines, and trims whitespace.
 */
function parseIgnoreFile(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

// ── Pattern Matching ──

/**
 * Determine whether a file path should be excluded according to the rules.
 *
 * Processes patterns in order — the last matching pattern wins.
 * Negation patterns (prefixed with `!`) can re-include files.
 */
export function shouldExclude(filePath: string, rules: ExclusionRules): boolean {
  const normalizedPath = normalizePath(filePath);
  let excluded = false;

  for (const pattern of rules.patterns) {
    const result = testPattern(normalizedPath, pattern);
    if (result === null) continue;
    excluded = result;
  }

  return excluded;
}

/**
 * Filter a list of file paths, returning only those that are NOT excluded.
 */
export function filterExcludedFiles(
  files: string[],
  rules: ExclusionRules,
): string[] {
  return files.filter((f) => !shouldExclude(f, rules));
}

// ── Monorepo Detection ──

/**
 * Scan a directory for monorepo package roots.
 *
 * Checks for:
 * - package.json (non-root, non-private, or workspaces member)
 * - pyproject.toml
 * - go.mod
 * - Cargo.toml
 *
 * Returns relative paths from the given cwd.
 */
export async function detectMonorepoPackages(cwd: string): Promise<string[]> {
  const packages: string[] = [];
  const rootPkgPath = path.join(cwd, "package.json");

  // Determine workspace directories from root package.json
  const workspaceDirs = await getWorkspaceDirs(rootPkgPath, cwd);

  // Scan workspace directories for package manifests
  for (const dir of workspaceDirs) {
    const absDir = path.resolve(cwd, dir);

    try {
      const dirStat = await stat(absDir);
      if (!dirStat.isDirectory()) continue;
    } catch {
      continue;
    }

    // Check for package.json
    const pkgJsonPath = path.join(absDir, "package.json");
    try {
      await stat(pkgJsonPath);
      packages.push(dir);
      continue; // Already identified as package, skip other checks
    } catch {
      // No package.json, check for other manifests
    }

    // Check for pyproject.toml
    try {
      await stat(path.join(absDir, "pyproject.toml"));
      packages.push(dir);
      continue;
    } catch {
      // No pyproject.toml
    }

    // Check for go.mod
    try {
      await stat(path.join(absDir, "go.mod"));
      packages.push(dir);
      continue;
    } catch {
      // No go.mod
    }

    // Check for Cargo.toml
    try {
      await stat(path.join(absDir, "Cargo.toml"));
      packages.push(dir);
    } catch {
      // No Cargo.toml
    }
  }

  return packages.sort();
}

/**
 * Get workspace directories from a root package.json.
 * Falls back to scanning immediate subdirectories.
 */
async function getWorkspaceDirs(
  rootPkgPath: string,
  cwd: string,
): Promise<string[]> {
  try {
    const content = readFileSync(rootPkgPath, "utf-8");
    const pkg = JSON.parse(content) as {
      workspaces?: string[] | { packages: string[] };
    };

    if (pkg.workspaces) {
      if (Array.isArray(pkg.workspaces)) {
        return expandGlobPatterns(pkg.workspaces, cwd);
      }
      if (pkg.workspaces.packages) {
        return expandGlobPatterns(pkg.workspaces.packages, cwd);
      }
    }
  } catch {
    // No root package.json — scan subdirectories
  }

  // Fallback: scan immediate subdirectories for manifests
  return scanSubdirectoriesForManifests(cwd);
}

/**
 * Expand simple glob patterns by scanning the filesystem.
 * Handles `packages/*` style patterns by listing matching directories.
 */
function expandGlobPatterns(patterns: string[], cwd: string): string[] {
  const dirs: string[] = [];

  for (const pattern of patterns) {
    // Handle `packages/*` → list `packages/` subdirectories
    if (pattern.endsWith("/*") || pattern.endsWith("/*/")) {
      const baseDir = pattern.replace(/\/\*\/?$/, "");
      const absBase = path.resolve(cwd, baseDir);

      try {
        const entries = readdirSync(absBase, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            dirs.push(path.posix.join(baseDir, entry.name));
          }
        }
      } catch {
        // Directory doesn't exist — skip
      }
    } else {
      // Literal directory match
      dirs.push(pattern);
    }
  }

  return dirs;
}

/**
 * Scan immediate subdirectories for package manifests.
 */
async function scanSubdirectoriesForManifests(cwd: string): Promise<string[]> {
  const manifests = ["package.json", "pyproject.toml", "go.mod", "Cargo.toml"];
  const dirs: string[] = [];

  try {
    const entries = await readdir(cwd, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      for (const manifest of manifests) {
        try {
          const manifestPath = path.join(cwd, entry.name, manifest);
          await stat(manifestPath);
          dirs.push(entry.name);
          break;
        } catch {
          // No manifest found — continue checking
        }
      }
    }
  } catch {
    // Can't read directory — return empty
  }

  return dirs;
}

// ── Pattern Testing ──

/**
 * Test a single gitignore-style pattern against a file path.
 *
 * Returns:
 *   - `true`  → path matches (exclude/re-include)
 *   - `false` → path matches negation pattern (re-include)
 *   - `null`  → no match
 */
function testPattern(filePath: string, pattern: string): boolean | null {
  if (!pattern || pattern.startsWith("#")) return null;

  let negate = false;
  let p = pattern;

  // Handle negation
  if (p.startsWith("!")) {
    negate = true;
    p = p.slice(1).trim();
  }

  if (!p) return null;

  const dirOnly = p.endsWith("/");
  if (dirOnly) p = p.slice(0, -1);

  const anchored = p.startsWith("/");
  if (anchored) p = p.slice(1);

  // Handle ** edge case — matches everything
  if (p === "**") {
    return negate ? false : true;
  }

  // Build regex from pattern
  let regexSource = "";
  let i = 0;

  while (i < p.length) {
    const ch = p[i]!;

    if (ch === "*" && p[i + 1] === "*") {
      // ** matches across directory boundaries
      regexSource += ".*";
      i += 2;
      // Skip optional trailing /
      if (p[i] === "/") i++;
    } else if (ch === "*") {
      // * matches within a single path segment
      regexSource += "[^/]*";
      i++;
    } else if (ch === "?") {
      // ? matches a single non-slash character
      regexSource += "[^/]";
      i++;
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      regexSource += "\\" + ch;
      i++;
    } else {
      regexSource += ch;
      i++;
    }
  }

  // Build the full regex
  let fullSource: string;

  if (anchored) {
    fullSource = `^${regexSource}`;
  } else {
    fullSource = `(?:^|/)${regexSource}`;
  }

  if (dirOnly) {
    fullSource += `(?:/.*)?`;
  }

  fullSource += "$";

  try {
    const regex = new RegExp(fullSource);
    const matched = regex.test(filePath);

    if (matched) {
      return negate ? false : true;
    }
  } catch {
    // Invalid regex pattern — skip
  }

  return null;
}

// ── Helpers ──

/**
 * Normalize a file path for pattern matching:
 * - Convert backslashes to forward slashes
 * - Strip leading ./
 * - Remove trailing slash
 */
function normalizePath(filePath: string): string {
  let normalized = filePath.replace(/\\/g, "/");

  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}
