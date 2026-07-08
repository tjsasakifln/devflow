// =============================================================================
// Handoff Protocol
// =============================================================================
// Generates and parses handoff artifacts between agent transitions.
// Artifacts are compact YAML files (<500 tokens) stored in `.aiox/handoffs/`.
//
// Handoff format (per `.claude/rules/agent-handoff.md`):
//   handoff:
//     from_agent: "{current_agent_id}"
//     to_agent: "{new_agent_id}"
//     story_context:
//       story_id: "..."
//       story_path: "..."
//       story_status: "..."
//       current_task: "..."
//       branch: "..."
//     decisions:
//       - "..."
//     files_modified:
//       - "..."
//     blockers:
//       - "..."
//     next_action: "..."
//
// Compaction limits:
//   - Max artifact size: 500 tokens
//   - Max decisions: 5
//   - Max files_modified: 10
//   - Max blockers: 3
//
// References:
//   - `.claude/rules/agent-handoff.md` — Handoff protocol specification
//   - Story 2.4: Agent-Driven Development Workflow
// =============================================================================

import { dump as yamlDump, load as yamlLoad } from "js-yaml";
import path from "node:path";
import type { AgentRole, HandoffArtifact, HandoffInput } from "./types.js";
import { AGENT_ROLE_LABELS } from "./types.js";
import { atomicWrite, safeReadFile, ensureDir } from "../utils/fs.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum token count for handoff artifacts. */
export const MAX_HANDOFF_TOKENS = 500;

/** Maximum number of decisions in a handoff. */
export const MAX_DECISIONS = 5;

/** Maximum number of files_modified entries. */
export const MAX_FILES_MODIFIED = 10;

/** Maximum number of blockers. */
export const MAX_BLOCKERS = 3;

/** Directory where handoff artifacts are stored (relative to project root). */
export const HANDOFF_DIR = ".aiox/handoffs";

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Rough token estimation for YAML string.
 * Uses ~4 chars per token as an approximation (conservative).
 * This is a heuristic — not a tokenizer — but sufficient for the 500-token limit.
 */
export function estimateTokens(yamlString: string): number {
  // Estimate: ~1 token per 4 characters for YAML
  return Math.ceil(yamlString.length / 4);
}

// ---------------------------------------------------------------------------
// Artifact generation
// ---------------------------------------------------------------------------

/**
 * Generate a handoff artifact object from input parameters.
 * Automatically truncates fields to respect compaction limits.
 */
export function createHandoffArtifact(input: HandoffInput): HandoffArtifact {
  return {
    handoff: {
      from_agent: input.fromAgent,
      to_agent: input.toAgent,
      story_context: {
        story_id: input.storyId,
        story_path: input.storyPath,
        story_status: input.storyStatus ?? "InProgress",
        current_task: input.currentTask ?? "Unknown",
        branch: input.branch ?? "main",
      },
      decisions: (input.decisions ?? []).slice(0, MAX_DECISIONS),
      files_modified: (input.filesModified ?? []).slice(0, MAX_FILES_MODIFIED),
      blockers: (input.blockers ?? []).slice(0, MAX_BLOCKERS),
      next_action: input.nextAction,
    },
  };
}

/**
 * Render a handoff artifact as a YAML string.
 * Returns the YAML string and token estimate.
 */
export function renderHandoffYaml(
  artifact: HandoffArtifact,
): { yaml: string; estimatedTokens: number } {
  const yaml = yamlDump(artifact, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    // forceQuotes removed — not valid in js-yaml DumpOptions
  });
  const estimatedTokens = estimateTokens(yaml);

  return { yaml, estimatedTokens };
}

/**
 * Generate a handoff artifact and render it as YAML.
 * Convenience wrapper.
 */
export function generateHandoffYaml(
  input: HandoffInput,
): { yaml: string; estimatedTokens: number; artifact: HandoffArtifact } {
  const artifact = createHandoffArtifact(input);
  const { yaml, estimatedTokens } = renderHandoffYaml(artifact);
  return { yaml, estimatedTokens, artifact };
}

// ---------------------------------------------------------------------------
// Artifact persistence
// ---------------------------------------------------------------------------

/**
 * Build filename for a handoff artifact.
 * Format: handoff-{from}-to-{to}-{timestamp}.yaml
 */
export function buildHandoffFilename(
  fromAgent: AgentRole,
  toAgent: AgentRole,
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `handoff-${fromAgent}-to-${toAgent}-${timestamp}.yaml`;
}

/**
 * Save a handoff artifact to disk.
 * Returns the full file path of the saved artifact.
 */
export async function saveHandoffArtifact(
  rootPath: string,
  artifact: HandoffArtifact,
): Promise<string> {
  const handoffDir = path.join(rootPath, HANDOFF_DIR);
  await ensureDir(handoffDir);

  const filename = buildHandoffFilename(
    artifact.handoff.from_agent,
    artifact.handoff.to_agent,
  );
  const filePath = path.join(handoffDir, filename);

  const { yaml } = renderHandoffYaml(artifact);
  await atomicWrite(filePath, yaml);

  return filePath;
}

// ---------------------------------------------------------------------------
// Artifact loading and parsing
// ---------------------------------------------------------------------------

/**
 * Parse a YAML string back into a HandoffArtifact.
 * Returns null if parsing fails.
 */
export function parseHandoffYaml(yaml: string): HandoffArtifact | null {
  try {
    const parsed = yamlLoad(yaml);
    if (!parsed || typeof parsed !== "object" || !("handoff" in (parsed as Record<string, unknown>))) {
      return null;
    }
    return parsed as unknown as HandoffArtifact;
  } catch {
    return null;
  }
}

/**
 * Load the most recent handoff artifact from the handoffs directory.
 * Returns null if no handoffs exist.
 */
export async function loadLatestHandoff(
  rootPath: string,
): Promise<HandoffArtifact | null> {
  const { listDir } = await import("../utils/fs.js");
  const handoffDir = path.join(rootPath, HANDOFF_DIR);

  try {
    const files = await listDir(handoffDir);
    const handoffFiles = files
      .filter((f) => f.startsWith("handoff-") && f.endsWith(".yaml"))
      .sort()
      .reverse();

    if (handoffFiles.length === 0) return null;

    const latest = handoffFiles[0];
    if (!latest) return null;
    const content = await safeReadFile(path.join(handoffDir, latest));
    if (!content) return null;

    return parseHandoffYaml(content);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Artifact size validation
// ---------------------------------------------------------------------------

/**
 * Validate that a handoff artifact is within compaction limits.
 * Returns an array of warnings (empty if all good).
 */
export function validateHandoffSize(
  _yaml: string,
  estimatedTokens: number,
): string[] {
  const warnings: string[] = [];

  if (estimatedTokens > MAX_HANDOFF_TOKENS) {
    warnings.push(
      `Handoff artifact exceeds ${MAX_HANDOFF_TOKENS} token limit (estimated: ${estimatedTokens})`,
    );
  }

  return warnings;
}

/**
 * Generate a human-readable summary of a handoff artifact.
 */
export function formatHandoffSummary(artifact: HandoffArtifact): string {
  const h = artifact.handoff;
  const lines: string[] = [
    `Handoff: ${AGENT_ROLE_LABELS[h.from_agent] ?? h.from_agent} -> ${AGENT_ROLE_LABELS[h.to_agent] ?? h.to_agent}`,
    `Story: ${h.story_context.story_id} (${h.story_context.story_status})`,
    `Task: ${h.story_context.current_task}`,
  ];

  if (h.decisions.length > 0) {
    lines.push(`Decisions (${h.decisions.length}):`);
    for (const d of h.decisions) {
      lines.push(`  - ${d}`);
    }
  }

  if (h.files_modified.length > 0) {
    lines.push(`Files modified (${h.files_modified.length}):`);
    for (const f of h.files_modified) {
      lines.push(`  - ${f}`);
    }
  }

  if (h.blockers.length > 0) {
    lines.push(`Blockers (${h.blockers.length}):`);
    for (const b of h.blockers) {
      lines.push(`  - ${b}`);
    }
  }

  lines.push(`Next: ${h.next_action}`);

  return lines.join("\n");
}
