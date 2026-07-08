/**
 * Claude Code Slash Command Integration
 *
 * Generates and manages `.claude/commands/devflow.md` — the file that
 * registers the `/devflow` slash command in Claude Code.
 *
 * The command file is a markdown document with YAML frontmatter that Claude Code
 * discovers at startup. It instructs Claude to proxy arguments to the Devflow CLI.
 *
 * Safety: uses a marker comment (`CLAUDE_COMMAND_MARKER`) to distinguish
 * Devflow-managed content from user-written content. Files without the marker
 * are never overwritten.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { fileExists } from "../../kernel/utils/fs.js";
import { logger } from "../../kernel/utils/logger.js";

/** Marker injected into Devflow-managed command files for idempotent updates. */
export const CLAUDE_COMMAND_MARKER = "<!-- DEVFLOW_MANAGED -->";

/**
 * Generate the content of `.claude/commands/devflow.md` for the given
 * resolved CLI prefix (e.g. `npx devflow` or `npx -y @tjsasakinpm/devflow@latest`).
 */
export function generateDevflowCommand(prefix: string): string {
  return `---
description: Inspect and operate the Devflow governance workflow for this project.
argument-hint: "[status|doctor|next|feature|audit|review-pr|help]"
---

${CLAUDE_COMMAND_MARKER}

You are operating Devflow for this project. Devflow is the source of truth for AI coding governance, project state, feature readiness, audit evidence, and next actions.

Use this CLI prefix for Devflow commands in this project:

\`${prefix}\`

When invoked with no arguments, run:

\`${prefix} status\`

Then summarize the current state, blockers, and next safest action.

If the user passes arguments, map them to the Devflow CLI. Examples:

\`/devflow status\` → \`${prefix} status\`
\`/devflow doctor\` → \`${prefix} doctor\`
\`/devflow next\` → \`${prefix} next\`
\`/devflow audit\` → \`${prefix} audit\`
\`/devflow review-pr\` → \`${prefix} review-pr\`
\`/devflow feature new "name"\` → \`${prefix} feature new "name"\`

Do not manually edit Devflow state files to bypass the workflow. Do not invent feature state. Do not mark work complete without Devflow evidence. If a command fails, report the failure and suggest the next diagnostic command, usually \`${prefix} doctor\`.
`;
}

export interface EnsureResult {
  created: boolean;
  updated: boolean;
}

/**
 * Ensure `.claude/commands/devflow.md` exists and is up to date.
 *
 * Behavior:
 * - File doesn't exist → creates `.claude/commands/` dir and file → `{ created: true }`
 * - File exists with `CLAUDE_COMMAND_MARKER` → overwrites (idempotent update) → `{ updated: true }`
 * - File exists WITHOUT marker → leaves untouched (user-owned content), logs warning
 *
 * @returns what happened: whether the file was created or updated
 */
export async function ensureDevflowCommand(
  rootPath: string,
  prefix: string,
): Promise<EnsureResult> {
  const commandsDir = path.join(rootPath, ".claude", "commands");
  const commandFile = path.join(commandsDir, "devflow.md");

  const exists = await fileExists(commandFile);

  if (exists) {
    const content = await fs.readFile(commandFile, "utf-8");
    if (content.includes(CLAUDE_COMMAND_MARKER)) {
      // Devflow-managed — safe to overwrite
      const newContent = generateDevflowCommand(prefix);
      await fs.writeFile(commandFile, newContent, "utf-8");
      logger.info("[UPDATE] .claude/commands/devflow.md — updated with prefix: " + prefix);
      return { created: false, updated: true };
    }
    // User-owned content — do NOT touch
    logger.warn(
      "[SKIP] .claude/commands/devflow.md exists without Devflow marker — leaving user content untouched",
    );
    return { created: false, updated: false };
  }

  // Create directory and file
  await fs.mkdir(commandsDir, { recursive: true });
  const content = generateDevflowCommand(prefix);
  await fs.writeFile(commandFile, content, "utf-8");
  logger.info("[CREATE] .claude/commands/devflow.md — created with prefix: " + prefix);
  return { created: true, updated: false };
}

/**
 * Read the current prefix from an existing `.claude/commands/devflow.md`.
 * Returns the prefix string if the file exists and is Devflow-managed,
 * or null otherwise.
 */
export async function readDevflowCommandPrefix(
  rootPath: string,
): Promise<string | null> {
  const commandFile = path.join(rootPath, ".claude", "commands", "devflow.md");

  if (!(await fileExists(commandFile))) return null;

  const content = await fs.readFile(commandFile, "utf-8");
  if (!content.includes(CLAUDE_COMMAND_MARKER)) return null;

  // Extract prefix from the first occurrence of `prefix` in backtick-quoted text
  // after the marker
  const afterMarker = content.slice(content.indexOf(CLAUDE_COMMAND_MARKER) + CLAUDE_COMMAND_MARKER.length);
  const match = afterMarker.match(/`([^`]+)`/);
  return match ? match[1] ?? null : null;
}
