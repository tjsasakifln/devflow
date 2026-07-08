// =============================================================================
// Workflow Spec Loader
// =============================================================================
// Reads and parses `.devflow/workflow-states.yaml`, validates structure,
// and caches the parsed spec in memory for the engine runtime.
// =============================================================================

import path from "node:path";
import { load as yamlLoad } from "js-yaml";
import type {
  WorkflowSpec,
  WorkflowSpecMeta,
  WorkflowDef,
  StateDef,
  TransitionDef,
  GuardDef,
  EffectDef,
} from "./types.js";
import { safeReadFile } from "../utils/fs.js";

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

let cachedSpec: WorkflowSpec | null = null;
let cachedRootPath: string | null = null;

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Load and parse the workflow-states.yaml from a project root.
 * Returns parsed spec and caches it in memory.
 * Throws on parse errors or structural validation failures.
 */
export async function loadWorkflowSpec(
  rootPath: string,
): Promise<WorkflowSpec> {
  // Return cache if same root
  if (cachedSpec && cachedRootPath === rootPath) {
    return cachedSpec;
  }

  const yamlPath = path.join(rootPath, ".devflow", "workflow-states.yaml");
  const content = await safeReadFile(yamlPath);

  if (!content) {
    throw new Error(
      `Workflow spec not found at ${yamlPath}. Run Story 2.1 first.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = yamlLoad(content);
  } catch (err) {
    throw new Error(
      `Failed to parse workflow YAML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const spec = validateSpec(parsed);

  // Cache
  cachedSpec = spec;
  cachedRootPath = rootPath;

  return spec;
}

/**
 * Clear the in-memory cache (useful for testing or hot-reload).
 */
export function clearCache(): void {
  cachedSpec = null;
  cachedRootPath = null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateSpec(raw: unknown): WorkflowSpec {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Workflow spec must be a top-level object");
  }

  const obj = raw as Record<string, unknown>;

  // Required top-level fields
  if (typeof obj.version !== "string") {
    throw new Error("Missing or invalid 'version' field (must be string)");
  }

  if (!Array.isArray(obj.states)) {
    throw new Error("Missing or invalid 'states' field (must be array)");
  }

  if (!Array.isArray(obj.transitions)) {
    throw new Error("Missing or invalid 'transitions' field (must be array)");
  }

  // Validate states
  const stateIds = new Set<string>();
  for (const s of obj.states) {
    const state = s as Record<string, unknown>;
    if (typeof state.id !== "string") {
      throw new Error("Each state must have a string 'id'");
    }
    if (stateIds.has(state.id)) {
      throw new Error(`Duplicate state id: ${state.id}`);
    }
    stateIds.add(state.id);
  }

  // Validate transitions — each must reference valid states
  const transitionIds = new Set<string>();
  for (const t of obj.transitions) {
    const trans = t as Record<string, unknown>;
    if (typeof trans.id !== "string") {
      throw new Error("Each transition must have a string 'id'");
    }
    if (transitionIds.has(trans.id)) {
      throw new Error(`Duplicate transition id: ${trans.id}`);
    }
    transitionIds.add(trans.id);

    if (!stateIds.has(trans.from as string)) {
      throw new Error(
        `Transition ${trans.id} references unknown state '${String(trans.from)}' in 'from'`,
      );
    }
    if (!stateIds.has(trans.to as string)) {
      throw new Error(
        `Transition ${trans.id} references unknown state '${String(trans.to)}' in 'to'`,
      );
    }
  }

  // Build structured spec
  const spec: WorkflowSpec = {
    version: obj.version as string,
    meta: obj.meta as WorkflowSpecMeta,
    states: obj.states as StateDef[],
    transitions: obj.transitions as TransitionDef[],
    guards: Array.isArray(obj.guards) ? (obj.guards as GuardDef[]) : [],
    effects: Array.isArray(obj.effects) ? (obj.effects as EffectDef[]) : [],
    workflows:
      typeof obj.workflows === "object" && obj.workflows !== null
        ? (obj.workflows as Record<string, WorkflowDef>)
        : {},
  };

  return spec;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/**
 * Look up a state definition by ID.
 */
export function getStateById(
  spec: WorkflowSpec,
  stateId: string,
): StateDef | undefined {
  return spec.states.find((s) => s.id === stateId);
}

/**
 * Get all transitions that originate from a given state.
 */
export function getTransitionsFromState(
  spec: WorkflowSpec,
  stateId: string,
): TransitionDef[] {
  return spec.transitions.filter((t) => t.from === stateId);
}

/**
 * Get all transitions that target a given state.
 */
export function getTransitionsToState(
  spec: WorkflowSpec,
  stateId: string,
): TransitionDef[] {
  return spec.transitions.filter((t) => t.to === stateId);
}

/**
 * Look up a guard definition by ID.
 */
export function getGuardById(
  spec: WorkflowSpec,
  guardId: string,
): GuardDef | undefined {
  return spec.guards.find((g) => g.id === guardId);
}

/**
 * Look up an effect definition by ID.
 */
export function getEffectById(
  spec: WorkflowSpec,
  effectId: string,
): EffectDef | undefined {
  return spec.effects.find((e) => e.id === effectId);
}

/**
 * Get the workflow definition by name.
 */
export function getWorkflowById(
  spec: WorkflowSpec,
  workflowId: string,
): WorkflowDef | undefined {
  return spec.workflows[workflowId];
}
