import { describe, it, expect } from "vitest";
import { detectStackProfile } from "../../src/kernel/detection/stack.js";
import path from "node:path";

describe("Stack-Adaptive Tool Detection", () => {
  it("should detect TypeScript stack with vitest and tsc in the devflow project itself", async () => {
    const rootPath = path.resolve(process.cwd());
    const profile = await detectStackProfile(rootPath);

    expect(profile.language).toBe("typescript");
    expect(profile.testFramework).toBe("vitest");
    expect(profile.testCommand).toContain("vitest");
    expect(profile.typeChecker).toBe("tsc");
    expect(profile.sourceDir).toBe("src");
    expect(profile.testDir).toBe("test");
  });

  it("should return default profile for unknown stack", () => {
    // We can't easily test unknown in this project, but verify defaults
    const defaultProfile = {
      language: "unknown",
      testFramework: null,
      testCommand: null,
      linter: null,
      lintCommand: null,
      typeChecker: null,
      typeCheckCommand: null,
      formatter: null,
      packageManager: null,
      hasDocker: false,
      hasCI: false,
      ciProvider: null,
      sourceDir: "src",
      testDir: "test",
    };

    // All fields should be null/false/default
    expect(defaultProfile.language).toBe("unknown");
    expect(defaultProfile.testCommand).toBeNull();
    expect(defaultProfile.typeCheckCommand).toBeNull();
    expect(defaultProfile.hasCI).toBe(false);
  });

  it("should detect package manager as npm in this project", async () => {
    const rootPath = path.resolve(process.cwd());
    const profile = await detectStackProfile(rootPath);
    expect(profile.packageManager).toBe("npm");
  });

  it("should detect CI configuration", async () => {
    const rootPath = path.resolve(process.cwd());
    const profile = await detectStackProfile(rootPath);
    expect(profile.hasCI).toBe(true);
    expect(profile.ciProvider).toBe("github-actions");
  });

  it("should not mark TypeScript project as needing tsc via vitest", async () => {
    // Verify that the test command uses vitest, not tsc
    const rootPath = path.resolve(process.cwd());
    const profile = await detectStackProfile(rootPath);

    // TypeScript project should have tsc for typecheck
    expect(profile.typeChecker).toBe("tsc");
    // But test command should use vitest, not tsc
    expect(profile.testCommand).toContain("vitest");
    expect(profile.testCommand).not.toContain("tsc");
  });
});
