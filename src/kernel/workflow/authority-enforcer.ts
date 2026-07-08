// =============================================================================
// Agent Authority Enforcer
// =============================================================================
// Enforces authority boundaries per agent role. Each role has allowed and
// blocked operations. The enforcer prevents role violations like Dev pushing
// to git or QA implementing code.
//
// Reference: `.claude/rules/agent-authority.md`
// Story 2.4: Agent-Driven Development Workflow
// =============================================================================

import type { AgentRole } from "./types.js";
import { isValidDelegation } from "./agent-delegation.js";

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** All recognized operations in the system, categorized by domain. */
export type AgentOperation =
  // Git operations
  | "git:push"
  | "git:add"
  | "git:commit"
  | "git:branch"
  | "git:merge"
  | "git:status"
  | "git:stash"
  | "git:diff"
  | "git:log"
  // GitHub operations
  | "github:pr-create"
  | "github:pr-merge"
  | "github:issue-manage"
  | "github:review"
  // MCP operations
  | "mcp:add"
  | "mcp:remove"
  | "mcp:configure"
  // CI/CD operations
  | "cicd:manage"
  | "cicd:release"
  | "cicd:pipeline"
  // Story operations
  | "story:create"
  | "story:validate"
  | "story:update-ac"
  | "story:update-checkboxes"
  | "story:update-dev-notes"
  | "story:update-file-list"
  // Implementation operations
  | "impl:code"
  | "impl:test"
  | "impl:refactor"
  // QA operations
  | "qa:review"
  | "qa:gate"
  // Architecture operations
  | "arch:decide"
  | "arch:technology-select"
  // Epic operations
  | "epic:create"
  | "epic:execute"
  | "epic:manage"
  // Data operations
  | "data:schema"
  | "data:ddl"
  | "data:query"
  | "data:migration"
  // Research operations
  | "research:gather"
  | "research:analyze"
  // Epic orchestration
  | "pm:orchestrate"
  | "pm:spec-write"
  // Framework governance
  | "framework:govern"
  | "framework:modify"
  // Orchestration
  | "orchestrate:cross-agent";

// ---------------------------------------------------------------------------
// Authority Matrix
// ---------------------------------------------------------------------------

export type AuthorityLevel = "allowed" | "blocked" | "delegate-only";

export interface AuthorityEntry {
  allowed: AgentOperation[];
  blocked: AgentOperation[];
  /** Operations that the agent can only perform via delegation to another agent. */
  delegateOnly: AgentOperation[];
}

/**
 * Complete authority matrix for all agent roles.
 * Derived from `.claude/rules/agent-authority.md`.
 */
export const AUTHORITY_MATRIX: Record<AgentRole, AuthorityEntry> = {
  // ── DevOps (Gage) — EXCLUSIVE Authority ──
  devops: {
    allowed: [
      "git:push",
      "git:commit",
      "git:branch",
      "git:status",
      "git:merge",
      "github:pr-create",
      "github:pr-merge",
      "github:issue-manage",
      "mcp:add",
      "mcp:remove",
      "mcp:configure",
      "cicd:manage",
      "cicd:release",
      "cicd:pipeline",
      "framework:modify",
    ],
    blocked: [
      "impl:code",
      "qa:review",
      "arch:decide",
      "story:validate",
      "story:update-ac",
    ],
    delegateOnly: [],
  },

  // ── PM (Morgan) — Epic Orchestration ──
  pm: {
    allowed: [
      "epic:create",
      "epic:execute",
      "epic:manage",
      "pm:orchestrate",
      "pm:spec-write",
      "research:gather",
      "framework:govern",
      "framework:modify",
    ],
    blocked: [
      "git:push",
      "git:merge",
      "impl:code",
      "impl:test",
      "qa:review",
      "story:update-checkboxes",
      "story:update-file-list",
      "mcp:add",
      "mcp:configure",
      "github:pr-create",
      "github:pr-merge",
    ],
    delegateOnly: [
      "story:create", // → SM
      "story:validate", // → PO
    ],
  },

  // ── SM (River) — Story Creation ──
  sm: {
    allowed: [
      "story:create",
      "git:status",
      "git:commit",
      "git:branch",
    ],
    blocked: [
      "git:push",
      "git:merge",
      "impl:code",
      "impl:test",
      "impl:refactor",
      "qa:review",
      "qa:gate",
      "mcp:add",
      "mcp:configure",
      "github:pr-create",
      "github:pr-merge",
      "arch:decide",
      "epic:create",
      "cicd:manage",
    ],
    delegateOnly: [],
  },

  // ── PO (Pax) — Story Validation ──
  po: {
    allowed: [
      "story:validate",
      "story:update-ac",
      "epic:manage",
      "orchestrate:cross-agent",
      "git:status",
    ],
    blocked: [
      "git:push",
      "git:merge",
      "impl:code",
      "impl:test",
      "qa:review",
      "mcp:add",
      "mcp:configure",
      "github:pr-create",
      "github:pr-merge",
      "cicd:manage",
      "cicd:release",
    ],
    delegateOnly: [],
  },

  // ── Dev (Dex) — Implementation ──
  dev: {
    allowed: [
      "impl:code",
      "impl:test",
      "impl:refactor",
      "git:add",
      "git:commit",
      "git:status",
      "git:branch",
      "git:merge",
      "git:stash",
      "git:diff",
      "git:log",
      "story:update-checkboxes",
      "story:update-dev-notes",
      "story:update-file-list",
    ],
    blocked: [
      "git:push",
      "github:pr-create",
      "github:pr-merge",
      "mcp:add",
      "mcp:remove",
      "mcp:configure",
      "cicd:manage",
      "cicd:release",
      "cicd:pipeline",
      "story:update-ac",
      "qa:gate",
      "epic:create",
      "framework:modify",
    ],
    delegateOnly: [
      "git:push", // → DevOps
      "github:pr-create", // → DevOps
    ],
  },

  // ── QA (Quinn) — Quality Gates ──
  qa: {
    allowed: [
      "qa:review",
      "qa:gate",
      "impl:test",
      "git:status",
      "git:diff",
      "git:log",
      "github:review",
    ],
    blocked: [
      "git:push",
      "git:merge",
      "impl:code",
      "impl:refactor",
      "mcp:add",
      "mcp:configure",
      "github:pr-create",
      "github:pr-merge",
      "cicd:manage",
      "cicd:release",
      "epic:create",
      "story:update-ac",
      "story:create",
    ],
    delegateOnly: [
      "git:push", // → DevOps
    ],
  },

  // ── Architect (Aria) ──
  architect: {
    allowed: [
      "arch:decide",
      "arch:technology-select",
      "framework:govern",
      "git:status",
      "git:diff",
      "orchestrate:cross-agent",
    ],
    blocked: [
      "git:push",
      "git:merge",
      "impl:code",
      "impl:test",
      "qa:review",
      "qa:gate",
      "mcp:add",
      "mcp:configure",
      "github:pr-create",
      "github:pr-merge",
      "cicd:manage",
      "story:update-checkboxes",
    ],
    delegateOnly: [
      "data:schema", // → Data Engineer
      "data:ddl", // → Data Engineer
    ],
  },

  // ── Data Engineer (Dara) ──
  "data-engineer": {
    allowed: [
      "data:schema",
      "data:ddl",
      "data:query",
      "data:migration",
      "git:status",
      "git:commit",
    ],
    blocked: [
      "git:push",
      "git:merge",
      "impl:code",
      "qa:review",
      "qa:gate",
      "mcp:add",
      "mcp:configure",
      "github:pr-create",
      "github:pr-merge",
      "arch:decide",
      "story:update-ac",
      "epic:create",
      "cicd:manage",
    ],
    delegateOnly: [
      "git:push", // → DevOps
    ],
  },

  // ── Analyst (Alex) ──
  analyst: {
    allowed: [
      "research:gather",
      "research:analyze",
      "git:status",
    ],
    blocked: [
      "git:push",
      "git:merge",
      "impl:code",
      "impl:test",
      "qa:review",
      "qa:gate",
      "mcp:add",
      "mcp:configure",
      "github:pr-create",
      "github:pr-merge",
      "arch:decide",
      "story:update-ac",
      "epic:create",
      "cicd:manage",
    ],
    delegateOnly: [],
  },

  // ── UX Expert (Uma) ──
  "ux-expert": {
    allowed: [
      "impl:code",
      "git:status",
      "git:commit",
    ],
    blocked: [
      "git:push",
      "git:merge",
      "qa:review",
      "qa:gate",
      "mcp:add",
      "mcp:configure",
      "github:pr-create",
      "github:pr-merge",
      "arch:decide",
      "cicd:manage",
      "cicd:release",
    ],
    delegateOnly: [
      "git:push", // → DevOps
    ],
  },
};

// ---------------------------------------------------------------------------
// Authority Check Functions
// ---------------------------------------------------------------------------

export interface AuthorityResult {
  allowed: boolean;
  operation: AgentOperation;
  role: AgentRole;
  reason: string;
}

/**
 * Check whether a given agent role is allowed to perform an operation.
 *
 * Returns an AuthorityResult with the decision and a human-readable reason.
 */
export function checkAuthority(
  role: AgentRole,
  operation: AgentOperation,
): AuthorityResult {
  const entry = AUTHORITY_MATRIX[role];

  if (!entry) {
    return {
      allowed: false,
      operation,
      role,
      reason: `Unknown agent role: ${role}. Cannot authorize any operation.`,
    };
  }

  // Check delegate-only first (gives specific message)
  if (entry.delegateOnly.includes(operation)) {
    return {
      allowed: false,
      operation,
      role,
      reason: `DELEGATE ONLY: ${role} must delegate '${operation}' to a role with this authority (typically devops).`,
    };
  }

  // Check blocked second
  if (entry.blocked.includes(operation)) {
    return {
      allowed: false,
      operation,
      role,
      reason: `BLOCKED: ${role} is not allowed to perform '${operation}'. This operation is in the blocked list for this role.`,
    };
  }

  // Check delegate-only
  if (entry.delegateOnly.includes(operation)) {
    return {
      allowed: false,
      operation,
      role,
      reason: `DELEGATE ONLY: ${role} must delegate '${operation}' to a role with this authority (typically devops).`,
    };
  }

  // Check allowed
  if (entry.allowed.includes(operation)) {
    return {
      allowed: true,
      operation,
      role,
      reason: `ALLOWED: ${role} is authorized to perform '${operation}'.`,
    };
  }

  // Not explicitly listed = blocked by default (default-deny)
  return {
    allowed: false,
    operation,
    role,
    reason: `DENIED: ${role} does not have explicit authorization for '${operation}'. Default-deny policy.`,
  };
}

/**
 * Check whether a specific agent transition (delegation) is valid.
 * Validates that the `toAgent` can meaningfully receive work from `fromAgent`.
 */
export function checkDelegationAuthority(
  fromAgent: AgentRole,
  toAgent: AgentRole,
): AuthorityResult {
  if (fromAgent === toAgent) {
    return {
      allowed: true,
      operation: "orchestrate:cross-agent",
      role: fromAgent,
      reason: `SAME AGENT: No delegation needed. ${fromAgent} is delegating to itself.`,
    };
  }

  if (isValidDelegation(fromAgent, toAgent)) {
    return {
      allowed: true,
      operation: "orchestrate:cross-agent",
      role: fromAgent,
      reason: `ALLOWED: ${fromAgent} can delegate to ${toAgent} per the delegation graph.`,
    };
  }

  return {
    allowed: false,
    operation: "orchestrate:cross-agent",
    role: fromAgent,
    reason: `BLOCKED: ${fromAgent} cannot delegate to ${toAgent}. No valid delegation path exists in the authority matrix.`,
  };
}

/**
 * Get all operations that are blocked for a given agent role.
 */
export function getBlockedOperations(role: AgentRole): AgentOperation[] {
  return AUTHORITY_MATRIX[role]?.blocked ?? [];
}

/**
 * Get all operations that are allowed for a given agent role.
 */
export function getAllowedOperations(role: AgentRole): AgentOperation[] {
  return AUTHORITY_MATRIX[role]?.allowed ?? [];
}

/**
 * Format an authority check result as a human-readable string.
 */
export function formatAuthorityResult(result: AuthorityResult): string {
  const icon = result.allowed ? "ALLOWED" : "DENIED";
  return `[${icon}] ${result.reason}`;
}

/**
 * Validate a sequence of agent roles (pipeline) — each adjacent pair
 * must be a valid delegation. Returns first invalid transition or null.
 */
export function validateAgentSequence(sequence: AgentRole[]): AuthorityResult | null {
  for (let i = 0; i < sequence.length - 1; i++) {
    const from = sequence[i];
    const to = sequence[i + 1];
    if (!from || !to) continue;
    const result = checkDelegationAuthority(from, to);
    if (!result.allowed) return result;
  }
  return null;
}
