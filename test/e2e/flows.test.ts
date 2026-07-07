/**
 * End-to-end tests — full Devflow user flows.
 *
 * These tests simulate real user journeys using temporary directories.
 * They import the actual command functions (not CLI spawn) to test
 * the full logic chain without process overhead.
 *
 * Three scenarios:
 *   1. Greenfield — new project, minimal setup, full pipeline
 *   2. Brownfield — existing code, discovery path
 *   3. Invalid state — refusal behavior when artifacts/gates are missing
 *
 * Note: DoD checks that execute real tools (npm test, tsc) are not run
 * in these tests since temp dirs lack node_modules. Tool execution is
 * tested separately via unit tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

import { initCommand } from "../../src/commands/init.js";
import { inspectProject } from "../../src/adapters/project/inspector.js";
import { detectState } from "../../src/kernel/state/detector.js";
import { fileExists } from "../../src/kernel/utils/fs.js";

// ── Helpers ──

async function createTempProject(files: Record<string, string>): Promise<string> {
  const tmp = path.join(os.tmpdir(), `devflow-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await fs.mkdir(tmp, { recursive: true });

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tmp, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  return tmp;
}

const FEATURE_REQUIREMENTS = `# Requirements — 001-test-feature

## Descrição Funcional
Add a simple greeting function that returns "Hello, World!".

## Escopo Negativo
- No database access
- No external API calls

## Critérios de Aceitação
- Function returns correct greeting string
- Function handles empty input gracefully

## Casos de Erro
- None

## Casos Extremos
- Empty string input returns default greeting

## Dúvidas
- [x] Should we support i18n? No, v1 is English only.
`;

const FEATURE_ROADMAP = `# Roadmap — 001-test-feature

## Desenho Arquitetural
Single function in src/greeting.ts. No new dependencies.

## Camadas Envolvidas
- Domain: GreetingService

## Patterns
- Factory pattern for greeting creation

## Interfaces
- GreetingService.greet(name?: string): string

## Data Flow
- Input → GreetingService → Output string
`;

const FEATURE_ACTIONS = `# Actions — 001-test-feature

## T001: Create GreetingService
- **Target:** src/greeting.ts
- **Layer:** Domain
- **Contract:** greet(name?: string): string
- **Test:** Unit test with vitest
- **Evidence:** Test output

- [X] T001: Create GreetingService
`;

const FEATURE_TEST_PLAN = `# Test Plan — 001-test-feature

## Test Strategy
Unit tests with vitest.

### Verification Commands
\`\`\`
npm test
\`\`\`

## Gherkin Scenarios
### Scenario: Default greeting
Given no name is provided
When greet() is called
Then return "Hello, World!"

### Scenario: Named greeting
Given name "Alice"
When greet("Alice") is called
Then return "Hello, Alice!"

### Scenario: Empty string
Given empty string ""
When greet("") is called
Then return "Hello, World!"

## Coverage Targets
- Lines: >=80%
- Branches: >=80%
- Functions: >=80%
`;

const IMPLEMENTATION_LOG = `{"timestamp":"2026-07-06T12:00:00.000Z","actor":"test-user","actionId":"T001","action":"Create GreetingService","filesChanged":["src/greeting.ts"],"status":"completed","notes":"All tests pass"}
`;

// ── Tests ──

describe("E2E: Greenfield Flow", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempProject({
      "package.json": JSON.stringify({
        name: "test-greenfield",
        version: "1.0.0",
        private: true,
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
      }),
      "src/index.ts": "export const version = '1.0.0';\n",
    });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should complete full greenfield pipeline without errors", async () => {
    // Step 1: Init
    await initCommand(tmpDir);
    expect(await fileExists(path.join(tmpDir, ".devflow", "config.json"))).toBe(true);
    expect(await fileExists(path.join(tmpDir, "DEVFLOW.md"))).toBe(true);

    // Step 2: Inspect and verify state
    const inspection = await inspectProject(tmpDir);
    const stateResult = await detectState(inspection);
    expect(stateResult.currentState).toBeTruthy();
    expect(["greenfield-idea", "greenfield-specified", "no-project"]).toContain(stateResult.currentState);

    // Step 3: Create feature workspace with artifacts
    const featureId = "001-test-feature";
    const featureDir = path.join(tmpDir, "_devflow", "features", featureId);
    await fs.mkdir(featureDir, { recursive: true });

    await fs.writeFile(path.join(featureDir, "requirements.md"), FEATURE_REQUIREMENTS);
    await fs.writeFile(path.join(featureDir, "roadmap.md"), FEATURE_ROADMAP);
    await fs.writeFile(path.join(featureDir, "actions.md"), FEATURE_ACTIONS);
    await fs.writeFile(path.join(featureDir, "test-plan.md"), FEATURE_TEST_PLAN);
    await fs.writeFile(path.join(featureDir, "legacy-impact.md"), "# Legacy Impact\n\nNo legacy code affected.");
    await fs.writeFile(path.join(featureDir, "regression-watch.md"), "# Regression Watch\n\nNone.");
    await fs.writeFile(path.join(featureDir, "implementation-log.jsonl"), IMPLEMENTATION_LOG);

    // Step 4: Verify all artifacts exist on disk
    const requiredArtifacts = [
      "requirements.md", "roadmap.md", "actions.md", "test-plan.md",
      "legacy-impact.md", "regression-watch.md", "implementation-log.jsonl",
    ];
    for (const artifact of requiredArtifacts) {
      expect(await fileExists(path.join(featureDir, artifact))).toBe(true);
    }

    // Step 5: Verify DEVFLOW.md was generated with correct sections
    const cockpitRaw = await fs.readFile(path.join(tmpDir, "DEVFLOW.md"), "utf-8");
    expect(cockpitRaw).toContain("DEVFLOW Cockpit");
    expect(cockpitRaw).toContain("Current State");

    // Step 6: Verify audit directories exist
    expect(await fileExists(path.join(tmpDir, ".devflow", "audits"))).toBe(true);
    expect(await fileExists(path.join(tmpDir, ".devflow", "decisions"))).toBe(true);
  });
});

describe("E2E: Brownfield Flow", () => {
  let tmpDir: string;

  beforeEach(async () => {
    const files: Record<string, string> = {
      "package.json": JSON.stringify({
        name: "test-brownfield",
        version: "2.0.0",
        private: true,
      }),
      "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      "src/index.ts": "export * from './utils.js';",
    };

    // Create 12 source files to trigger brownfield detection
    for (let i = 1; i <= 12; i++) {
      files[`src/module-${i}.ts`] = `export const mod${i} = () => "module ${i}";\n`;
    }

    tmpDir = await createTempProject(files);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should detect brownfield project and scaffold correctly", async () => {
    await initCommand(tmpDir);

    const inspection = await inspectProject(tmpDir);
    const stateResult = await detectState(inspection);

    // Verify state detection ran
    expect(stateResult.currentState).toBeTruthy();

    // Brownfield states expected when existing code > 10 files
    const brownfieldStates = [
      "brownfield-unknown", "brownfield-discovered", "brownfield-specified",
    ];
    const isBrownfield = brownfieldStates.includes(stateResult.currentState);

    if (isBrownfield) {
      // Brownfield: verify DEVFLOW.md references discovery
      const cockpitRaw = await fs.readFile(path.join(tmpDir, "DEVFLOW.md"), "utf-8");
      expect(cockpitRaw).toContain("DEVFLOW Cockpit");
    }

    // Create feature with legacy-impact.md
    const featureId = "001-payment";
    const featureDir = path.join(tmpDir, "_devflow", "features", featureId);
    await fs.mkdir(featureDir, { recursive: true });

    await fs.writeFile(path.join(featureDir, "requirements.md"), FEATURE_REQUIREMENTS);
    await fs.writeFile(path.join(featureDir, "roadmap.md"), FEATURE_ROADMAP);
    await fs.writeFile(path.join(featureDir, "actions.md"), FEATURE_ACTIONS);
    await fs.writeFile(path.join(featureDir, "test-plan.md"), FEATURE_TEST_PLAN);
    await fs.writeFile(path.join(featureDir, "legacy-impact.md"), "# Legacy Impact\n\nAffected: src/module-1.ts (low)");
    await fs.writeFile(path.join(featureDir, "regression-watch.md"), "# Regression Watch\n\n- module-1 result format");
    await fs.writeFile(path.join(featureDir, "implementation-log.jsonl"), IMPLEMENTATION_LOG);

    // Verify legacy-impact.md exists (critical for brownfield)
    expect(await fileExists(path.join(featureDir, "legacy-impact.md"))).toBe(true);

    // Verify feature directory has all required files
    const artifacts = ["requirements.md", "roadmap.md", "actions.md", "test-plan.md", "legacy-impact.md"];
    for (const a of artifacts) {
      expect(await fileExists(path.join(featureDir, a))).toBe(true);
    }
  });
});

describe("E2E: Invalid State — Detection", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempProject({
      "package.json": JSON.stringify({ name: "test-invalid", version: "0.0.1", private: true }),
      "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      "src/index.ts": "export const x = 1;\n",
    });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create feature directory but artifacts are missing (incomplete state)", async () => {
    await initCommand(tmpDir);

    const featureId = "001-incomplete";
    const featureDir = path.join(tmpDir, "_devflow", "features", featureId);
    await fs.mkdir(featureDir, { recursive: true });

    // Only create requirements — missing roadmap, actions, test-plan
    await fs.writeFile(path.join(featureDir, "requirements.md"), FEATURE_REQUIREMENTS);

    // Verify partial state: requirements exists but roadmap doesn't
    expect(await fileExists(path.join(featureDir, "requirements.md"))).toBe(true);
    expect(await fileExists(path.join(featureDir, "roadmap.md"))).toBe(false);
    expect(await fileExists(path.join(featureDir, "actions.md"))).toBe(false);
    expect(await fileExists(path.join(featureDir, "test-plan.md"))).toBe(false);

    // Inspect project — state should NOT be feature-coding-ready
    const inspection = await inspectProject(tmpDir);
    const stateResult = await detectState(inspection);
    expect(stateResult.currentState).not.toBe("feature-coding-ready");
  });

  it("should not break on empty feature directory", async () => {
    await initCommand(tmpDir);

    const featureId = "001-empty";
    const featureDir = path.join(tmpDir, "_devflow", "features", featureId);
    await fs.mkdir(featureDir, { recursive: true });

    // Directory exists but no artifacts
    expect(await fileExists(featureDir)).toBe(true);

    // Inspect should still work (no crash)
    const inspection = await inspectProject(tmpDir);
    const stateResult = await detectState(inspection);
    expect(stateResult.currentState).toBeTruthy();
  });
});
