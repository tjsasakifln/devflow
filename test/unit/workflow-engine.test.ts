import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";

import {
  loadWorkflowSpec,
  getStateById,
  getTransitionsFromState,
  getTransitionsToState,
  getGuardById,
  getEffectById,
  clearCache,
} from "../../src/kernel/workflow/loader.js";
import {
  loadEngineState,
  saveEngineState,
  createDefaultEngineState,
  saveCheckpoint,
  loadCheckpoint,
  clearCheckpoint,
} from "../../src/kernel/workflow/persistence.js";
import {
  WorkflowEngine,
  createEngine,
} from "../../src/kernel/workflow/engine.js";
import { buildGuardContext } from "../../src/kernel/workflow/types.js";
import type { DevflowState } from "../../src/kernel/types/state.js";
import type { FeatureInfo, ProjectInspection } from "../../src/kernel/types/project.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const WORKFLOW_YAML_REL = ".devflow/workflow-states.yaml";

/** Valid state IDs from the YAML spec (35 total + legacy). */
const ALL_STATES: DevflowState[] = [
  // Project states
  "no-project",
  "greenfield-idea",
  "greenfield-specified",
  "brownfield-unknown",
  "brownfield-discovered",
  "brownfield-specified",
  // Feature pipeline
  "feature-empty",
  "feature-requirements",
  "feature-clarification-needed",
  "feature-design",
  "feature-design-reviewed",
  "feature-test-plan",
  "feature-test-plan-ready",
  "feature-pre-code-audit",
  "feature-coding-ready",
  "feature-coding-in-progress",
  "feature-verification",
  "feature-ci-verified",
  "feature-review",
  "feature-adversarial-review",
  "feature-done",
  // Anomaly states
  "drift-detected",
  "blocked",
  // Legacy states
  "feature-planning",
  "feature-planned",
  "feature-todo",
];

/** Create a temp directory with minimal Devflow structure and the YAML spec. */
async function createDevflowTempDir(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wf-test-"));
  await fs.mkdir(path.join(tmpDir, ".devflow"), { recursive: true });
  // Copy the workflow states YAML from the project root
  const yamlContent = await fs.readFile(
    path.join(PROJECT_ROOT, WORKFLOW_YAML_REL),
    "utf-8",
  );
  await fs.writeFile(
    path.join(tmpDir, WORKFLOW_YAML_REL),
    yamlContent,
    "utf-8",
  );
  return tmpDir;
}

const MINIMAL_INSPECTION: ProjectInspection = {
  rootPath: "/tmp",
  hasGit: false,
  hasRemote: false,
  currentBranch: null,
  packageManager: null,
  hasPackageJson: false,
  hasSrcDir: false,
  hasDotDevflow: false,
  hasDevArtifacts: false,
  hasDevflowMd: false,
  hasClaudeMd: false,
  activeFeature: null,
  features: [],
  detectedFramework: null,
  language: null,
  fileCount: 0,
  gitStatus: "clean",
  lastModifiedTimestamp: 0,
};

const NPM_INSPECTION: ProjectInspection = {
  rootPath: "/tmp",
  hasGit: false,
  hasRemote: false,
  currentBranch: null,
  packageManager: "npm",
  hasPackageJson: true,
  hasSrcDir: false,
  hasDotDevflow: false,
  hasDevArtifacts: false,
  hasDevflowMd: false,
  hasClaudeMd: false,
  activeFeature: null,
  features: [],
  detectedFramework: null,
  language: "javascript",
  fileCount: 5,
  gitStatus: "clean",
  lastModifiedTimestamp: Date.now(),
};

// =============================================================================
// 1. Loader Tests
// =============================================================================

describe("Workflow Loader", () => {
  beforeAll(() => {
    clearCache();
  });

  afterAll(() => {
    clearCache();
  });

  it("loads the workflow spec from the project root", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    expect(spec).toBeDefined();
    expect(spec.version).toBe("1.0");
    expect(spec.meta).toBeDefined();
    expect(spec.meta.title).toContain("Devflow Universal Workflow");
  });

  it("parses all 35+ states from the YAML spec", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    expect(spec.states.length).toBeGreaterThanOrEqual(35);
  });

  it("parses all transitions from the YAML spec", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    expect(spec.transitions.length).toBeGreaterThanOrEqual(73);
  });

  it("parses all guards from the YAML spec", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    expect(spec.guards.length).toBeGreaterThanOrEqual(52);
  });

  it("parses all effects from the YAML spec", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    expect(spec.effects.length).toBeGreaterThanOrEqual(38);
  });

  it("caches the spec in memory (second call returns same ref)", async () => {
    clearCache();
    const spec1 = await loadWorkflowSpec(PROJECT_ROOT);
    const spec2 = await loadWorkflowSpec(PROJECT_ROOT);
    expect(spec1).toBe(spec2); // Same reference
  });

  it("looks up a state by ID", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const state = getStateById(spec, "feature-empty");
    expect(state).toBeDefined();
    expect(state!.id).toBe("feature-empty");
    expect(state!.type).toBe("feature");
    expect(state!.category).toBe("inception");
  });

  it("returns undefined for unknown state ID", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    expect(getStateById(spec, "nonexistent-state")).toBeUndefined();
  });

  it("gets transitions from a specific state", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const transitions = getTransitionsFromState(spec, "no-project");
    expect(transitions.length).toBeGreaterThanOrEqual(2);
    expect(transitions.some((t) => t.to === "greenfield-idea")).toBe(true);
    expect(transitions.some((t) => t.to === "brownfield-unknown")).toBe(true);
  });

  it("gets transitions to a specific state", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const transitions = getTransitionsToState(spec, "feature-done");
    expect(transitions.length).toBeGreaterThanOrEqual(2);
  });

  it("looks up a guard by ID", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const guard = getGuardById(spec, "hasActiveFeature");
    expect(guard).toBeDefined();
    expect(guard!.logic).toContain("activeFeature");
  });

  it("looks up an effect by ID", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const effect = getEffectById(spec, "initDevflow");
    expect(effect).toBeDefined();
    expect(effect!.writes).toContain(".devflow/config.json");
  });

  it("validates that every transition references valid states", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const stateIds = new Set(spec.states.map((s) => s.id));

    for (const t of spec.transitions) {
      expect(stateIds.has(t.from)).toBe(true);
      expect(stateIds.has(t.to)).toBe(true);
    }
  });

  it("validates that every guard reference is resolvable", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const guardIds = new Set(spec.guards.map((g) => g.id));

    for (const t of spec.transitions) {
      if (t.guard !== null) {
        expect(guardIds.has(t.guard)).toBe(true);
      }
    }
  });

  it("validates that every effect reference is resolvable", async () => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const effectIds = new Set(spec.effects.map((e) => e.id));

    for (const t of spec.transitions) {
      if (t.effect !== null) {
        expect(effectIds.has(t.effect)).toBe(true);
      }
    }
  });
});

// =============================================================================
// 2. Persistence Tests
// =============================================================================

describe("Workflow Persistence", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wf-persist-test-"));
    await fs.mkdir(path.join(tmpDir, ".devflow"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-project" }, null, 2),
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates and saves a default engine state", async () => {
    const state = createDefaultEngineState("no-project", "greenfield", null);
    expect(state.schemaVersion).toBe(2);
    expect(state.currentState).toBe("no-project");
    expect(state.metadata.transitionCount).toBe(0);

    await saveEngineState(tmpDir, state);
  });

  it("loads a previously saved engine state", async () => {
    const state = createDefaultEngineState("feature-empty", "greenfield", "feat-1");
    await saveEngineState(tmpDir, state);

    const loaded = await loadEngineState(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.currentState).toBe("feature-empty");
    expect(loaded!.activeFeatureId).toBe("feat-1");
    expect(loaded!.schemaVersion).toBe(2);
  });

  it("migrates v1 state format to v2 on load", async () => {
    const v1State = {
      currentState: "feature-done",
      previousState: "feature-review",
      confidence: "high",
      lastUpdated: new Date().toISOString(),
      activeFeatureId: "feat-2",
      blockers: [],
    };
    await fs.writeFile(
      path.join(tmpDir, ".devflow", "state.json"),
      JSON.stringify(v1State, null, 2),
    );

    const loaded = await loadEngineState(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.currentState).toBe("feature-done");
    expect(loaded!.schemaVersion).toBe(2);
    expect(loaded!.metadata.lastTransitionAt).toBe(v1State.lastUpdated);
  });

  it("returns null when no state file exists", async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "wf-empty-"));
    const loaded = await loadEngineState(emptyDir);
    expect(loaded).toBeNull();
    await fs.rm(emptyDir, { recursive: true, force: true });
  });

  it("saves and loads a checkpoint", async () => {
    const state = createDefaultEngineState("feature-coding-in-progress", "greenfield", "feat-3");
    const checkpoint = {
      schemaVersion: 2,
      engineState: state,
      checkpointContext: {
        transitionId: "t032",
        transitionLabel: "Start Coding",
        fromState: "feature-coding-ready" as DevflowState,
        toState: "feature-coding-in-progress" as DevflowState,
        guardResults: [],
        effectsExecuted: ["startImplementation"],
        timestamp: new Date().toISOString(),
      },
    };

    await saveCheckpoint(tmpDir, checkpoint);
    const loaded = await loadCheckpoint(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.checkpointContext.transitionId).toBe("t032");
    expect(loaded!.checkpointContext.transitionLabel).toBe("Start Coding");
  });

  it("clears a checkpoint", async () => {
    await clearCheckpoint(tmpDir);
    const loaded = await loadCheckpoint(tmpDir);
    expect(loaded).toBeNull();
  });

  it("handles corrupted checkpoint gracefully", async () => {
    const cpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wf-corrupt-"));
    await fs.mkdir(path.join(cpDir, ".devflow"), { recursive: true });
    await fs.writeFile(
      path.join(cpDir, ".devflow", "checkpoint.json"),
      "not-valid-json{",
    );
    const loaded = await loadCheckpoint(cpDir);
    expect(loaded).toBeNull();
    await fs.rm(cpDir, { recursive: true, force: true });
  });
});

// =============================================================================
// 3. Engine Tests
// =============================================================================

describe("Workflow Engine", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await createDevflowTempDir();

    // Write initial state
    const initState = createDefaultEngineState("no-project", "greenfield", null);
    await saveEngineState(tmpDir, initState);

    // Write package.json so inspection detects something
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-project" }, null, 2),
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates an engine instance", () => {
    const engine = createEngine(tmpDir);
    expect(engine).toBeInstanceOf(WorkflowEngine);
    expect(engine.getCurrentState()).toBeNull(); // Not initialized
  });

  it("initializes engine and loads spec", async () => {
    clearCache();
    const inspection: ProjectInspection = {
      ...NPM_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
      hasDevArtifacts: false,
      activeFeature: null,
      fileCount: 5,
    };

    const engine = createEngine(tmpDir);
    await engine.initialize(inspection);

    expect(engine.getState()).not.toBeNull();
    expect(engine.getCurrentState()).not.toBeNull();
    expect(engine.getSpec()).not.toBeNull();
    expect(engine.getSpec()!.states.length).toBeGreaterThanOrEqual(35);
  });

  it("evaluates a guard that passes", async () => {
    const engine = createEngine(tmpDir);
    const inspection: ProjectInspection = {
      ...NPM_INSPECTION,
      rootPath: tmpDir,
    };
    await engine.initialize(inspection);

    // hasMinimalCodeAndNoDevflow: !hasDotDevflow && (hasPackageJson || hasGit) && fileCount <= 10
    // With hasPackageJson=true, hasDotDevflow=false (from context override), fileCount=5
    const result = await engine.evaluateGuard("hasMinimalCodeAndNoDevflow", {
      inspection: {
        ...MINIMAL_INSPECTION,
        rootPath: tmpDir,
        hasPackageJson: true,
        fileCount: 5,
        hasDotDevflow: false,
      },
      feature: null,
      stateFile: null,
      userDecision: null,
      gitStatus: "clean",
      bugStatus: null,
      qaVerdict: null,
      adversarialVerdict: null,
      riskLevel: null,
      bugFound: false,
      bugSource: null,
      driftDetectedFlag: false,
      specsModified: false,
      driftResolved: false,
      driftReconciliationFailed: false,
      bugfixImplementationComplete: false,
      bugfixVerificationStatus: null,
    });

    expect(result.passed).toBe(true);
  });

  it("evaluates a guard that fails", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: tmpDir,
    });

    // hasActiveFeature: inspection.activeFeature !== null
    const result = await engine.evaluateGuard("hasActiveFeature");
    expect(result.passed).toBe(false);
  });

  it("returns null guard result for unknown guard", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: tmpDir,
    });

    const result = await engine.evaluateGuard("nonexistent-guard-id");
    expect(result.passed).toBeNull();
  });

  it("returns valid transitions for a state", async () => {
    clearCache();
    const engine = createEngine(tmpDir);

    // Manually set engine state to no-project using direct write
    const manualState = createDefaultEngineState("no-project", "greenfield", null);
    await saveEngineState(tmpDir, manualState);

    // Initialize with state file (will load persisted no-project)
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
    });

    const validTransitions = await engine.getValidTransitions();
    expect(validTransitions.length).toBeGreaterThanOrEqual(2);

    // From no-project, should have transitions to greenfield-idea and brownfield-unknown
    const targetStates = validTransitions.map((t) => t.transition.to);
    expect(targetStates).toContain("greenfield-idea");
    expect(targetStates).toContain("brownfield-unknown");
  });

  it("registers custom guard handlers", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: tmpDir,
    });

    engine.registerGuard("hasActiveFeature", () => true);
    const result = await engine.evaluateGuard("hasActiveFeature");
    expect(result.passed).toBe(true);
  });
});

// =============================================================================
// 4. Parameterized Tests: All States
// =============================================================================

describe("Parameterized: All states have valid transitions", () => {
  beforeAll(() => {
    clearCache();
  });

  const stateCases = ALL_STATES.map((state) => [state] as [DevflowState]);

  it.each(stateCases)("state '%s' has at least one outgoing transition", async (state) => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const transitions = getTransitionsFromState(spec, state);
    expect(transitions.length).toBeGreaterThanOrEqual(1);
  });

  it.each(stateCases)("state '%s' has transitions to known target states", async (state) => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const stateIds = new Set(spec.states.map((s) => s.id));
    const transitions = getTransitionsFromState(spec, state);

    for (const t of transitions) {
      expect(stateIds.has(t.to)).toBe(true);
    }
  });

  it.each(stateCases)("state '%s' has valid workflow in spec", async (state) => {
    const spec = await loadWorkflowSpec(PROJECT_ROOT);
    const stateDef = getStateById(spec, state);
    expect(stateDef).toBeDefined();
    expect(stateDef!.workflow).toBeDefined();
    expect(typeof stateDef!.label).toBe("string");
    expect(stateDef!.label.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// 5. Guard Context Builder Tests
// =============================================================================

describe("Guard Context Builder", () => {
  it("builds a context with defaults", () => {
    const inspection: ProjectInspection = {
      rootPath: "/test",
      hasGit: true,
      hasRemote: false,
      currentBranch: "main",
      packageManager: "npm",
      hasPackageJson: true,
      hasSrcDir: true,
      hasDotDevflow: true,
      hasDevArtifacts: true,
      hasDevflowMd: true,
      hasClaudeMd: true,
      activeFeature: null,
      features: [],
      detectedFramework: null,
      language: "typescript",
      fileCount: 10,
      gitStatus: "clean",
      lastModifiedTimestamp: Date.now(),
    };

    const ctx = buildGuardContext(inspection, null);

    expect(ctx.inspection).toBe(inspection);
    expect(ctx.feature).toBeNull();
    expect(ctx.userDecision).toBeNull();
    expect(ctx.gitStatus).toBe("clean");
    expect(ctx.bugFound).toBe(false);
  });

  it("merges overrides with defaults", () => {
    const inspection: ProjectInspection = {
      rootPath: "/test",
      hasGit: true,
      hasRemote: false,
      currentBranch: "main",
      packageManager: "npm",
      hasPackageJson: true,
      hasSrcDir: true,
      hasDotDevflow: true,
      hasDevArtifacts: true,
      hasDevflowMd: true,
      hasClaudeMd: true,
      activeFeature: null,
      features: [],
      detectedFramework: null,
      language: "typescript",
      fileCount: 10,
      gitStatus: "clean",
      lastModifiedTimestamp: Date.now(),
    };

    const ctx = buildGuardContext(inspection, null, {
      userDecision: "skip-specs",
      qaVerdict: "PASS",
    });

    expect(ctx.userDecision).toBe("skip-specs");
    expect(ctx.qaVerdict).toBe("PASS");
    expect(ctx.gitStatus).toBe("clean");
    expect(ctx.bugFound).toBe(false);
  });
});

// =============================================================================
// 6. Checkpoint Tests
// =============================================================================

describe("Checkpoint/Resume", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await createDevflowTempDir();
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "cp-test" }, null, 2),
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("saves a checkpoint via the engine", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...NPM_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
    });

    await engine.saveCheckpoint();
    expect(await engine.hasCheckpoint()).toBe(true);
  });

  it("resumes from a checkpoint", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...NPM_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
    });

    const resumed = await engine.resumeFromCheckpoint();
    expect(resumed).toBe(true);
    expect(engine.getCurrentState()).not.toBeNull();
  });

  it("returns false when no checkpoint exists", async () => {
    const cleanDir = await createDevflowTempDir();

    const engine = createEngine(cleanDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: cleanDir,
    });

    const resumed = await engine.resumeFromCheckpoint();
    expect(resumed).toBe(false);

    await fs.rm(cleanDir, { recursive: true, force: true });
  });
});

// =============================================================================
// 7. Dry-Run Tests
// =============================================================================

describe("Dry-Run Mode", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await createDevflowTempDir();

    const initState = createDefaultEngineState("feature-empty", "greenfield", "feat-1");
    await saveEngineState(tmpDir, initState);

    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "dry-test" }, null, 2),
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("simulates a transition without persisting state changes", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...NPM_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
      activeFeature: {
        id: "feat-1",
        directory: tmpDir + "/_devflow/features/feat-1",
        hasRequirements: false,
        hasClarification: false,
        hasQualityAudit: false,
        hasRoadmap: false,
        hasActions: false,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: false,
        hasRegressionWatch: false,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: false,
        requirementsDoubts: false,
        actionsCompletionRatio: 0,
        isActive: true,
      },
    });

    const result = await engine.dryRunTransition("t021");
    expect(result.transitionId).toBe("t021");
    expect(result.fromState).toBe("feature-empty");
    expect(result.toState).toBe("feature-requirements");
    // State should NOT have changed after dry run
    expect(engine.getCurrentState()).toBe("feature-empty");
  });

  it("dry-runs all transitions from current state", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...NPM_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
      activeFeature: {
        id: "feat-1",
        directory: tmpDir + "/_devflow/features/feat-1",
        hasRequirements: false,
        hasClarification: false,
        hasQualityAudit: false,
        hasRoadmap: false,
        hasActions: false,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: false,
        hasRegressionWatch: false,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: false,
        requirementsDoubts: false,
        actionsCompletionRatio: 0,
        isActive: true,
      },
    });

    const results = await engine.dryRunAll();
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.transitionId === "t021")).toBe(true);
  });
});

// =============================================================================
// 8. Edge case tests
// =============================================================================

describe("Engine Edge Cases", () => {
  it("returns null for state before initialization", () => {
    const engine = createEngine("/nonexistent");
    expect(engine.getState()).toBeNull();
    expect(engine.getCurrentState()).toBeNull();
  });

  it("fails gracefully when spec file is missing", async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "wf-no-spec-"));

    // Don't copy YAML — test should fail with informative message
    const engine = createEngine(emptyDir);
    await expect(
      engine.initialize({
        ...MINIMAL_INSPECTION,
        rootPath: emptyDir,
      }),
    ).rejects.toThrow("Workflow spec not found");

    await fs.rm(emptyDir, { recursive: true, force: true });
  });

  it("custom guard registration works", async () => {
    clearCache();

    // Use a temp dir with YAML for engine initialization
    const engineDir = await createDevflowTempDir();
    const engine = createEngine(engineDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: engineDir,
    });

    engine.registerGuard("myCustomGuard", () => true);
    const result = await engine.evaluateGuard("myCustomGuard");
    expect(result.passed).toBe(true);

    await fs.rm(engineDir, { recursive: true, force: true });
  });
});

// =============================================================================
// 9. Transition execution tests
// =============================================================================

describe("Transition Execution", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await createDevflowTempDir();

    const initState = createDefaultEngineState("feature-empty", "greenfield", "feat-t001");
    await saveEngineState(tmpDir, initState);

    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "trans-exec" }, null, 2),
    );

    // Register a no-op effect handler so effects don't fail
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("executes a valid transition from feature-empty to feature-requirements", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...NPM_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
      activeFeature: {
        id: "feat-t001",
        directory: tmpDir + "/_devflow/features/feat-t001",
        hasRequirements: false,
        hasClarification: false,
        hasQualityAudit: false,
        hasRoadmap: false,
        hasActions: false,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: false,
        hasRegressionWatch: false,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: false,
        requirementsDoubts: false,
        actionsCompletionRatio: 0,
        isActive: true,
      },
    });

    const result = await engine.executeTransition("t021");
    expect(result.success).toBe(true);
    expect(result.transitionId).toBe("t021");
    expect(result.fromState).toBe("feature-empty");
    expect(result.toState).toBe("feature-requirements");
    expect(result.newEngineState.currentState).toBe("feature-requirements");
    expect(engine.getCurrentState()).toBe("feature-requirements");
  });

  it("rejects transition with incorrect from-state", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...NPM_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
    });

    // Current state is feature-requirements, t001 expects no-project
    const result = await engine.executeTransition("t001");
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects unknown transition ID", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...NPM_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
    });

    const result = await engine.executeTransition("nonexistent-transition");
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("not found");
  });

  it("checkpoint is saved after successful transition", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...NPM_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
      activeFeature: {
        id: "feat-t001",
        directory: tmpDir + "/_devflow/features/feat-t001",
        hasRequirements: true,
        hasClarification: false,
        hasQualityAudit: true,
        hasRoadmap: false,
        hasActions: false,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: false,
        hasRegressionWatch: false,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: false,
        requirementsDoubts: false,
        actionsCompletionRatio: 0,
        isActive: true,
      },
    });

    const result = await engine.executeTransition("t023");
    expect(result.success).toBe(true);
    expect(result.checkpointSaved).toBe(true);
  });
});
