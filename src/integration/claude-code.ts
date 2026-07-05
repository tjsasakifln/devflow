import path from "node:path";
import { fileExists, safeReadFile, atomicWrite } from "../utils/fs.js";
import { MARKER_START, MARKER_END } from "../utils/markdown.js";
import { logger } from "../utils/logger.js";

const DEVFLOW_SECTION = `
${MARKER_START}
<!-- This section is managed by Devflow. Do not edit manually. -->

## Devflow Workflow

This project uses Devflow for state-aware development orchestration.

### How to Use
- Run \`devflow status\` to see current project state
- Run \`devflow next\` to get the next recommended action
- Run \`devflow feature new "name"\` to start new feature work
- Run \`devflow update-cockpit\` to refresh DEVFLOW.md
- Type \`/devflow\` in Claude Code for inline state display

### File Structure
- \`.devflow/\` — Internal state (do not edit manually)
- \`_devflow/\` — Output artifacts (specs, features, decisions)
- \`DEVFLOW.md\` — Project cockpit (auto-generated, read-only)
- \`CLAUDE.md\` — This file (devflow section is auto-managed)

### Rules for Claude Code
1. Before coding, verify that requirements.md, roadmap.md, actions.md, and quality-audit.md exist and are complete.
2. Never modify \`.devflow/\` files directly.
3. Never overwrite existing \`_devflow/\` artifacts without explicit user confirmation.
4. When starting a new session, run \`devflow status\` first.
5. When uncertain, run \`devflow next\` and follow the recommendation.
6. Log all implementation actions to \`implementation-log.jsonl\` in the active feature directory.

### Slash Command
Type \`/devflow\` to get the current project state and next action recommendation.
Add arguments for specific commands: \`/devflow status\`, \`/devflow next\`, \`/devflow feature new "name"\`.

${MARKER_END}
`;

export async function ensureClaudeMdSection(
  rootPath: string
): Promise<boolean> {
  const claudeMdPath = path.join(rootPath, "CLAUDE.md");
  const exists = await fileExists(claudeMdPath);

  if (!exists) {
    // Create a new CLAUDE.md with just the Devflow section
    await atomicWrite(claudeMdPath, DEVFLOW_SECTION.trimStart());
    logger.info("[WRITE] CLAUDE.md — created with Devflow integration");
    return true;
  }

  const existing = await safeReadFile(claudeMdPath);
  if (!existing) {
    await atomicWrite(claudeMdPath, DEVFLOW_SECTION.trimStart());
    logger.info("[WRITE] CLAUDE.md — created (was empty)");
    return true;
  }

  // Check if Devflow section already exists
  if (existing.includes(MARKER_START) && existing.includes(MARKER_END)) {
    // Replace existing section
    const startIdx = existing.indexOf(MARKER_START);
    const endIdx = existing.indexOf(MARKER_END) + MARKER_END.length;

    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx);

    const updated = before + DEVFLOW_SECTION.trimStart() + after;
    await atomicWrite(claudeMdPath, updated);
    logger.info("[UPDATE] CLAUDE.md — Devflow section updated");
    return true;
  }

  // Append section at the end
  const updated = existing.trimEnd() + "\n\n" + DEVFLOW_SECTION.trimStart();
  await atomicWrite(claudeMdPath, updated);
  logger.info("[APPEND] CLAUDE.md — Devflow section appended");
  return true;
}

export function generateSlashCommandConfig(): string {
  return JSON.stringify(
    {
      slash_commands: {
        devflow: {
          command: "npx -y @devflow/cli",
          description:
            "Devflow — project state and next action engine",
          args: true,
        },
      },
    },
    null,
    2
  );
}
