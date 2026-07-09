/**
 * Quickstart Command Tests
 *
 * Tests the quickstart logic directly using vitest mocking,
 * without requiring the compiled dist/main.js.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies ──

vi.mock("../../src/kernel/utils/prompts.js", () => ({
  isInteractive: vi.fn(),
  selectOption: vi.fn(),
  confirmOrExit: vi.fn(),
}));

vi.mock("../../src/kernel/detection/stack.js", () => ({
  detectStackProfile: vi.fn(),
}));

vi.mock("../../src/kernel/utils/fs.js", () => ({
  fileExists: vi.fn(),
}));

// Import after mocks
import { isInteractive } from "../../src/kernel/utils/prompts.js";
import { detectStackProfile } from "../../src/kernel/detection/stack.js";
import { fileExists } from "../../src/kernel/utils/fs.js";
import { quickstartCommand } from "../../src/commands/quickstart.js";

describe("Quickstart Command — Non-interactive mode", () => {
  beforeEach(() => {
    vi.mocked(isInteractive).mockReturnValue(false);
    vi.mocked(detectStackProfile).mockResolvedValue({
      language: "typescript",
      testFramework: "vitest",
      testCommand: "npx vitest run",
      linter: "eslint",
      lintCommand: "npx eslint src/",
      typeChecker: "tsc",
      typeCheckCommand: "npx tsc --noEmit",
      formatter: "prettier",
      packageManager: "npm",
      hasDocker: false,
      hasCI: true,
      ciProvider: "github-actions",
      sourceDir: "src",
      testDir: "test",
    });
  });

  it("should show text guide with project detection for existing project", async () => {
    // fileExists called with various paths in parallel via Promise.all
    // Use mockImplementation to handle any call order
    vi.mocked(fileExists).mockImplementation(async (p: string) => {
      return p.includes("package.json") ||
        p.includes("tsconfig.json") ||
        p.includes(".devflow") ||
        p.includes(".git");
    });

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    await quickstartCommand("/some/project");

    // Should show the quickstart header
    expect(logs.some(l => l.includes("Quickstart"))).toBe(true);
    // Should show non-interactive mode message
    expect(logs.some(l => l.includes("Non-interactive"))).toBe(true);
    // Should show detected project type
    expect(logs.some(l => l.includes("Detected project type"))).toBe(true);
    // Should show language detection
    expect(logs.some(l => l.includes("Language"))).toBe(true);
    // Should show Devflow state
    expect(logs.some(l => l.includes("Devflow"))).toBe(true);
    // Should show recommended commands
    expect(logs.some(l => l.includes("Recommended commands"))).toBe(true);

    spy.mockRestore();
  });

  it("should recommend devflow install for new projects", async () => {
    // All fileExists calls return false → looks like a new empty project
    vi.mocked(fileExists).mockResolvedValue(false);

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    await quickstartCommand("/empty/project");

    expect(logs.some(l => l.includes("devflow install"))).toBe(true);
    expect(logs.some(l => l.includes("Recommended commands"))).toBe(true);

    spy.mockRestore();
  });

  it("should recommend devflow status for already-initialized projects", async () => {
    // .devflow/config.json exists → Devflow initialized
    vi.mocked(fileExists).mockImplementation(async (p: string) => {
      return p.includes("package.json") ||
        p.includes("tsconfig.json") ||
        p.includes(".devflow") ||
        p.includes(".git");
    });

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    await quickstartCommand("/some/project");

    expect(logs.some(l => l.includes("devflow status"))).toBe(true);

    spy.mockRestore();
  });

  it("should exit cleanly without errors", async () => {
    vi.mocked(fileExists).mockResolvedValue(true);

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(quickstartCommand("/test")).resolves.toBeUndefined();

    spy.mockRestore();
  });

  it("should not prompt user in non-interactive mode", async () => {
    vi.mocked(fileExists).mockResolvedValue(true);

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    await quickstartCommand("/test");

    // Should not contain clack prompt markers
    const allText = logs.join(" ");
    expect(allText).not.toMatch(/\? \[/);

    spy.mockRestore();
  });
});

describe("Quickstart Command — Module export", () => {
  it("should export quickstartCommand function", async () => {
    const quickstartModule = await import("../../src/commands/quickstart.js");
    expect(quickstartModule).toHaveProperty("quickstartCommand");
    expect(typeof quickstartModule.quickstartCommand).toBe("function");
  });
});
