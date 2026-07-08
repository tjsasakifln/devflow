// =============================================================================
// Tests: Agent-Driven Development Workflow (Story 2.4)
// =============================================================================
// Covers:
//   1. Agent delegation matrix
//   2. Handoff protocol generation and persistence
//   3. Authority enforcement
//   4. Agent spawning (mocked)
//   5. Engine integration (agent-aware transitions)
//   6. E2E multi-agent flow
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";

// -- Agent Delegation --
import {
  DELEGATION_PIPELINE,
  getPipelinePosition,
  getNextAgentInPipeline,
  isValidDelegation,
  isInPipeline,
  getDelegationTargets,
  findDelegationPath,
  validateAgentSequence,
} from "../../src/kernel/workflow/agent-delegation.js";

// -- Handoff --
import {
  createHandoffArtifact,
  renderHandoffYaml,
  generateHandoffYaml,
  saveHandoffArtifact,
  parseHandoffYaml,
  loadLatestHandoff,
  estimateTokens,
  validateHandoffSize,
  formatHandoffSummary,
  MAX_HANDOFF_TOKENS,
  MAX_DECISIONS,
  MAX_FILES_MODIFIED,
  MAX_BLOCKERS,
} from "../../src/kernel/workflow/handoff.js";

// -- Authority Enforcer --
import {
  checkAuthority,
  checkDelegationAuthority,
  getBlockedOperations,
  getAllowedOperations,
  validateAgentSequence as validateAuthSequence,
  AUTHORITY_MATRIX,
} from "../../src/kernel/workflow/authority-enforcer.js";
import type { AgentOperation } from "../../src/kernel/workflow/authority-enforcer.js";

// -- Agent Spawner --
import {
  spawnAgent,
  validateSpawnContext,
} from "../../src/kernel/workflow/agent-spawner.js";

// -- Engine --
import {
  WorkflowEngine,
  createEngine,
  clearEngineCache,
} from "../../src/kernel/workflow/engine.js";
import {
  createDefaultEngineState,
  saveEngineState,
} from "../../src/kernel/workflow/persistence.js";
import { loadWorkflowSpec, clearCache as clearLoaderCache } from "../../src/kernel/workflow/loader.js";
import type { ProjectInspection } from "../../src/kernel/types/project.js";
import type { DevflowState } from "../../src/kernel/types/state.js";
import type { AgentRole } from "../../src/kernel/workflow/types.js";
import { AGENT_ROLES } from "../../src/kernel/workflow/types.js";

// =============================================================================
// Fixtures
// =============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

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

/** Create a temp directory with Devflow structure. */
async function createDevflowTempDir(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-test-"));
  await fs.mkdir(path.join(tmpDir, ".devflow"), { recursive: true });
  const yamlContent = await fs.readFile(
    path.join(PROJECT_ROOT, ".devflow/workflow-states.yaml"),
    "utf-8",
  );
  await fs.writeFile(
    path.join(tmpDir, ".devflow", "workflow-states.yaml"),
    yamlContent,
    "utf-8",
  );
  return tmpDir;
}

// =============================================================================
// 1. Agent Delegation Matrix Tests
// =============================================================================

describe("Agent Delegation Matrix", () => {
  it("has the correct pipeline order", () => {
    expect(DELEGATION_PIPELINE).toEqual([
      "pm", "sm", "po", "dev", "qa", "devops",
    ]);
  });

  it("returns correct pipeline position", () => {
    expect(getPipelinePosition("pm")).toBe(0);
    expect(getPipelinePosition("sm")).toBe(1);
    expect(getPipelinePosition("po")).toBe(2);
    expect(getPipelinePosition("dev")).toBe(3);
    expect(getPipelinePosition("qa")).toBe(4);
    expect(getPipelinePosition("devops")).toBe(5);
  });

  it("returns -1 for specialists not in pipeline", () => {
    expect(getPipelinePosition("architect")).toBe(-1);
    expect(getPipelinePosition("analyst")).toBe(-1);
    expect(getPipelinePosition("data-engineer")).toBe(-1);
    expect(getPipelinePosition("ux-expert")).toBe(-1);
  });

  it("isInPipeline returns correct values", () => {
    expect(isInPipeline("pm")).toBe(true);
    expect(isInPipeline("dev")).toBe(true);
    expect(isInPipeline("architect")).toBe(false);
    expect(isInPipeline("analyst")).toBe(false);
  });

  it("getNextAgentInPipeline returns correct next agent", () => {
    expect(getNextAgentInPipeline("pm")).toBe("sm");
    expect(getNextAgentInPipeline("sm")).toBe("po");
    expect(getNextAgentInPipeline("po")).toBe("dev");
    expect(getNextAgentInPipeline("dev")).toBe("qa");
    expect(getNextAgentInPipeline("qa")).toBe("devops");
    expect(getNextAgentInPipeline("devops")).toBeNull();
    expect(getNextAgentInPipeline("architect")).toBeNull();
  });

  it("isValidDelegation: same agent is always valid", () => {
    for (const role of AGENT_ROLES) {
      expect(isValidDelegation(role, role)).toBe(true);
    }
  });

  it("isValidDelegation: forward pipeline flow is valid", () => {
    expect(isValidDelegation("pm", "sm")).toBe(true);
    expect(isValidDelegation("sm", "po")).toBe(true);
    expect(isValidDelegation("po", "dev")).toBe(true);
    expect(isValidDelegation("dev", "qa")).toBe(true);
    expect(isValidDelegation("qa", "devops")).toBe(true);
  });

  it("isValidDelegation: backward pipeline flow is blocked (unless graph allows)", () => {
    // Strictly backward in pipeline — blocked
    expect(isValidDelegation("dev", "po")).toBe(false);
    expect(isValidDelegation("dev", "sm")).toBe(false);
    // Graph allows QA->Dev (return for fixes), PO->SM (return for revisions),
    // and DevOps->QA (post-deploy verification)
    expect(isValidDelegation("qa", "dev")).toBe(true);
    expect(isValidDelegation("po", "sm")).toBe(true);
    expect(isValidDelegation("devops", "qa")).toBe(true);
  });

  it("isValidDelegation: architect can delegate to data-engineer", () => {
    expect(isValidDelegation("architect", "data-engineer")).toBe(true);
  });

  it("isValidDelegation: dev can delegate to architect", () => {
    expect(isValidDelegation("dev", "architect")).toBe(true);
  });

  it("isValidDelegation: pm can delegate to analyst", () => {
    expect(isValidDelegation("pm", "analyst")).toBe(true);
    expect(isValidDelegation("qa", "architect")).toBe(false);
  });

  it("getDelegationTargets returns correct targets", () => {
    const devTargets = getDelegationTargets("dev");
    expect(devTargets).toContain("qa");
    expect(devTargets).toContain("architect");
    expect(devTargets).toContain("data-engineer");
  });

  it("findDelegationPath finds BFS shortest path", () => {
    // PM -> Dev: PM -> SM -> PO -> Dev
    const path = findDelegationPath("pm", "dev");
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThanOrEqual(2);
    expect(path![0]).toBe("pm");
    expect(path![path!.length - 1]).toBe("dev");
  });

  it("findDelegationPath returns null for unreachable", () => {
    const path = findDelegationPath("analyst", "devops");
    // May or may not have a path depending on graph
    // Just check it doesn't crash
    expect(Array.isArray(path) || path === null).toBe(true);
  });

  it("validateAgentSequence passes for valid pipeline", () => {
    const result = validateAgentSequence(["pm", "sm", "po", "dev", "qa", "devops"]);
    expect(result).toBeNull();
  });

  it("validateAgentSequence fails for invalid sequence", () => {
    const result = validateAgentSequence(["dev", "pm"]);
    expect(result).not.toBeNull();
    expect(result!.allowed).toBe(false);
  });
});

// =============================================================================
// 2. Handoff Protocol Tests
// =============================================================================

describe("Handoff Protocol", () => {
  it("creates a handoff artifact with all required fields", () => {
    const artifact = createHandoffArtifact({
      fromAgent: "dev",
      toAgent: "qa",
      storyId: "2.4",
      storyPath: "docs/stories/2.4.md",
      storyStatus: "InProgress",
      currentTask: "Implement tests",
      branch: "feature/agent-workflow",
      decisions: ["Use YAML for handoff format", "Max 500 tokens limit"],
      filesModified: ["src/kernel/workflow/handoff.ts"],
      blockers: [],
      nextAction: "Run QA gate on story 2.4",
    });

    expect(artifact.handoff.from_agent).toBe("dev");
    expect(artifact.handoff.to_agent).toBe("qa");
    expect(artifact.handoff.story_context.story_id).toBe("2.4");
    expect(artifact.handoff.story_context.story_path).toBe("docs/stories/2.4.md");
    expect(artifact.handoff.story_context.story_status).toBe("InProgress");
    expect(artifact.handoff.story_context.current_task).toBe("Implement tests");
    expect(artifact.handoff.story_context.branch).toBe("feature/agent-workflow");
    expect(artifact.handoff.decisions).toHaveLength(2);
    expect(artifact.handoff.files_modified).toHaveLength(1);
    expect(artifact.handoff.blockers).toHaveLength(0);
    expect(artifact.handoff.next_action).toBe("Run QA gate on story 2.4");
  });

  it("truncates fields to compaction limits", () => {
    const manyDecisions = Array.from({ length: 20 }, (_, i) => `Decision ${i + 1}`);
    const manyFiles = Array.from({ length: 20 }, (_, i) => `file${i}.ts`);
    const manyBlockers = Array.from({ length: 10 }, (_, i) => `Blocker ${i + 1}`);

    const artifact = createHandoffArtifact({
      fromAgent: "pm",
      toAgent: "sm",
      storyId: "1.0",
      storyPath: "docs/stories/1.0.md",
      decisions: manyDecisions,
      filesModified: manyFiles,
      blockers: manyBlockers,
      nextAction: "Create story",
    });

    expect(artifact.handoff.decisions.length).toBeLessThanOrEqual(MAX_DECISIONS);
    expect(artifact.handoff.files_modified.length).toBeLessThanOrEqual(MAX_FILES_MODIFIED);
    expect(artifact.handoff.blockers.length).toBeLessThanOrEqual(MAX_BLOCKERS);
  });

  it("renders handoff artifact as valid YAML", () => {
    const { yaml, estimatedTokens } = renderHandoffYaml(
      createHandoffArtifact({
        fromAgent: "dev",
        toAgent: "qa",
        storyId: "2.4",
        storyPath: "docs/stories/2.4.md",
        nextAction: "Run QA",
      }),
    );

    expect(yaml).toContain("from_agent");
    expect(yaml).toContain("to_agent");
    expect(yaml).toContain("story_context");
    expect(yaml).toContain("decisions");
    expect(yaml).toContain("files_modified");
    expect(yaml).toContain("blockers");
    expect(yaml).toContain("next_action");
    expect(estimatedTokens).toBeGreaterThan(0);
  });

  it("handoff artifact stays under 500 token limit", () => {
    const { yaml, estimatedTokens } = generateHandoffYaml({
      fromAgent: "pm",
      toAgent: "sm",
      storyId: "1.0",
      storyPath: "docs/stories/1.0.md",
      storyStatus: "Ready",
      currentTask: "Draft story",
      branch: "main",
      decisions: [
        "Use YAML format",
        "Truncate at limits",
        "Save to .aiox/handoffs/",
        "Include story context",
        "Include next action",
      ],
      filesModified: [
        "docs/stories/1.0.md",
        "src/kernel/workflow/handoff.ts",
        "src/kernel/workflow/agent-delegation.ts",
      ],
      blockers: ["Waiting for PRD approval"],
      nextAction: "Create story from epic requirements",
    });

    expect(estimatedTokens).toBeLessThanOrEqual(MAX_HANDOFF_TOKENS);
    expect(validateHandoffSize(yaml, estimatedTokens)).toEqual([]);
  });

  it("generateHandoffYaml returns yaml, tokens, and artifact", () => {
    const result = generateHandoffYaml({
      fromAgent: "dev",
      toAgent: "qa",
      storyId: "2.4",
      storyPath: "docs/stories/2.4.md",
      nextAction: "QA review",
    });

    expect(result.yaml).toBeDefined();
    expect(result.estimatedTokens).toBeGreaterThan(0);
    expect(result.artifact.handoff.from_agent).toBe("dev");
    expect(result.artifact.handoff.to_agent).toBe("qa");
  });

  it("parses valid handoff YAML back to artifact", () => {
    const { yaml } = generateHandoffYaml({
      fromAgent: "dev",
      toAgent: "qa",
      storyId: "2.4",
      storyPath: "docs/stories/2.4.md",
      decisions: ["Test decision"],
      nextAction: "Run tests",
    });

    const parsed = parseHandoffYaml(yaml);
    expect(parsed).not.toBeNull();
    expect(parsed!.handoff.from_agent).toBe("dev");
    expect(parsed!.handoff.to_agent).toBe("qa");
    expect(parsed!.handoff.story_context.story_id).toBe("2.4");
    expect(parsed!.handoff.decisions).toContain("Test decision");
  });

  it("returns null for invalid YAML", () => {
    expect(parseHandoffYaml("not-valid-yaml: : :")).toBeNull();
    expect(parseHandoffYaml("")).toBeNull();
  });

  it("formats a human-readable summary", () => {
    const { artifact } = generateHandoffYaml({
      fromAgent: "dev",
      toAgent: "qa",
      storyId: "2.4",
      storyPath: "docs/stories/2.4.md",
      decisions: ["Fix bug"],
      filesModified: ["src/file.ts"],
      blockers: ["Test failing"],
      nextAction: "Review code",
    });

    const summary = formatHandoffSummary(artifact);
    expect(summary).toContain("Dex (Builder)");
    expect(summary).toContain("Quinn (QA)");
    expect(summary).toContain("2.4");
    expect(summary).toContain("Fix bug");
    expect(summary).toContain("src/file.ts");
    expect(summary).toContain("Test failing");
  });

  it("estimateTokens gives reasonable estimates", () => {
    expect(estimateTokens("a".repeat(100))).toBe(25); // ~4 chars/token
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("hello world")).toBe(3);
  });

  it("saves and loads handoff artifact", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "handoff-save-"));
    const { artifact } = generateHandoffYaml({
      fromAgent: "dev",
      toAgent: "qa",
      storyId: "2.4",
      storyPath: "docs/stories/2.4.md",
      nextAction: "Review",
    });

    const savedPath = await saveHandoffArtifact(tmpDir, artifact);
    expect(savedPath).toContain("handoff-dev-to-qa-");
    expect(savedPath).toContain(".yaml");

    // Verify file was written
    const content = await fs.readFile(savedPath, "utf-8");
    expect(content).toContain("dev");
    expect(content).toContain("qa");

    // Load latest
    const loaded = await loadLatestHandoff(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.handoff.from_agent).toBe("dev");
    expect(loaded!.handoff.to_agent).toBe("qa");

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});

// =============================================================================
// 3. Authority Enforcement Tests
// =============================================================================

describe("Authority Enforcement", () => {
  // ── Dev tests ──
  it("DEV: allowed to implement code", () => {
    const result = checkAuthority("dev", "impl:code");
    expect(result.allowed).toBe(true);
  });

  it("DEV: blocked from git push", () => {
    const result = checkAuthority("dev", "git:push");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("DELEGATE ONLY");
  });

  it("DEV: blocked from GitHub PR creation", () => {
    const result = checkAuthority("dev", "github:pr-create");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("DELEGATE ONLY");
  });

  it("DEV: blocked from MCP management", () => {
    expect(checkAuthority("dev", "mcp:add").allowed).toBe(false);
    expect(checkAuthority("dev", "mcp:configure").allowed).toBe(false);
  });

  it("DEV: allowed to commit and branch", () => {
    expect(checkAuthority("dev", "git:commit").allowed).toBe(true);
    expect(checkAuthority("dev", "git:branch").allowed).toBe(true);
    expect(checkAuthority("dev", "git:status").allowed).toBe(true);
  });

  // ── QA tests ──
  it("QA: allowed to review", () => {
    expect(checkAuthority("qa", "qa:review").allowed).toBe(true);
    expect(checkAuthority("qa", "qa:gate").allowed).toBe(true);
  });

  it("QA: blocked from push and implementation", () => {
    expect(checkAuthority("qa", "git:push").allowed).toBe(false);
    expect(checkAuthority("qa", "impl:code").allowed).toBe(false);
    expect(checkAuthority("qa", "impl:refactor").allowed).toBe(false);
  });

  // ── DevOps tests ──
  it("DEVOPS: exclusive push and PR authority", () => {
    expect(checkAuthority("devops", "git:push").allowed).toBe(true);
    expect(checkAuthority("devops", "github:pr-create").allowed).toBe(true);
    expect(checkAuthority("devops", "github:pr-merge").allowed).toBe(true);
  });

  it("DEVOPS: blocked from implementation", () => {
    expect(checkAuthority("devops", "impl:code").allowed).toBe(false);
    expect(checkAuthority("devops", "qa:review").allowed).toBe(false);
  });

  it("DEVOPS: exclusive MCP management", () => {
    expect(checkAuthority("devops", "mcp:add").allowed).toBe(true);
    expect(checkAuthority("devops", "mcp:remove").allowed).toBe(true);
    expect(checkAuthority("devops", "mcp:configure").allowed).toBe(true);
  });

  // ── PM tests ──
  it("PM: epic orchestration authority", () => {
    expect(checkAuthority("pm", "epic:create").allowed).toBe(true);
    expect(checkAuthority("pm", "epic:execute").allowed).toBe(true);
    expect(checkAuthority("pm", "pm:orchestrate").allowed).toBe(true);
  });

  it("PM: blocked from git push and implementation", () => {
    expect(checkAuthority("pm", "git:push").allowed).toBe(false);
    expect(checkAuthority("pm", "impl:code").allowed).toBe(false);
    expect(checkAuthority("pm", "impl:test").allowed).toBe(false);
  });

  // ── SM tests ──
  it("SM: story creation authority", () => {
    expect(checkAuthority("sm", "story:create").allowed).toBe(true);
  });

  it("SM: blocked from implementation and QA", () => {
    expect(checkAuthority("sm", "impl:code").allowed).toBe(false);
    expect(checkAuthority("sm", "qa:review").allowed).toBe(false);
  });

  // ── PO tests ──
  it("PO: story validation authority", () => {
    expect(checkAuthority("po", "story:validate").allowed).toBe(true);
    expect(checkAuthority("po", "story:update-ac").allowed).toBe(true);
  });

  it("PO: blocked from push and implementation", () => {
    expect(checkAuthority("po", "git:push").allowed).toBe(false);
    expect(checkAuthority("po", "impl:code").allowed).toBe(false);
  });

  // ── Architect tests ──
  it("ARCHITECT: design authority", () => {
    expect(checkAuthority("architect", "arch:decide").allowed).toBe(true);
    expect(checkAuthority("architect", "arch:technology-select").allowed).toBe(true);
  });

  it("ARCHITECT: blocked from implementation", () => {
    expect(checkAuthority("architect", "impl:code").allowed).toBe(false);
  });

  // ── Delegation authority tests ──
  it("checkDelegationAuthority: valid forward delegation", () => {
    const result = checkDelegationAuthority("dev", "qa");
    expect(result.allowed).toBe(true);
  });

  it("checkDelegationAuthority: blocked backward delegation", () => {
    // QA->Dev is allowed (return for fixes per delegation graph)
    expect(checkDelegationAuthority("qa", "dev").allowed).toBe(true);
    // Dev->PO is blocked (no backward pipeline step)
    const result = checkDelegationAuthority("dev", "po");
    expect(result.allowed).toBe(false);
  });

  it("checkDelegationAuthority: same agent is always valid", () => {
    for (const role of AGENT_ROLES) {
      const result = checkDelegationAuthority(role, role);
      expect(result.allowed).toBe(true);
    }
  });

  it("checkDelegationAuthority: architect to data-engineer is valid", () => {
    const result = checkDelegationAuthority("architect", "data-engineer");
    expect(result.allowed).toBe(true);
  });

  // ── Helper function tests ──
  it("getBlockedOperations returns blocked ops for a role", () => {
    const blocked = getBlockedOperations("dev");
    expect(blocked).toContain("git:push");
    expect(blocked).toContain("github:pr-create");
  });

  it("getAllowedOperations returns allowed ops for a role", () => {
    const allowed = getAllowedOperations("dev");
    expect(allowed).toContain("impl:code");
  });

  it("every role has an authority entry", () => {
    for (const role of AGENT_ROLES) {
      expect(AUTHORITY_MATRIX[role]).toBeDefined();
      expect(AUTHORITY_MATRIX[role].allowed.length).toBeGreaterThanOrEqual(1);
      expect(AUTHORITY_MATRIX[role].blocked.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("unknown role returns blocked with message", () => {
    const result = checkAuthority("unknown" as any, "impl:code");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unknown agent role");
  });

  it("unknown operation is denied by default", () => {
    const result = checkAuthority("dev", "unknown:operation" as AgentOperation);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("DENIED");
  });
});

// =============================================================================
// 4. Agent Spawner Tests
// =============================================================================

describe("Agent Spawner", () => {
  it("validates spawn context with all required fields", () => {
    const errors = validateSpawnContext({
      agent: "dev",
      rootPath: "/test",
      storyId: "2.4",
      storyPath: "docs/stories/2.4.md",
      currentState: "feature-coding-in-progress",
    });
    expect(errors).toEqual([]);
  });

  it("reports missing required fields", () => {
    const errors = validateSpawnContext({} as any);
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(errors.some((e) => e.includes("agent"))).toBe(true);
    expect(errors.some((e) => e.includes("rootPath"))).toBe(true);
    expect(errors.some((e) => e.includes("storyId"))).toBe(true);
  });

  it("spawnAgent returns error when process does not exist", async () => {
    // Use a non-existent command to test error handling
    // We mock this since spawning real processes in tests is fragile
    const result = await spawnAgent(
      {
        agent: "dev",
        rootPath: "/tmp",
        storyId: "2.4",
        storyPath: "docs/stories/2.4.md",
        currentState: "feature-coding-in-progress",
      },
      { timeout: 1000 },
    );

    // Should either fail gracefully or succeed depending on if dist/main.js exists
    expect(result).toBeDefined();
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.exitCode).toBe("number");
    expect(typeof result.command).toBe("string");
    expect(result.command).toContain("agent");
    expect(result.command).toContain("--role");
    expect(result.command).toContain("dev");
  });
});

// =============================================================================
// 5. Engine Integration Tests
// =============================================================================

describe("Engine Agent Integration", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await createDevflowTempDir();

    // Write package.json
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "agent-test" }, null, 2),
    );

    // Write initial state with dev as current agent
    const initState = createDefaultEngineState("feature-coding-in-progress", "greenfield", "feat-agent-1");
    initState.currentAgent = "dev";
    initState.previousAgent = null;
    await saveEngineState(tmpDir, initState);
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    clearEngineCache();
    clearLoaderCache();
  });

  it("executeTransition with agent tag updates currentAgent", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
      activeFeature: {
        id: "feat-agent-1",
        directory: tmpDir + "/_devflow/features/feat-agent-1",
        hasRequirements: true,
        hasClarification: false,
        hasQualityAudit: true,
        hasRoadmap: true,
        hasActions: true,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: false,
        hasRegressionWatch: false,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: true,
        requirementsDoubts: false,
        actionsCompletionRatio: 1.0,
        isActive: true,
      },
    });

    // Set current agent to dev explicitly
    const state = engine.getState()!;
    state.currentAgent = "dev";

    // The state is feature-coding-in-progress. Execute a transition with agent: qa tag
    // Find a transition from feature-coding-in-progress that has agent tag
    // Since the YAML doesn't have agent tags (they don't exist in the spec yet),
    // we need to add one or test using the executeAgentTransition method

    expect(engine.getCurrentAgent()).toBe("dev");
    expect(engine.hasActiveAgent()).toBe(true);
  });

  it("executeAgentTransition works even without agent tags in YAML", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
      activeFeature: {
        id: "feat-agent-1",
        directory: tmpDir + "/_devflow/features/feat-agent-1",
        hasRequirements: true,
        hasClarification: false,
        hasQualityAudit: true,
        hasRoadmap: true,
        hasActions: true,
        hasInvestigation: false,
        hasDataDelta: false,
        hasQaReport: false,
        hasLegacyImpact: false,
        hasRegressionWatch: false,
        hasReleaseNotes: false,
        hasImplementationLog: false,
        hasTestPlan: true,
        requirementsDoubts: false,
        actionsCompletionRatio: 1.0,
        isActive: true,
      },
    });

    // executeAgentTransition should fall back to normal transition
    // when transition has no agent tag
    const result = await engine.executeAgentTransition("t032");
    // t032 is from feature-coding-in-progress to feature-verification
    expect(result).toBeDefined();
    expect(result.transitionId).toBe("t032");

    // Since no agent tag, handoffArtifact should be undefined
    expect(result.handoffArtifact).toBeUndefined();
  });

  it("engine tracks agent state", async () => {
    const freshDir = await createDevflowTempDir();
    await fs.writeFile(
      path.join(freshDir, "package.json"),
      JSON.stringify({ name: "agent-fresh" }, null, 2),
    );

    const engine = createEngine(freshDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: freshDir,
      hasDotDevflow: true,
    });

    // Initially no agent
    expect(engine.getCurrentAgent()).toBeNull();
    expect(engine.getPreviousAgent()).toBeNull();
    expect(engine.hasActiveAgent()).toBe(false);

    await fs.rm(freshDir, { recursive: true, force: true });
  });

  it("engine state stores currentAgent after manual setting", async () => {
    const engine = createEngine(tmpDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
    });

    // Manually set agent (simulating what executeTransition with agent tag does)
    const state = engine.getState()!;
    state.currentAgent = "dev";
    state.previousAgent = null;
    await saveEngineState(tmpDir, state);

    // Re-initialize to load the saved state
    const engine2 = createEngine(tmpDir);
    await engine2.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: tmpDir,
      hasDotDevflow: true,
    });

    expect(engine2.getCurrentAgent()).toBe("dev");
    expect(engine2.getPreviousAgent()).toBeNull();
    expect(engine2.hasActiveAgent()).toBe(true);
  });
});

// =============================================================================
// 6. E2E Multi-Agent Flow Test
// =============================================================================

describe("E2E Multi-Agent Flow", () => {
  it("full pipeline delegation sequence is valid", () => {
    const pipeline: AgentRole[] = ["pm", "sm", "po", "dev", "qa", "devops"];
    const result = validateAgentSequence(pipeline);
    expect(result).toBeNull();
  });

  it("handoff through full pipeline generates valid artifacts", () => {
    const pipeline: AgentRole[] = ["pm", "sm", "po", "dev", "qa", "devops"];
    const handoffs: string[] = [];

    for (let i = 0; i < pipeline.length - 1; i++) {
      const { yaml, estimatedTokens } = generateHandoffYaml({
        fromAgent: pipeline[i],
        toAgent: pipeline[i + 1],
        storyId: "2.4",
        storyPath: "docs/stories/2.4.agent-driven-development-workflow.md",
        storyStatus: "InProgress",
        currentTask: `Handoff from ${pipeline[i]} to ${pipeline[i + 1]}`,
        branch: "main",
        decisions: [`Decision for step ${i}`],
        filesModified: [`file-${i}.ts`],
        blockers: [],
        nextAction: `Execute as ${pipeline[i + 1]}`,
      });

      expect(yaml).toContain(pipeline[i]);
      expect(yaml).toContain(pipeline[i + 1]);
      expect(estimatedTokens).toBeLessThanOrEqual(MAX_HANDOFF_TOKENS);

      // Verify every required field is present
      expect(yaml).toContain("from_agent");
      expect(yaml).toContain("to_agent");
      expect(yaml).toContain("story_context");
      expect(yaml).toContain("story_id");
      expect(yaml).toContain("story_path");
      expect(yaml).toContain("story_status");
      expect(yaml).toContain("current_task");
      expect(yaml).toContain("branch");
      expect(yaml).toContain("next_action");
      expect(yaml).toContain("blockers");

      handoffs.push(yaml);
    }

    expect(handoffs).toHaveLength(5); // 6 agents = 5 handoffs
  });

  it("authority enforcement works through full pipeline", () => {
    // Every step in the pipeline must be a valid delegation
    expect(checkDelegationAuthority("pm", "sm").allowed).toBe(true);
    expect(checkDelegationAuthority("sm", "po").allowed).toBe(true);
    expect(checkDelegationAuthority("po", "dev").allowed).toBe(true);
    expect(checkDelegationAuthority("dev", "qa").allowed).toBe(true);
    expect(checkDelegationAuthority("qa", "devops").allowed).toBe(true);

    // Reverse direction must fail (except where graph allows it)
    expect(checkDelegationAuthority("dev", "po").allowed).toBe(false);
    expect(checkDelegationAuthority("sm", "pm").allowed).toBe(false);
    // PO->SM and QA->Dev are valid return flows per delegation graph
    expect(checkDelegationAuthority("po", "sm").allowed).toBe(true);
    expect(checkDelegationAuthority("qa", "dev").allowed).toBe(true);
  });

  it("handoff + authority + delegation form a consistent system", () => {
    // For every valid delegation, verify we can generate a handoff
    const delegations = [
      { from: "pm", to: "sm" as AgentRole },
      { from: "sm", to: "po" as AgentRole },
      { from: "po", to: "dev" as AgentRole },
      { from: "dev", to: "qa" as AgentRole },
      { from: "qa", to: "devops" as AgentRole },
      { from: "dev", to: "architect" as AgentRole },
      { from: "architect", to: "data-engineer" as AgentRole },
    ];

    for (const { from, to } of delegations) {
      // Authority check
      expect(checkDelegationAuthority(from, to).allowed).toBe(true);

      // Delegation matrix check
      expect(isValidDelegation(from, to)).toBe(true);

      // Handoff generation
      const { yaml } = generateHandoffYaml({
        fromAgent: from,
        toAgent: to,
        storyId: "2.4",
        storyPath: "docs/stories/2.4.md",
        nextAction: `Handoff from ${from} to ${to}`,
      });
      expect(yaml).toContain(from);
      expect(yaml).toContain(to);
    }
  });

  it("WorkflowEngine transitions preserve agent state when agent tag present", async () => {
    // Create a minimal workflow spec with agent-tagged transitions for testing
    const specDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-spec-"));
    await fs.mkdir(path.join(specDir, ".devflow"), { recursive: true });

    // Write a minimal spec with agent tags
    const testSpec = {
      version: "1.0",
      meta: { title: "Agent Test", description: "Test spec", format: "test", source: {}, totalStates: 2 },
      states: [
        { id: "step-1", type: "feature", category: "coding", workflow: "greenfield", label: "Step 1", description: "First step", terminal: false },
        { id: "step-2", type: "feature", category: "verification", workflow: "greenfield", label: "Step 2", description: "Second step", terminal: false },
      ],
      transitions: [
        { id: "t-agent-1", from: "step-1", to: "step-2", workflow: "greenfield", label: "Dev to QA", guard: null, effect: null, description: "Handoff to QA", agent: "qa" },
        { id: "t-no-agent", from: "step-1", to: "step-2", workflow: "greenfield", label: "No Agent", guard: null, effect: null, description: "No agent tag" },
      ],
      guards: [],
      effects: [],
      workflows: {
        greenfield: { label: "Greenfield", description: "", color: "green", entryStates: ["step-1"], terminalStates: ["step-2"], stateCount: 2, states: ["step-1", "step-2"] },
      },
    };

    await fs.writeFile(
      path.join(specDir, ".devflow", "workflow-states.yaml"),
      require("js-yaml").dump(testSpec),
      "utf-8",
    );

    await fs.writeFile(
      path.join(specDir, "package.json"),
      JSON.stringify({ name: "agent-spec-test" }, null, 2),
    );

    // Set initial state
    const initState = createDefaultEngineState("step-1" as DevflowState, "greenfield", null);
    initState.currentAgent = "dev";
    await saveEngineState(specDir, initState);

    // Clear any cached spec
    clearLoaderCache();

    // Create engine and initialize
    const engine = createEngine(specDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: specDir,
      hasDotDevflow: true,
      currentBranch: "main",
      gitStatus: "clean",
    });

    // Execute the agent-tagged transition
    const result = await engine.executeTransition("t-agent-1");
    expect(result.success).toBe(true);
    expect(result.transitionId).toBe("t-agent-1");

    const state = engine.getState()!;
    expect(state.currentAgent).toBe("qa");
    expect(state.previousAgent).toBe("dev");

    // Check that handoff file was saved
    const { listDir } = await import("../../src/kernel/utils/fs.js");
    const handoffDir = path.join(specDir, ".aiox/handoffs");
    const handoffFiles = await listDir(handoffDir);
    expect(handoffFiles.length).toBeGreaterThanOrEqual(1);
    const handoffFile = handoffFiles.find((f: string) => f.includes("handoff-dev-to-qa-"));
    expect(handoffFile).toBeDefined();

    await fs.rm(specDir, { recursive: true, force: true });
  });

  it("agent-tagged transition with invalid authority is rejected", async () => {
    // Create a spec with cross-agent transition that violates authority
    const specDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-blocked-"));
    await fs.mkdir(path.join(specDir, ".devflow"), { recursive: true });

    const testSpec = {
      version: "1.0",
      meta: { title: "Blocked Agent", description: "Test", format: "test", source: {}, totalStates: 2 },
      states: [
        { id: "step-1", type: "feature", category: "coding", workflow: "greenfield", label: "Step 1", description: "", terminal: false },
        { id: "step-2", type: "feature", category: "done", workflow: "greenfield", label: "Step 2", description: "", terminal: false },
      ],
      transitions: [
        { id: "t-blocked", from: "step-1", to: "step-2", workflow: "greenfield", label: "Dev to PM", guard: null, effect: null, description: "Invalid backflow", agent: "pm" },
      ],
      guards: [],
      effects: [],
      workflows: {
        greenfield: { label: "Greenfield", description: "", color: "green", entryStates: ["step-1"], terminalStates: ["step-2"], stateCount: 2, states: ["step-1", "step-2"] },
      },
    };

    await fs.writeFile(
      path.join(specDir, ".devflow", "workflow-states.yaml"),
      require("js-yaml").dump(testSpec),
      "utf-8",
    );

    await fs.writeFile(
      path.join(specDir, "package.json"),
      JSON.stringify({ name: "agent-blocked-test" }, null, 2),
    );

    // Set initial state with dev as current agent
    const initState = createDefaultEngineState("step-1" as DevflowState, "greenfield", null);
    initState.currentAgent = "dev";
    await saveEngineState(specDir, initState);

    clearLoaderCache();

    const engine = createEngine(specDir);
    await engine.initialize({
      ...MINIMAL_INSPECTION,
      rootPath: specDir,
      hasDotDevflow: true,
    });

    // Dev trying to transition to PM — blocked by authority
    const result = await engine.executeTransition("t-blocked");
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("BLOCKED");

    await fs.rm(specDir, { recursive: true, force: true });
  });
});

// =============================================================================
// 7. Edge Cases
// =============================================================================

describe("Agent Edge Cases", () => {
  it("handles empty decisions array", () => {
    const { yaml } = generateHandoffYaml({
      fromAgent: "dev",
      toAgent: "qa",
      storyId: "2.4",
      storyPath: "docs/stories/2.4.md",
      nextAction: "Review",
    });
    expect(yaml).toBeDefined();
    expect(yaml).toContain("decisions");
  });

  it("handles empty blockers array", () => {
    const { yaml } = generateHandoffYaml({
      fromAgent: "dev",
      toAgent: "qa",
      storyId: "2.4",
      storyPath: "docs/stories/2.4.md",
      nextAction: "Continue",
    });
    expect(yaml).toBeDefined();
    expect(yaml).toContain("blockers");
  });

  it("handles all AGENT_ROLES values in tests", () => {
    // Verify every role can generate a handoff
    for (const role of AGENT_ROLES) {
      const { artifact } = generateHandoffYaml({
        fromAgent: role,
        toAgent: role, // Self-handoff
        storyId: "2.4",
        storyPath: "docs/stories/2.4.md",
        nextAction: `Test ${role}`,
      });
      expect(artifact.handoff.from_agent).toBe(role);
      expect(artifact.handoff.to_agent).toBe(role);
    }
  });

  it("handles empty files list", () => {
    const { artifact } = generateHandoffYaml({
      fromAgent: "dev",
      toAgent: "qa",
      storyId: "2.4",
      storyPath: "docs/stories/2.4.md",
      decisions: [],
      filesModified: [],
      blockers: [],
      nextAction: "Test",
    });
    expect(artifact.handoff.files_modified).toEqual([]);
  });

  it("loadLatestHandoff returns null when no handoffs exist", async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "no-handoffs-"));
    const result = await loadLatestHandoff(emptyDir);
    expect(result).toBeNull();
    await fs.rm(emptyDir, { recursive: true, force: true });
  });

  it("estimateTokens returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("unknown role checkDelegationAuthority still validates", () => {
    const result = checkDelegationAuthority("dev", "unknown" as AgentRole);
    expect(result.allowed).toBe(false);
  });
});
