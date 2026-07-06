/**
 * Safe Process Runner
 *
 * Executes external commands securely:
 * - Uses spawn/execFile, never exec (no shell injection).
 * - Validates cwd before running.
 * - Mandatory timeout on every call.
 * - Separate stdout/stderr capture.
 * - Command allowlist support.
 */

import { spawn, type SpawnOptions } from "node:child_process";
import { stat } from "node:fs/promises";

// ── Types ──

export interface RunOptions {
  /** Binary to execute (e.g., "node", "git", "npx"). */
  command: string;
  /** Arguments array — NEVER concatenated into a shell string. */
  args: string[];
  /** Working directory — validated to exist before running. */
  cwd: string;
  /** Mandatory timeout in milliseconds. */
  timeout: number;
  /** Environment variables to merge with process.env. */
  env?: Record<string, string>;
  /** If set, command must be in this list. */
  allowedCommands?: string[];
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  killed: boolean;
}

// ── Defaults ──

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_ALLOWLIST: string[] = [
  "git",
  "node",
  "npx",
  "npm",
  "tsc",
  "eslint",
  "vitest",
  "madge",
  "depcruise",
  "dependency-cruiser",
  "jscpd",
  "gh",
];

// ── Validation ──

/** Verify that a directory exists and is accessible. */
export async function validateCwd(cwd: string): Promise<boolean> {
  try {
    const s = await stat(cwd);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/** Check if a command is in the allowlist. */
export function isAllowedCommand(
  command: string,
  allowlist: string[] = DEFAULT_ALLOWLIST,
): boolean {
  return allowlist.includes(command);
}

// ── Runner ──

/**
 * Run a command safely.
 *
 * Uses child_process.spawn with shell:false by default.
 * Never interpolates user input into a shell string.
 */
export async function runProcess(options: RunOptions): Promise<RunResult> {
  const {
    command,
    args,
    cwd,
    timeout = DEFAULT_TIMEOUT_MS,
    env,
    allowedCommands,
  } = options;

  // Validate cwd
  if (!(await validateCwd(cwd))) {
    return {
      stdout: "",
      stderr: `cwd does not exist or is not a directory: ${cwd}`,
      exitCode: 1,
      timedOut: false,
      killed: false,
    };
  }

  // Check allowlist
  const effectiveAllowlist = allowedCommands ?? DEFAULT_ALLOWLIST;
  if (!isAllowedCommand(command, effectiveAllowlist)) {
    return {
      stdout: "",
      stderr: `Command not in allowlist: ${command}. Allowed: ${effectiveAllowlist.join(", ")}`,
      exitCode: 1,
      timedOut: false,
      killed: false,
    };
  }

  return new Promise<RunResult>((resolve) => {
    const spawnOptions: SpawnOptions = {
      cwd,
      env: { ...process.env, ...env },
      shell: false, // CRITICAL: no shell, no injection
      timeout,
    };

    const child = spawn(command, args, spawnOptions);

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8");
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8");
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        stderr += `\nCommand not found: ${command}`;
      } else {
        stderr += `\n${err.message}`;
      }
      resolve({
        stdout,
        stderr: stderr.trim(),
        exitCode: 1,
        timedOut: false,
        killed: false,
      });
    });

    child.on("close", (code: number | null, signal: string | null) => {
      timedOut = signal === "SIGTERM" || signal === "SIGKILL";
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        timedOut,
        killed: signal !== null,
      });
    });
  });
}
