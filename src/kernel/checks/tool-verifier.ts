/**
 * Tool Verifier — Pre-flight tool availability check for adversarial review.
 *
 * Checks whether external tools (dependency-cruiser, jscpd, etc.) are installed
 * before the adversarial review runs its attack vectors. Provides clear install
 * instructions and optional auto-install for missing tools.
 *
 * Cross-platform: uses `which` on POSIX, `where` on Windows.
 */

import { execSync, type ExecSyncOptions } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// ── Types ──

/** Metadata about an external tool that an attack vector depends on. */
export interface ToolInfo {
  /** Short identifier (e.g., "dependency-cruiser"). */
  name: string;
  /** Human-readable display name. */
  displayName: string;
  /** Binary name(s) to check on PATH or in node_modules/.bin/ */
  binaryNames: string[];
  /** npm package name for install. */
  packageName: string;
  /** Names of attack vectors that rely on this tool. */
  usedByVectors: string[];
  /** Install hint shown to the user. */
  installHint: string;
}

/** Result of checking a single tool. */
export interface ToolStatus {
  /** The tool definition that was checked. */
  tool: ToolInfo;
  /** Whether the tool is available for use. */
  available: boolean;
  /** Version string if available. */
  version?: string;
  /** Error or reason if not available. */
  error?: string;
}

/** Consolidated pre-flight result. */
export interface PreFlightResult {
  /** Status for each known tool. */
  tools: ToolStatus[];
  /** Shortcut: all tools available? */
  allAvailable: boolean;
  /** Tools that are missing. */
  missing: ToolStatus[];
  /** Vector names that cannot run due to missing tools. */
  blockedVectors: string[];
}

// ── Known Tools ──

const CROSS_PLATFORM_TOOLS: ToolInfo[] = [
  {
    name: "dependency-cruiser",
    displayName: "Dependency Cruiser",
    binaryNames: ["dependency-cruiser", "depcruise"],
    packageName: "dependency-cruiser",
    usedByVectors: ["Hidden Coupling"],
    installHint: "npm install --save-dev dependency-cruiser",
  },
  {
    name: "jscpd",
    displayName: "jscpd (Copy/Paste Detector)",
    binaryNames: ["jscpd"],
    packageName: "jscpd",
    usedByVectors: ["Code Duplication"],
    installHint: "npm install --save-dev jscpd",
  },
  {
    name: "madge",
    displayName: "Madge (Module Dependency Graph)",
    binaryNames: ["madge"],
    packageName: "madge",
    usedByVectors: [],  // Not currently used by any vector, but known
    installHint: "npm install --save-dev madge",
  },
];

// ── Helpers ──

/** Determine which binary to use for availability checks based on platform. */
function getWhichCommand(): string {
  return process.platform === "win32" ? "where" : "which";
}

/**
 * Try to resolve a binary using PATH and node_modules/.bin/.
 * Returns the resolved path or null.
 */
function resolveBinary(binaryName: string, cwd: string): string | null {
  // 1. Check node_modules/.bin/ first (fast, no PATH required)
  const localBin = path.join(cwd, "node_modules", ".bin", binaryName);
  if (existsSync(localBin)) {
    return localBin;
  }

  // 2. Try `which`/`where` on PATH
  try {
    const whichCmd = getWhichCommand();
    const result = execSync(`${whichCmd} ${binaryName}`, {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const resolved = result.trim().split("\n")[0];
    if (resolved) return resolved;
  } catch {
    // Not found on PATH either
  }

  return null;
}

/**
 * Attempt to get the version of an installed tool.
 * Returns the version string or null.
 */
function getToolVersion(binaryName: string, cwd: string): string | null {
  try {
    const localBin = path.join(cwd, "node_modules", ".bin", binaryName);
    if (!existsSync(localBin)) return null;

    const result = execSync(`"${localBin}" --version 2>/dev/null || ${binaryName} --version 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
      cwd,
    });
    const version = result.trim().split("\n")[0];
    return version || null;
  } catch {
    return null;
  }
}

// ── Public API ──

/** Return the list of known tools that should be checked. */
export function getKnownTools(): ToolInfo[] {
  return CROSS_PLATFORM_TOOLS;
}

/**
 * Check if a single tool is available.
 * Tries node_modules/.bin/ first, then falls back to PATH.
 */
export async function checkToolAvailability(
  tool: ToolInfo,
  cwd: string,
): Promise<ToolStatus> {
  for (const binaryName of tool.binaryNames) {
    const resolved = resolveBinary(binaryName, cwd);
    if (resolved) {
      const version = getToolVersion(binaryName, cwd);
      return { tool, available: true, version: version ?? undefined };
    }
  }

  return {
    tool,
    available: false,
    error: `Not found in node_modules/.bin/ or PATH. Install with: ${tool.installHint}`,
  };
}

/**
 * Run the full pre-flight tool check.
 * Checks every known tool and returns a consolidated result.
 */
export async function runPreFlightCheck(cwd: string): Promise<PreFlightResult> {
  const knownTools = getKnownTools();
  const results = await Promise.all(
    knownTools.map((tool) => checkToolAvailability(tool, cwd)),
  );

  const missing = results.filter((r) => !r.available);
  const blockedVectors: string[] = [];
  for (const t of missing) {
    for (const v of t.tool.usedByVectors) {
      if (!blockedVectors.includes(v)) {
        blockedVectors.push(v);
      }
    }
  }

  return {
    tools: results,
    allAvailable: missing.length === 0,
    missing,
    blockedVectors,
  };
}

/**
 * Format the pre-flight results as a status table string.
 * Uses emoji indicators for visual clarity.
 */
export function formatToolTable(result: PreFlightResult): string {
  const lines: string[] = [];
  lines.push("┌────────────────────────────┬──────────┬──────────────────────────────┐");
  lines.push("│ Tool                       │ Status   │ Details                      │");
  lines.push("├────────────────────────────┼──────────┼──────────────────────────────┤");

  for (const status of result.tools) {
    const icon = status.available ? "  OK  " : " MISS ";
    const detail = status.available
      ? (status.version ?? "available")
      : `Install: ${status.tool.installHint}`;
    const toolName = status.tool.displayName.padEnd(26).slice(0, 26);
    const detailTrimmed = detail.padEnd(28).slice(0, 28);
    lines.push(`│ ${toolName} │ ${icon}  │ ${detailTrimmed} │`);
  }

  lines.push("└────────────────────────────┴──────────┴──────────────────────────────┘");

  // Add vector impact summary
  if (result.blockedVectors.length > 0) {
    lines.push("");
    lines.push(
      `  ${result.blockedVectors.length} vector(s) will be skipped: ${result.blockedVectors.join(", ")}`,
    );
    lines.push(
      `  Use --install-missing to auto-install, or install manually and re-run.`,
    );
  }

  return lines.join("\n");
}

/**
 * Create a set of vector names that are blocked due to missing tools.
 */
export function getBlockedVectorSet(result: PreFlightResult): Set<string> {
  return new Set(result.blockedVectors);
}

/**
 * Install a missing tool via npm install --save-dev.
 * Throws on failure.
 */
export async function installMissingTool(
  tool: ToolInfo,
  cwd: string,
): Promise<void> {
  const execOptions: ExecSyncOptions = {
    cwd,
    encoding: "utf-8",
    timeout: 120_000,
    stdio: "pipe",
  };

  execSync(`npm install --save-dev ${tool.packageName}`, execOptions);
}

/**
 * Install all missing tools.
 * Returns list of (toolName, success) tuples.
 */
export async function installAllMissing(
  missing: ToolStatus[],
  cwd: string,
): Promise<Array<{ name: string; success: boolean; error?: string }>> {
  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  for (const status of missing) {
    try {
      await installMissingTool(status.tool, cwd);
      results.push({ name: status.tool.name, success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: status.tool.name, success: false, error: msg });
    }
  }

  return results;
}
