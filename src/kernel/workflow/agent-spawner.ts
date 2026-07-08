// =============================================================================
// Agent Spawner
// =============================================================================
// Spawns agent subprocesses with isolated context. Supports:
//   1. Simple spawn: child_process.spawn with context via stdin
//   2. Worktree isolation: git worktree add (optional, ~200-500ms setup)
//
// Context passed to the spawned agent includes:
//   - story_id, story_path, current_state
//   - decisions, files_modified
//   - handoff artifact (from → to)
//
// Story 2.4: Agent-Driven Development Workflow
// =============================================================================

import { spawn } from "node:child_process";
import path from "node:path";
import type { AgentRole, HandoffArtifact } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpawnContext {
  /** The agent role to spawn. */
  agent: AgentRole;
  /** Project root path. */
  rootPath: string;
  /** Story being worked on. */
  storyId: string;
  storyPath: string;
  /** Current workflow state. */
  currentState: string;
  /** Handoff artifact for the transition. */
  handoff?: HandoffArtifact;
  /** Previous decisions made. */
  decisions?: string[];
  /** Files modified so far. */
  filesModified?: string[];
  /** Active blockers. */
  blockers?: string[];
  /** Optional git branch for worktree. */
  branch?: string;
  /** Use worktree isolation. */
  useWorktree?: boolean;
}

export interface SpawnResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** If worktree was created, the path to it. */
  worktreePath?: string;
  /** Actual command that was executed. */
  command: string;
}

export interface SpawnOptions {
  /** Timeout in milliseconds (default: 300000 = 5 min). */
  timeout?: number;
  /** Additional environment variables. */
  env?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const WORKTREE_BASE = ".aiox/worktrees";

// ---------------------------------------------------------------------------
// Simple spawn
// ---------------------------------------------------------------------------

/**
 * Build the JSON context that will be passed to the spawned agent via stdin.
 * The agent reads this from stdin to understand its mission.
 */
function buildAgentContext(context: SpawnContext): string {
  const payload = {
    agent: context.agent,
    rootPath: context.rootPath,
    story: {
      id: context.storyId,
      path: context.storyPath,
    },
    currentState: context.currentState,
    decisions: context.decisions ?? [],
    filesModified: context.filesModified ?? [],
    blockers: context.blockers ?? [],
    handoff: context.handoff ?? null,
    branch: context.branch ?? "main",
    timestamp: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Spawn an agent as a simple subprocess.
 * The context is passed via stdin as JSON.
 * The agent process is expected to read stdin for its instructions.
 */
export function spawnAgent(
  context: SpawnContext,
  options?: SpawnOptions,
): Promise<SpawnResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const agentContext = buildAgentContext(context);

  // The "agent" is a Node.js script that reads context from stdin.
  // For now, we spawn the CLI with the agent role as argument.
  const command = process.execPath; // "node"
  const args = [
    path.join(context.rootPath, "dist", "main.js"),
    "agent",
    "--role",
    context.agent,
    "--story",
    context.storyId,
  ];

  return new Promise<SpawnResult>((resolve) => {
    const child = spawn(command, args, {
      cwd: context.rootPath,
      env: {
        ...process.env,
        ...options?.env,
        AIOX_AGENT_CONTEXT: agentContext,
      },
      stdio: ["pipe", "pipe", "pipe"],
      timeout,
    });

    // Write context to stdin
    child.stdin?.write(agentContext);
    child.stdin?.end();

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8");
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8");
    });

    child.on("error", (err: Error) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr: `Spawn error: ${err.message}\n${stderr}`.trim(),
        timedOut: false,
        command: `${command} ${args.join(" ")}`,
      });
    });

    child.on("close", (code: number | null, signal: string | null) => {
      timedOut = signal === "SIGTERM" || signal === "SIGKILL";
      resolve({
        success: code === 0,
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut,
        command: `${command} ${args.join(" ")}`,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Worktree spawning (optional, ~200-500ms setup)
// ---------------------------------------------------------------------------

/**
 * Check if git worktree is available in the project.
 */
async function isGitWorktreeAvailable(rootPath: string): Promise<boolean> {
  try {
    const { runProcess } = await import("../../adapters/process/safe-runner.js");
    const result = await runProcess({
      command: "git",
      args: ["worktree", "list"],
      cwd: rootPath,
      timeout: 5_000,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Create a git worktree for agent isolation.
 * Returns the worktree path, or null on failure.
 */
export async function createAgentWorktree(
  rootPath: string,
  branch: string,
  agent: AgentRole,
): Promise<string | null> {
  try {
    const worktreePath = path.join(rootPath, WORKTREE_BASE, `${agent}-${Date.now()}`);
    const { runProcess } = await import("../../adapters/process/safe-runner.js");

    // Create the worktree
    const result = await runProcess({
      command: "git",
      args: ["worktree", "add", worktreePath, branch],
      cwd: rootPath,
      timeout: 10_000,
    });

    if (result.exitCode !== 0) {
      return null;
    }

    return worktreePath;
  } catch {
    return null;
  }
}

/**
 * Remove a git worktree.
 */
export async function removeAgentWorktree(
  worktreePath: string,
): Promise<boolean> {
  try {
    const { runProcess } = await import("../../adapters/process/safe-runner.js");
    const result = await runProcess({
      command: "git",
      args: ["worktree", "remove", worktreePath],
      cwd: worktreePath,
      timeout: 10_000,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Spawn an agent with optional worktree isolation.
 * Falls back to simple spawn if worktree is unavailable or not requested.
 */
export async function spawnAgentWithWorktree(
  context: SpawnContext,
  options?: SpawnOptions,
): Promise<SpawnResult> {
  // Check if we should use worktree
  if (context.useWorktree) {
    const available = await isGitWorktreeAvailable(context.rootPath);
    if (available) {
      const worktreePath = await createAgentWorktree(
        context.rootPath,
        context.branch ?? "main",
        context.agent,
      );

      if (worktreePath) {
        // Spawn from worktree
        const result = await spawnAgent(
          { ...context, rootPath: worktreePath },
          options,
        );
        return { ...result, worktreePath };
      }
    }
  }

  // Fallback: simple spawn
  return spawnAgent(context, options);
}

// ---------------------------------------------------------------------------
// Context validation
// ---------------------------------------------------------------------------

/**
 * Validate spawn context has minimum required fields.
 */
export function validateSpawnContext(context: SpawnContext): string[] {
  const errors: string[] = [];

  if (!context.agent) {
    errors.push("Missing required field: agent");
  }
  if (!context.rootPath) {
    errors.push("Missing required field: rootPath");
  }
  if (!context.storyId) {
    errors.push("Missing required field: storyId");
  }
  if (!context.storyPath) {
    errors.push("Missing required field: storyPath");
  }
  if (!context.currentState) {
    errors.push("Missing required field: currentState");
  }

  return errors;
}
