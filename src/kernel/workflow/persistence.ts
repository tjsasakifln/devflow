// =============================================================================
// Workflow State Persistence
// =============================================================================
// Schema-versioned persistence for engine state (.devflow/state.json) and
// checkpoint data (.devflow/checkpoint.json). Forward-compatible with v1.
//
// File layout:
//   .devflow/state.json        — current engine state (schema v2)
//   .devflow/checkpoint.json   — last checkpoint (separate file avoids corruption)
// =============================================================================

import path from "node:path";
import type { EngineState, CheckpointData } from "./types.js";
import { ENGINE_STATE_SCHEMA_VERSION } from "./types.js";
import { safeReadFile, atomicWrite } from "../utils/fs.js";

// ---------------------------------------------------------------------------
// File paths
// ---------------------------------------------------------------------------

function statePath(rootPath: string): string {
  return path.join(rootPath, ".devflow", "state.json");
}

function checkpointPath(rootPath: string): string {
  return path.join(rootPath, ".devflow", "checkpoint.json");
}

// ---------------------------------------------------------------------------
// Schema migration helpers
// ---------------------------------------------------------------------------

interface V1State {
  currentState: string;
  previousState: string | null;
  confidence: string;
  lastUpdated: string;
  activeFeatureId: string | null;
  blockers: string[];
}

/**
 * Migrate a v1 state object to v2 (forward-compatible).
 */
function migrateV1toV2(v1: V1State): EngineState {
  return {
    schemaVersion: 2,
    currentState: v1.currentState as EngineState["currentState"],
    previousState: v1.previousState as EngineState["previousState"],
    workflow: "greenfield", // Best guess from v1
    confidence: (v1.confidence as EngineState["confidence"]) || "medium",
    activeFeatureId: v1.activeFeatureId || null,
    blockers: v1.blockers || [],
    currentAgent: null,
    previousAgent: null,
    metadata: {
      lastTransitionId: null,
      lastTransitionAt: v1.lastUpdated || null,
      lastCheckpointAt: null,
      transitionCount: 0,
    },
    createdAt: v1.lastUpdated || new Date().toISOString(),
    updatedAt: v1.lastUpdated || new Date().toISOString(),
  };
}

/**
 * Migrate raw parsed state to v2 schema.
 * Detects schema version and migrates if needed.
 */
function parseAndMigrate(raw: unknown): EngineState {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid state file: expected object");
  }

  const obj = raw as Record<string, unknown>;

  // v2 native format (Story 2.4 added currentAgent/previousAgent)
  if (obj.schemaVersion === 2) {
    const state = obj as Record<string, unknown>;
    // Ensure agent fields exist (backward compat with pre-2.4 state files)
    if (typeof state.currentAgent === "undefined") {
      state.currentAgent = null;
    }
    if (typeof state.previousAgent === "undefined") {
      state.previousAgent = null;
    }
    return obj as unknown as EngineState;
  }

  // v1 format (no schemaVersion, has currentState directly)
  if (typeof obj.currentState === "string") {
    return migrateV1toV2(obj as unknown as V1State);
  }

  throw new Error(
    `Unrecognized state schema version: ${String(obj.schemaVersion ?? "undefined")}`,
  );
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

/**
 * Load engine state from .devflow/state.json.
 * Handles v1 → v2 migration transparently.
 * Returns null if no state file exists.
 */
export async function loadEngineState(
  rootPath: string,
): Promise<EngineState | null> {
  const content = await safeReadFile(statePath(rootPath));
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    return parseAndMigrate(parsed);
  } catch (err) {
    throw new Error(
      `Failed to parse state file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Save engine state to .devflow/state.json using atomic write.
 * Always writes v2 schema.
 */
export async function saveEngineState(
  rootPath: string,
  state: EngineState,
): Promise<void> {
  const stamped = {
    ...state,
    schemaVersion: ENGINE_STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };

  await atomicWrite(statePath(rootPath), JSON.stringify(stamped, null, 2));
}

/**
 * Create a fresh engine state with defaults.
 */
export function createDefaultEngineState(
  currentState: EngineState["currentState"],
  workflow: string,
  featureId: string | null,
): EngineState {
  const now = new Date().toISOString();
  return {
    schemaVersion: ENGINE_STATE_SCHEMA_VERSION,
    currentState,
    previousState: null,
    workflow,
    confidence: "medium",
    activeFeatureId: featureId,
    blockers: [],
    currentAgent: null,
    previousAgent: null,
    metadata: {
      lastTransitionId: null,
      lastTransitionAt: null,
      lastCheckpointAt: null,
      transitionCount: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Checkpoint persistence
// ---------------------------------------------------------------------------

/**
 * Save a checkpoint to .devflow/checkpoint.json.
 * Written atomically to prevent partial writes.
 */
export async function saveCheckpoint(
  rootPath: string,
  checkpoint: CheckpointData,
): Promise<void> {
  await atomicWrite(
    checkpointPath(rootPath),
    JSON.stringify(checkpoint, null, 2),
  );
}

/**
 * Load the most recent checkpoint from .devflow/checkpoint.json.
 * Returns null if no checkpoint exists.
 */
export async function loadCheckpoint(
  rootPath: string,
): Promise<CheckpointData | null> {
  const content = await safeReadFile(checkpointPath(rootPath));
  if (!content) return null;

  try {
    return JSON.parse(content) as CheckpointData;
  } catch {
    // Corrupted checkpoint — discard silently
    return null;
  }
}

/**
 * Delete the checkpoint file (called after successful resume).
 */
export async function clearCheckpoint(rootPath: string): Promise<void> {
  try {
    const fsp = await import("node:fs/promises");
    await fsp.unlink(checkpointPath(rootPath));
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Check whether a checkpoint exists for the given root.
 */
export async function hasCheckpoint(rootPath: string): Promise<boolean> {
  const checkpoint = await loadCheckpoint(rootPath);
  return checkpoint !== null;
}
