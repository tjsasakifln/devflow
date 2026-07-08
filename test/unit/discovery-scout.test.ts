import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFile = vi.hoisted(() => vi.fn().mockResolvedValue(""));
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: mockReadFile,
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false, size: 100 }),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  readFile: mockReadFile,
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false, size: 100 }),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { runScout } from "../../src/kernel/discovery/scout.js";

describe("Discovery Scout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runScout returns a ScoutReport for a TypeScript project", async () => {
    const report = await runScout("/fake/project", {
      language: "typescript",
      packageManager: "npm",
      typeCheckCommand: "npx tsc --noEmit",
      lintCommand: "npx eslint src/",
      linter: "eslint",
      sourceDir: "src",
      testDir: "test",
      testFramework: "vitest",
      testCommand: "npx vitest run",
      typeChecker: "tsc",
      formatter: null as string | null,
      hasDocker: true,
      hasCI: true,
      ciProvider: "github-actions",
    });

    expect(report).toHaveProperty("markdown");
    expect(report.markdown).toContain("Scout Report");
  });

  it("runScout handles different stack configuration", async () => {
    const report = await runScout("/fake/project", {
      language: "javascript",
      packageManager: "pnpm",
      typeCheckCommand: null as string | null,
      lintCommand: null as string | null,
      linter: null as string | null,
      sourceDir: "lib",
      testDir: "spec",
      testFramework: "mocha",
      testCommand: "npx mocha",
      typeChecker: null as string | null,
      formatter: "prettier",
      hasDocker: false,
      hasCI: false,
      ciProvider: null as string | null,
    });

    expect(report.markdown).toContain("javascript");
    expect(report.markdown).toContain("prettier");
  });
});
