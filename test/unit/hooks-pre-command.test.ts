import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

// We test the warning conditions and snooze persistence logic inline
// since the full hook system integrates with project inspection.

describe("Pre-Command Warning System", () => {
  const tmpDir = path.join(os.tmpdir(), "devflow-test-hooks");
  const featuresDir = path.join(tmpDir, "_devflow", "features", "001-test");
  const snoozePath = path.join(tmpDir, ".devflow", "warnings-snooze.json");

  beforeEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(featuresDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── Snooze persistence ──

  it("should persist snooze state and respect expiration", async () => {
    const { snoozeWarning, isWarningSnoozed, clearSnoozesForFeature } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    // Snooze a warning for 24h
    await snoozeWarning("incomplete-artifacts", "001-test", tmpDir, 24);
    let snoozed = await isWarningSnoozed("incomplete-artifacts", "001-test", tmpDir);
    expect(snoozed).toBe(true);

    // Clear snoozes
    await clearSnoozesForFeature("001-test", tmpDir);
    snoozed = await isWarningSnoozed("incomplete-artifacts", "001-test", tmpDir);
    expect(snoozed).toBe(false);
  });

  it("should not consider snoozed if no featureId", async () => {
    const { isWarningSnoozed } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    const snoozed = await isWarningSnoozed("incomplete-artifacts", undefined, tmpDir);
    expect(snoozed).toBe(false);
  });

  it("should handle corrupt snooze file gracefully", async () => {
    const { isWarningSnoozed } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    // Write invalid JSON to snooze file
    await fs.mkdir(path.join(tmpDir, ".devflow"), { recursive: true });
    await fs.writeFile(snoozePath, "not-json", "utf-8");

    // Should not throw
    const snoozed = await isWarningSnoozed("incomplete-artifacts", "001-test", tmpDir);
    expect(snoozed).toBe(false);
  });

  // ── Warning 1: Incomplete artifacts (feature prompt) ──

  it("should warn when artifacts are missing for feature prompt", async () => {
    const { warnIncompleteArtifacts } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    // Only create requirements.md, leave others missing
    await fs.writeFile(path.join(featuresDir, "requirements.md"), "# Reqs\n\nContent.");

    const result = await warnIncompleteArtifacts({
      commandName: "feature prompt",
      featureId: "001-test",
      rootPath: tmpDir,
      noWarnings: false,
    });

    expect(result).not.toBeNull();
    expect(result!.warningId).toBe("incomplete-artifacts");
    expect(result!.canSnooze).toBe(true);
  });

  it("should not warn when all artifacts exist for feature prompt", async () => {
    const { warnIncompleteArtifacts } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    // Create all required artifacts with content
    const artifacts = ["requirements.md", "roadmap.md", "actions.md", "test-plan.md"];
    for (const art of artifacts) {
      await fs.writeFile(path.join(featuresDir, art), `# ${art}\n\nFull content here.`);
    }

    const result = await warnIncompleteArtifacts({
      commandName: "feature prompt",
      featureId: "001-test",
      rootPath: tmpDir,
      noWarnings: false,
    });

    expect(result).toBeNull();
  });

  it("should not warn for other command names", async () => {
    const { warnIncompleteArtifacts } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    const result = await warnIncompleteArtifacts({
      commandName: "feature new",
      rootPath: tmpDir,
      noWarnings: false,
    });

    expect(result).toBeNull();
  });

  // ── Warning 2: Low artifact completion (feature complete) ──

  it("should warn when less than 50% artifacts are filled", async () => {
    const { warnLowArtifactCompletion } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    // Only 1 of 7 artifacts filled
    await fs.writeFile(path.join(featuresDir, "requirements.md"), "# Reqs\n\n" + "x".repeat(100));

    const result = await warnLowArtifactCompletion({
      commandName: "feature complete",
      featureId: "001-test",
      rootPath: tmpDir,
      noWarnings: false,
    });

    expect(result).not.toBeNull();
    expect(result!.warningId).toBe("low-artifact-completion");
  });

  it("should not warn when >= 50% artifacts are filled", async () => {
    const { warnLowArtifactCompletion } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    // Fill 4 of 7 artifacts (57% — above 50% threshold)
    const filled = ["requirements.md", "roadmap.md", "actions.md", "test-plan.md"];
    for (const art of filled) {
      await fs.writeFile(path.join(featuresDir, art), "# Content\n\n" + "x".repeat(100));
    }

    const result = await warnLowArtifactCompletion({
      commandName: "feature complete",
      featureId: "001-test",
      rootPath: tmpDir,
      noWarnings: false,
    });

    expect(result).toBeNull();
  });

  // ── Warning 3: Brownfield without discover (feature new) ──

  it("should warn when features exist but no discovery dir for feature new", async () => {
    const { warnBrownfieldWithoutDiscover } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    const result = await warnBrownfieldWithoutDiscover({
      commandName: "feature new",
      rootPath: tmpDir,
      noWarnings: false,
    });

    // features dir exists (created in beforeEach), no discovery dir
    expect(result).not.toBeNull();
    expect(result!.warningId).toBe("brownfield-no-discover");
  });

  it("should not warn when discovery dir exists", async () => {
    const { warnBrownfieldWithoutDiscover } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    // Create discovery dir
    await fs.mkdir(path.join(tmpDir, "_devflow", "discovery"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "_devflow", "discovery", "architecture.md"),
      "# Architecture\n\nContent.",
    );

    const result = await warnBrownfieldWithoutDiscover({
      commandName: "feature new",
      rootPath: tmpDir,
      noWarnings: false,
    });

    expect(result).toBeNull();
  });

  // ── Warning 4: Gatekeep without adversarial review ──

  it("should warn when gatekeeping without adversarial review", async () => {
    const { warnGatekeepWithoutAdversarial } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    const result = await warnGatekeepWithoutAdversarial({
      commandName: "gatekeep",
      featureId: "001-test",
      rootPath: tmpDir,
      noWarnings: false,
    });

    expect(result).not.toBeNull();
    expect(result!.warningId).toBe("gatekeep-no-adversarial");
  });

  it("should not warn when adversarial review exists", async () => {
    const { warnGatekeepWithoutAdversarial } = await import(
      "../../src/kernel/hooks/warnings.js"
    );

    // Create adversarial review report
    const auditDir = path.join(tmpDir, ".devflow", "audits", "001-test");
    await fs.mkdir(auditDir, { recursive: true });
    await fs.writeFile(
      path.join(auditDir, "adversarial-review.md"),
      "# Adversarial Review\n\nPASS - All 12 vectors survived.\n",
    );

    const result = await warnGatekeepWithoutAdversarial({
      commandName: "gatekeep",
      featureId: "001-test",
      rootPath: tmpDir,
      noWarnings: false,
    });

    expect(result).toBeNull();
  });

  // ── noWarnings flag ──

  it("should skip all warnings when noWarnings is true", async () => {
    const { executePreCommandHooks } = await import(
      "../../src/kernel/hooks/pre-command.js"
    );

    const result = await executePreCommandHooks({
      commandName: "feature prompt",
      featureId: "001-test",
      rootPath: tmpDir,
      noWarnings: true,
    });

    expect(result).toEqual([]);
  });

  // ── Health summary ──

  it("should compute health summary correctly", async () => {
    const { computeHealthSummary } = await import(
      "../../src/kernel/hooks/pre-command.js"
    );

    // Fill 3 artifacts with good content
    await fs.writeFile(
      path.join(featuresDir, "requirements.md"),
      "# Reqs\n\n" + "x".repeat(100),
    );
    await fs.writeFile(
      path.join(featuresDir, "roadmap.md"),
      "# Roadmap\n\n" + "x".repeat(100),
    );
    await fs.writeFile(
      path.join(featuresDir, "test-plan.md"),
      "# Test Plan\n\n" + "x".repeat(100),
    );

    const summary = await computeHealthSummary(featuresDir);

    expect(summary.total).toBe(7);
    expect(summary.passed).toBe(3);
    expect(summary.items.filter((i) => i.passed).length).toBe(3);
  });
});
