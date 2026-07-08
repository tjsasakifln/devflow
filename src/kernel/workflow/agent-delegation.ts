// =============================================================================
// Agent Delegation Matrix
// =============================================================================
// Implements the agent delegation pipeline for the workflow engine.
// Defines the canonical order of agent roles and validates transitions.
//
// Pipeline: PM → SM → PO → Dev → QA → DevOps
// Extended roles (architect, analyst, data-engineer, ux-expert) are reachable
// from specific positions (e.g., architect delegates to data-engineer).
//
// References:
//   - `.claude/rules/agent-authority.md` — Delegation matrix
//   - Story 2.4: Agent-Driven Development Workflow
// =============================================================================

import type { AgentRole } from "./types.js";

// ---------------------------------------------------------------------------
// Pipeline definition
// ---------------------------------------------------------------------------

/**
 * Canonical pipeline order. Agents earlier in the pipeline delegate to
 * agents later in the pipeline as work progresses.
 *
 * Specialists (architect, data-engineer, analyst, ux-expert) are not in the
 * linear pipeline — they are consulted by specific roles.
 */
export const DELEGATION_PIPELINE: AgentRole[] = [
  "pm",
  "sm",
  "po",
  "dev",
  "qa",
  "devops",
];

/**
 * Map of which agents an agent can delegate TO directly.
 * This is the formal delegation graph derived from `.claude/rules/agent-authority.md`.
 */
export const DELEGATION_GRAPH: Record<AgentRole, AgentRole[]> = {
  pm: ["sm", "architect", "analyst"], // PM creates epics, delegates story creation to SM, research to analyst
  sm: ["po", "dev"],                  // SM creates stories, passes to PO for validation or Dev for implementation
  po: ["dev", "sm"],                  // PO validates stories, can return to SM or forward to Dev
  dev: ["qa", "architect", "data-engineer"], // Dev implements, passes to QA, or consults architect/data
  qa: ["dev", "devops"],              // QA gates, FAIL returns to Dev, PASS goes to DevOps
  devops: ["dev", "qa"],              // DevOps pushes/deploys, can return to Dev or QA
  architect: ["data-engineer", "dev", "analyst"], // Architect designs, delegates DDL to data-engineer
  analyst: ["pm", "architect"],       // Analyst researches, reports back to PM or Architect
  "data-engineer": ["dev", "architect"], // Data engineer implements DDL, reports to Dev or Architect
  "ux-expert": ["dev", "architect"],  // UX expert designs, reports to Dev or Architect
};

// ---------------------------------------------------------------------------
// Pipeline query helpers
// ---------------------------------------------------------------------------

/**
 * Get the position of an agent in the pipeline.
 * Returns -1 for specialist roles not in the linear pipeline.
 */
export function getPipelinePosition(role: AgentRole): number {
  return DELEGATION_PIPELINE.indexOf(role);
}

/**
 * Check if a role is in the main delegation pipeline.
 */
export function isInPipeline(role: AgentRole): boolean {
  return DELEGATION_PIPELINE.includes(role);
}

/**
 * Get the next agent in the pipeline after the given role.
 * Returns null if the role is the last in the pipeline.
 */
export function getNextAgentInPipeline(role: AgentRole): AgentRole | null {
  const pos = getPipelinePosition(role);
  if (pos === -1 || pos >= DELEGATION_PIPELINE.length - 1) return null;
  return DELEGATION_PIPELINE[pos + 1] ?? null;
}

/**
 * Check if a delegation from `fromAgent` to `toAgent` is valid according to
 * the delegation graph. Valid means:
 *   1. The roles are the same (no delegation needed), OR
 *   2. The `to` role is in the `from` role's delegation list, OR
 *   3. The `to` role follows `from` in the linear pipeline (forward flow)
 */
export function isValidDelegation(
  fromAgent: AgentRole,
  toAgent: AgentRole,
): boolean {
  // Same agent is always valid (no delegation needed)
  if (fromAgent === toAgent) return true;

  // Check delegation graph first
  const directDelegations = DELEGATION_GRAPH[fromAgent];
  if (directDelegations?.includes(toAgent)) return true;

  // Check forward pipeline flow
  const fromPos = getPipelinePosition(fromAgent);
  const toPos = getPipelinePosition(toAgent);
  if (fromPos !== -1 && toPos !== -1 && toPos > fromPos) return true;

  return false;
}

/**
 * Get all agents that a given agent can delegate to.
 */
export function getDelegationTargets(role: AgentRole): AgentRole[] {
  return DELEGATION_GRAPH[role] ?? [];
}

/**
 * Find the shortest delegation path between two agents using BFS on the
 * delegation graph. Returns an array of agent roles forming the path.
 * Returns null if no path exists.
 */
export function findDelegationPath(
  fromAgent: AgentRole,
  toAgent: AgentRole,
): AgentRole[] | null {
  if (fromAgent === toAgent) return [fromAgent];

  const visited = new Set<AgentRole>();
  const queue: { role: AgentRole; path: AgentRole[] }[] = [
    { role: fromAgent, path: [fromAgent] },
  ];
  visited.add(fromAgent);

  while (queue.length > 0) {
    const { role, path } = queue.shift()!;
    const targets = DELEGATION_GRAPH[role] ?? [];

    for (const target of targets) {
      if (target === toAgent) return [...path, target];
      if (!visited.has(target)) {
        visited.add(target);
        queue.push({ role: target, path: [...path, target] });
      }
    }
  }

  return null; // No path found
}

/**
 * Get a human-readable label for an agent role.
 */
export function getAgentLabel(role: AgentRole): string {
  const labels: Record<string, string> = {
    pm: "Morgan (Product Manager)",
    sm: "River (Scrum Master)",
    po: "Pax (Product Owner)",
    dev: "Dex (Builder/Developer)",
    qa: "Quinn (QA Engineer)",
    devops: "Gage (DevOps Engineer)",
    architect: "Aria (Architect)",
    analyst: "Alex (Analyst)",
    "data-engineer": "Dara (Data Engineer)",
    "ux-expert": "Uma (UX Expert)",
  };
  return labels[role] ?? role;
}

/**
 * Validate a sequence of agent roles (pipeline) — each adjacent pair
 * must be a valid delegation. Returns first invalid transition or null.
 */
export function validateAgentSequence(sequence: AgentRole[]): { allowed: boolean; reason: string } | null {
  for (let i = 0; i < sequence.length - 1; i++) {
    const from = sequence[i] as AgentRole | undefined;
    const to = sequence[i + 1] as AgentRole | undefined;
    if (!from || !to) continue;
    if (!isValidDelegation(from, to)) {
      return {
        allowed: false,
        reason: `Invalid delegation: ${from} -> ${to}`,
      };
    }
  }
  return null;
}
