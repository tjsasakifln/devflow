/**
 * CLI Invocation Resolver
 *
 * Detects how the `devflow` CLI is available to the user and returns the
 * correct command prefix to use in messages (onboarding, doctor, etc.).
 *
 * Detection order:
 *   1. Global install — `devflow` binary found in PATH
 *   2. Local install  — `node_modules/.bin/devflow` exists
 *   3. package.json   — `@tjsasakinpm/devflow` listed in dependencies
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

  // 1. Global — devflow binary found in PATH
  if (findInPath("devflow")) {
    _cached = { mode: "global", command: "devflow" };
    return _cached;
  }

  // 2. Local — node_modules/.bin/devflow exists
  const localBin = path.join(cwd, "node_modules", ".bin", "devflow");
  if (fs.existsSync(localBin)) {
    _cached = { mode: "local", command: "npx devflow" };
    return _cached;
  }

  // 3. package.json — @tjsasakinpm/devflow listed in dependencies
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
      // Malformed package.json — fall through to 'none'
    }
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
 * Check whether an executable name resolves in the system PATH.
 * Uses synchronous stat for speed (called at most once per process).
 */
function findInPath(binaryName: string): boolean {
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
          return true;
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
          if (stat.isFile()) return true;
        } catch {
          // Not found
        }
      }
    }
  }

  return false;
}
