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
    // The README must document install (not init) as the recommended first-use command.
    // This appears in the "Try without installing" section as npx -y @tjsasakinpm/devflow@latest install
    expect(readmeContent).toMatch(/npx.*@tjsasakinpm\/devflow.*install/);
    // Must also show the preferred path: local install as devDependency
    expect(readmeContent).toContain("npm install --save-dev @tjsasakinpm/devflow");
  });

  it("should not use unscoped npx devflow install as the sole install method", () => {
    // "npx devflow install" without the scoped package would fail because
    // "devflow" doesn't exist on npm. It is only valid AFTER local install
    // (npm install --save-dev @tjsasakinpm/devflow), where npx resolves
    // the local binary. Verify the README teaches local install first.
    const localInstall = readmeContent.indexOf("npm install --save-dev @tjsasakinpm/devflow");
    const firstNpxDevflow = readmeContent.indexOf("npx devflow install");
    // If "npx devflow install" appears, it must be AFTER the local install instruction
    if (firstNpxDevflow > 0) {
      expect(localInstall).toBeGreaterThan(0);
      expect(localInstall).toBeLessThan(firstNpxDevflow);
    }
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

  it("should not show bare devflow command after remote npx invocation without intermediate install", () => {
    // In the "Try without installing" section, every command after the
    // initial npx -y @tjsasakinpm/devflow@latest install MUST use the full
    // npx -y @tjsasakinpm/devflow@latest prefix, NOT bare `devflow`.
    const trySection = readmeContent.match(/Try without installing[\s\S]*?(?=### |\[Full)/);
    if (trySection) {
      // After the install line, there should be no bare `devflow ` commands
      const linesAfterInstall = trySection[0].split("\n");
      const installIdx = linesAfterInstall.findIndex(
        (l: string) => l.includes("install") && l.includes("@tjsasakinpm/devflow"),
      );
      if (installIdx >= 0) {
        const afterInstall = linesAfterInstall.slice(installIdx + 1).join("\n");
        // Lines starting with `devflow ` (bare command) should not appear
        // unless prefixed with npx
        const bareDevflowLines = afterInstall
          .split("\n")
          .filter((l: string) => /^\s*devflow\s+\w+/.test(l.trim()));
        expect(bareDevflowLines).toHaveLength(0);
      }
    }
  });

  it("should recommend local install as devDependency as the primary method", () => {
    // Local install should appear before the "Try without installing" section
    const localIdx = readmeContent.indexOf("npm install --save-dev @tjsasakinpm/devflow");
    const tryIdx = readmeContent.indexOf("Try without installing");
    expect(localIdx).toBeGreaterThan(0);
    expect(tryIdx).toBeGreaterThan(0);
    expect(localIdx).toBeLessThan(tryIdx);
  });
});
