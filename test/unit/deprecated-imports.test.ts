/**
 * Verifies that deprecated re-export shims still resolve correctly.
 *
 * These tests ensure backward compatibility: code importing from the old
 * flat paths (src/engine/*, src/config/*, src/guards/*, etc.) continues
 * to work even as the canonical implementations move to src/kernel/.
 *
 * When migrating imports to kernel/ directly, these tests serve as a
 * safety net — if a test breaks, the underlying export changed.
 */

import { describe, it, expect } from "vitest";

describe("Deprecated Re-export Shims", () => {
  it("engine/state-detector re-exports from kernel/state/detector", async () => {
    const mod = await import("../../src/engine/state-detector.js");
    expect(mod.detectState).toBeDefined();
    expect(mod.determineFeatureState).toBeDefined();
    expect(typeof mod.detectState).toBe("function");
  });

  it("engine/next-action re-exports from kernel/actions/recommender", async () => {
    const mod = await import("../../src/engine/next-action.js");
    expect(mod.computeRecommendation).toBeDefined();
    expect(typeof mod.computeRecommendation).toBe("function");
  });

  it("engine/confidence-scorer re-exports from kernel/evidence/confidence", async () => {
    const mod = await import("../../src/engine/confidence-scorer.js");
    expect(mod.scoreConfidence).toBeDefined();
    expect(typeof mod.scoreConfidence).toBe("function");
  });

  it("config/index re-exports from kernel/config/index", async () => {
    const mod = await import("../../src/config/index.js");
    expect(mod.ConfigManager).toBeDefined();
    expect(typeof mod.ConfigManager).toBe("function");
  });

  it("config/defaults re-exports from kernel/config/defaults", async () => {
    const mod = await import("../../src/config/defaults.js");
    expect(mod.DEFAULTS).toBeDefined();
    expect(typeof mod.DEFAULTS).toBe("object");
    expect(mod.DEFAULTS.executionMode).toBeDefined();
  });

  it("utils/fs re-exports from kernel/utils/fs", async () => {
    const mod = await import("../../src/utils/fs.js");
    expect(mod.fileExists).toBeDefined();
    expect(mod.safeReadFile).toBeDefined();
    expect(typeof mod.fileExists).toBe("function");
  });

  it("guards/pipeline re-exports from kernel/guards/pipeline", async () => {
    const mod = await import("../../src/guards/pipeline.js");
    expect(mod.checkPipelineReadiness).toBeDefined();
    expect(mod.checkPreActionGitGuard).toBeDefined();
    expect(typeof mod.checkPipelineReadiness).toBe("function");
  });

  it("types/artifacts re-exports from kernel/types/artifacts", async () => {
    // Type-only import — verify the module loads without error
    const mod = await import("../../src/types/artifacts.js");
    expect(mod).toBeDefined();
    // Types exist at runtime as undefined, but module should resolve
    expect(true).toBe(true);
  });

  it("artifacts/manager re-exports from kernel/artifacts/manager", async () => {
    const mod = await import("../../src/artifacts/manager.js");
    expect(mod.ArtifactManager).toBeDefined();
    expect(typeof mod.ArtifactManager).toBe("function");
  });

  it("errors/remediation re-exports from kernel/errors/remediation", async () => {
    const mod = await import("../../src/errors/remediation.js");
    expect(mod.missingFileRemediation).toBeDefined();
    expect(mod.renderRemediation).toBeDefined();
    expect(typeof mod.renderRemediation).toBe("function");
  });

  it("cockpit/generator re-exports from kernel/cockpit/generator", async () => {
    const mod = await import("../../src/cockpit/generator.js");
    expect(mod.generateCockpit).toBeDefined();
    expect(typeof mod.generateCockpit).toBe("function");
  });

  it("constitution/checker re-exports from kernel/constitution/checker", async () => {
    const mod = await import("../../src/constitution/checker.js");
    expect(mod.runConstitutionCheck).toBeDefined();
    expect(mod.getConstitutionCompliance).toBeDefined();
  });

  it("constitution/loader re-exports from kernel/constitution/loader", async () => {
    const mod = await import("../../src/constitution/loader.js");
    expect(mod.loadConstitution).toBeDefined();
    expect(typeof mod.loadConstitution).toBe("function");
  });

  it("engine/semantic-validator re-exports from kernel/validators/semantic", async () => {
    const mod = await import("../../src/engine/semantic-validator.js");
    expect(mod.validateRequirementsSemantic).toBeDefined();
    expect(mod.validateTestPlanSemantic).toBeDefined();
    expect(typeof mod.validateRequirementsSemantic).toBe("function");
  });

  it("engine/loop-validator re-exports from kernel/validators/loop", async () => {
    const mod = await import("../../src/engine/loop-validator.js");
    expect(mod.validateLoopsInFeature).toBeDefined();
    expect(mod.scanActionsForLoops).toBeDefined();
  });

  it("engine/oo-validator re-exports from kernel/validators/oo", async () => {
    const mod = await import("../../src/engine/oo-validator.js");
    expect(mod.validateOOQuality).toBeDefined();
  });

  it("project/inspector re-exports from adapters/project/inspector", async () => {
    const mod = await import("../../src/project/inspector.js");
    expect(mod.inspectProject).toBeDefined();
    expect(typeof mod.inspectProject).toBe("function");
  });
});
