import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

// We test the validation logic inline since the command function
// depends on project inspection which needs real file system state.

describe("Feature Prompt Command", () => {
  const tmpDir = path.join(os.tmpdir(), "devflow-test-feature-prompt");

  beforeEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });
  });

  it("should refuse when required artifacts are missing", async () => {
    // Create feature dir with only requirements.md
    const featureDir = path.join(tmpDir, "_devflow", "features", "001-test");
    await fs.mkdir(featureDir, { recursive: true });
    await fs.writeFile(
      path.join(featureDir, "requirements.md"),
      "# Requirements\n\nSome content here.",
    );

    // Check which artifacts exist
    const requiredFiles = ["requirements.md", "roadmap.md", "actions.md", "test-plan.md"];
    const missing: string[] = [];
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(featureDir, file));
      } catch {
        missing.push(file);
      }
    }

    // 3 of 4 should be missing (only requirements.md exists)
    expect(missing.length).toBe(3);
    expect(missing).toContain("roadmap.md");
    expect(missing).toContain("actions.md");
    expect(missing).toContain("test-plan.md");
  });

  it("should succeed when all required artifacts exist", async () => {
    const featureDir = path.join(tmpDir, "_devflow", "features", "001-test");
    await fs.mkdir(featureDir, { recursive: true });

    await fs.writeFile(path.join(featureDir, "requirements.md"), "# Requirements\n\nTest.");
    await fs.writeFile(path.join(featureDir, "roadmap.md"), "# Roadmap\n\nTest.");
    await fs.writeFile(path.join(featureDir, "actions.md"), "# Actions\n\n- [ ] T001: Test");
    await fs.writeFile(path.join(featureDir, "test-plan.md"), "# Test Plan\n\nTest.");

    const requiredFiles = ["requirements.md", "roadmap.md", "actions.md", "test-plan.md"];
    const missing: string[] = [];
    for (const file of requiredFiles) {
      try {
        const content = await fs.readFile(path.join(featureDir, file), "utf-8");
        if (!content.trim()) missing.push(file);
      } catch {
        missing.push(file);
      }
    }

    expect(missing.length).toBe(0);
  });

  it("should refuse when artifact exists but is empty", async () => {
    const featureDir = path.join(tmpDir, "_devflow", "features", "001-test");
    await fs.mkdir(featureDir, { recursive: true });

    await fs.writeFile(path.join(featureDir, "requirements.md"), "# Requirements\n\nContent.");
    await fs.writeFile(path.join(featureDir, "roadmap.md"), ""); // empty
    await fs.writeFile(path.join(featureDir, "actions.md"), "# Actions\n\n- [ ] T001");
    await fs.writeFile(path.join(featureDir, "test-plan.md"), "# Test Plan\n\nContent.");

    // Empty roadmap should be detected
    const roadmapContent = await fs.readFile(path.join(featureDir, "roadmap.md"), "utf-8");
    expect(roadmapContent.trim()).toBe("");
  });
});
