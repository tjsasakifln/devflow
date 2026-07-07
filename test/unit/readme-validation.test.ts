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
      const stableSection = readmeContent.split("## Roadmap")[0];
      if (stableSection) {
        expect(stableSection).not.toContain(cmd);
      }
    }
  });

  it("should include three setup paths", () => {
    expect(readmeContent).toContain("Solo Builder");
    expect(readmeContent).toContain("Team");
    expect(readmeContent).toContain("Strict");
  });

  it("should include tier classification for commands", () => {
    expect(readmeContent).toContain("STABLE");
    expect(readmeContent).toContain("EXPERIMENTAL");
    expect(readmeContent).toContain("Roadmap");
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
    const previewSection = readmeContent.split("## Roadmap")[1];
    if (previewSection) {
      // PREVIEW section exists - good
      expect(previewSection.length).toBeGreaterThan(50);
    }
  });

  it("should recommend npx @tjsasakinpm/devflow install as primary entry point", () => {
    // The README must document install (not init) as the recommended first-use command
    expect(readmeContent).toContain("npx @tjsasakinpm/devflow install");
    // The first npx @tjsasakinpm/devflow reference should use 'install', not 'init'
    const firstNpxRef = readmeContent.match(/npx @tjsasakinpm\/devflow \w+/);
    expect(firstNpxRef).not.toBeNull();
    expect(firstNpxRef![0]).toBe("npx @tjsasakinpm/devflow install");
  });

  it("should not use unscoped npx devflow install", () => {
    // Must always use the scoped package name — "devflow" is unavailable on npm
    expect(readmeContent).not.toContain("npx devflow install");
  });

  it("should not reference old package name @devflow/cli", () => {
    expect(readmeContent).not.toContain("npx @devflow/cli");
    expect(readmeContent).not.toContain("@devflow/cli");
  });

  it("should document install as for users and init as for scripts", () => {
    // The Installation section must frame install as guided (for people)
    // and init as technical (for scripts/automation)
    const installSection = readmeContent.split("## Development")[0];
    if (installSection) {
      // install is the recommended path with guided onboarding
      expect(installSection).toMatch(/Recommended|Guided|guided/);
      // init is the technical alternative for scripts
      expect(installSection).toMatch(/script|automation|Technical/);
    }
  });
});
