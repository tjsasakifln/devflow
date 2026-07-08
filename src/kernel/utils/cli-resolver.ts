/**
 * CLI Invocation Resolver
 *
 * Detects how the `devflow` CLI is available to the user and returns the
 * correct command prefix to use in messages (onboarding, doctor, etc.).
 *
 * Resolution order (mandatory — local before global to avoid npx false positives):
 *   1. Local install  — `node_modules/.bin/devflow` exists (persistent, not temp)
 *   2. package.json   — `@tjsasakinpm/devflow` listed in dependencies/devDependencies
 *   3. Global install — `devflow` binary found in PATH (filtered: reject npx temp paths)
 *   4. None           — CLI not persistently available; use remote npx
 *
 * Result is cached per process — it will not change during a single run.
 */

import fs from "node:fs";
import path from "node:path";
import { fileExists } from "./fs.js";

export interface InvocationResult {
  /** How the CLI is available. */
  mode: "global" | "local" | "none";
  /** The command prefix users should type (no trailing space). */
  command: string;
  /** Shown as a suggestion when mode is 'none'. */
  installHint?: string;
}

// ── Cache (same pattern as getVersion) ──
let _cached: InvocationResult | null = null;

/**
 * Resolve how the `devflow` CLI should be invoked from `cwd`.
 * Cached — subsequent calls return the same result.
 */
export async function resolveInvocationCommand(
  cwd: string,
): Promise<InvocationResult> {
  if (_cached) return _cached;

  // 1. Local — node_modules/.bin/devflow exists (verify it's not a temp npx directory)
  const localBin = path.join(cwd, "node_modules", ".bin", "devflow");
  if (fs.existsSync(localBin)) {
    // Resolve symlink to verify the real path is not inside an npx temp directory
    let realPath: string;
    try {
      realPath = fs.realpathSync(localBin);
    } catch {
      realPath = localBin;
    }
    if (!isNpxTempPath(realPath)) {
      _cached = { mode: "local", command: "npx devflow" };
      return _cached;
    }
    // If the .bin/devflow points into an npx temp dir, treat as not installed
  }

  // 2. package.json — @tjsasakinpm/devflow listed in dependencies
  const pkgPath = path.join(cwd, "package.json");
  if (await fileExists(pkgPath)) {
    try {
      const raw = await fs.promises.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if ("@tjsasakinpm/devflow" in deps) {
        _cached = {
          mode: "local",
          command: "npx devflow",
          installHint: "Run `npm install` if not yet installed.",
        };
        return _cached;
      }
    } catch {
      // Malformed package.json — fall through
    }
  }

  // 3. Global — devflow binary found in PATH (reject npx temp directories)
  const globalPath = findInPath("devflow");
  if (globalPath !== null) {
    _cached = { mode: "global", command: "devflow" };
    return _cached;
  }

  // 4. None — not available persistently
  _cached = {
    mode: "none",
    command: "npx -y @tjsasakinpm/devflow@latest",
    installHint: "Install persistently: npm install --save-dev @tjsasakinpm/devflow",
  };
  return _cached;
}

/**
 * Reset the internal cache. Only exposed for testing.
 */
export function _resetCache(): void {
  _cached = null;
}

/**
 * Check whether a file path is inside a temporary npx/npm exec directory.
 * These directories contain transient binaries that disappear after the
 * npx process exits — they must NOT be treated as persistent installs.
 */
export function isNpxTempPath(filePath: string): boolean {
  const normalized = path.normalize(filePath);

  // Patterns that indicate a temporary npx/npm exec directory
  const tempPatterns = [
    "_npx",
    ".npm" + path.sep + "_npx",
    "npm-cache" + path.sep + "_npx",
  ];

  for (const pattern of tempPatterns) {
    if (normalized.includes(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Search for an executable in the system PATH.
 * Returns the resolved path if found and valid (persistent, not npx temp),
 * or null if not found or found only in temp npx directories.
 */
function findInPath(binaryName: string): string | null {
  const PATH = (process.env.PATH || process.env.Path || "").split(path.delimiter);

  for (const dir of PATH) {
    if (!dir) continue;

    const candidate = path.join(dir, binaryName);
    try {
      // fs.statSync throws if the file doesn't exist
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        // On non-Windows we also need execute permission
        try {
          fs.accessSync(candidate, fs.constants.X_OK);
          // Reject if the binary is inside an npx temp directory
          if (!isNpxTempPath(candidate)) {
            return candidate;
          }
          // Found in npx temp — keep looking for a real persistent install
        } catch {
          // Not executable — keep looking
        }
      }
    } catch {
      // Not found — keep looking
    }

    // Windows: also check .cmd and .exe extensions
    if (process.platform === "win32") {
      for (const ext of [".cmd", ".exe", ".ps1"]) {
        const winCandidate = path.join(dir, binaryName + ext);
        try {
          const stat = fs.statSync(winCandidate);
          if (stat.isFile()) {
            if (!isNpxTempPath(winCandidate)) {
              return winCandidate;
            }
          }
        } catch {
          // Not found
        }
      }
    }
  }

  return null;
}
