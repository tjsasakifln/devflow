import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("README.md Validation", () => {
  const readmePath = path.resolve(process.cwd(), "README.md");
  let readmeContent = "";

  // Read README once
  beforeAll(() => {
    readmeContent = fs.readFileSync(readmePath, "utf-8");
  });

  it("should exist and have content", () => {
    expect(readmeContent.length).toBeGreaterThan(100);
  });

  it("should list all stable commands", () => {
    const stableCommands = [
      "init",
      "status",
      "next",
      "feature new",
      "feature complete",
      "feature prompt",
      "gatekeep",
      "adversarial-review",
      "doctor",
      "update-cockpit",
      "index",
    ];

    for (const cmd of stableCommands) {
      expect(readmeContent).toContain(cmd);
    }
  });

  it("should not reference non-existent commands as stable", () => {
    // These should NOT appear as stable/implemented commands
    const nonExistentCommands = [
      "devflow deploy",
      "devflow release",
      "devflow migrate",
    ];

    for (const cmd of nonExistentCommands) {
      // They might appear in "what we don't do" sections but not as functional commands
      const stableSection = readmeContent.split("### PREVIEW")[0];
      if (stableSection) {
        expect(stableSection).not.toContain(cmd);
      }
    }
  });

  it("should include three first-use paths", () => {
    expect(readmeContent).toContain("Greenfield");
    expect(readmeContent).toContain("Brownfield");
    expect(readmeContent).toContain("AI Agent");
  });

  it("should include tier classification for commands", () => {
    expect(readmeContent).toContain("STABLE");
    expect(readmeContent).toContain("EXPERIMENTAL");
    expect(readmeContent).toContain("PREVIEW");
  });

  it("should document install command or installation method", () => {
    expect(readmeContent).toMatch(/install|npx|npm install -g/);
  });

  it("should mention feature prompt command", () => {
    expect(readmeContent).toContain("feature prompt");
  });

  it("should list the discovery command", () => {
    expect(readmeContent).toContain("discover");
  });

  it("should not claim unimplemented features as working", () => {
    // PREVIEW commands should be labeled as PREVIEW
    const previewSection = readmeContent.split("### PREVIEW")[1];
    if (previewSection) {
      // PREVIEW section exists - good
      expect(previewSection.length).toBeGreaterThan(50);
    }
  });
});
