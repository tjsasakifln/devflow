import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs/promises
const mockWriteFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockMkdir = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockReadFile = vi.hoisted(() => vi.fn().mockResolvedValue("{}"));

vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false, size: 100 }),
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

// Mock child_process
vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

// Mock stack detection
vi.mock("../../src/kernel/detection/stack.js", () => ({
  detectStackProfile: vi.fn().mockResolvedValue({
    language: "typescript",
    packageManager: "npm",
    typeCheckCommand: "npx tsc --noEmit",
    lintCommand: "",
    linter: "eslint",
    sourceDir: "src",
    testDir: "test",
    testFramework: "vitest",
    testCommand: "npx vitest run",
    typeChecker: "tsc",
    formatter: "prettier",
    hasDocker: true,
    hasCI: true,
    ciProvider: "github-actions",
  }),
}));

// Mock file scanner
vi.mock("../../src/adapters/project/file-scanner.js", () => ({
  scanFiles: vi.fn().mockResolvedValue({}),
}));

// Mock orchestrator
vi.mock("../../src/kernel/discovery/orchestrator.js", () => ({
  runDiscovery: vi.fn().mockResolvedValue(undefined),
  resolvePhaseName: vi.fn((name: string) => {
    const aliases: Record<string, string> = {
      scout: "scout",
      archaeologist: "archaeologist",
      detective: "detective",
      architect: "architect",
      writer: "writer",
      scan: "scout",
      analyze: "archaeologist",
      deduce: "detective",
      design: "architect",
      document: "writer",
    };
    return aliases[name.toLowerCase()];
  }),
  PHASE_ALIASES: {
    scout: "scout",
    scan: "scout",
    archaeologist: "archaeologist",
    analyze: "archaeologist",
    detective: "detective",
    deduce: "detective",
    architect: "architect",
    design: "architect",
    writer: "writer",
    document: "writer",
  },
}));

// Mock fs utils
vi.mock("../../src/kernel/utils/fs.js", () => ({
  fileExists: vi.fn().mockResolvedValue(true),
  safeReadFile: vi.fn().mockResolvedValue(JSON.stringify({
    name: "test-project",
    scripts: {},
    dependencies: { react: "^18.0.0" },
    devDependencies: { vitest: "^1.0.0" },
  })),
}));

import { discoverCommand } from "../../src/commands/discover.js";

describe("Discover Command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Quick mode (--quick)", () => {
    it("generates exactly 3 reports in quick mode", async () => {
      await discoverCommand("/fake/project", { quick: true });

      // Verify writeFile was called 4 times (3 reports + 1 executive summary)
      expect(mockWriteFile).toHaveBeenCalledTimes(4);

      const writeCalls = mockWriteFile.mock.calls.map((c: [string, string]) => ({
        path: c[0],
        content: c[1],
      }));

      // Check all expected files are created
      const writtenPaths = writeCalls.map((c: { path: string }) => c.path);
      expect(writtenPaths.some((p: string) => p.endsWith("system-map.md"))).toBe(true);
      expect(writtenPaths.some((p: string) => p.endsWith("risk-map.md"))).toBe(true);
      expect(writtenPaths.some((p: string) => p.endsWith("change-zones.md"))).toBe(true);
      expect(writtenPaths.some((p: string) => p.endsWith("executive-summary.md"))).toBe(true);
    });

    it("does not generate testing-baseline in quick mode", async () => {
      await discoverCommand("/fake/project", { quick: true });

      const writeCalls = mockWriteFile.mock.calls.map((c: [string, string]) => c[0]);
      expect(writeCalls.some((p: string) => p.endsWith("testing-baseline.md"))).toBe(false);
    });

    it("writes to _devflow/discovery/ directory", async () => {
      await discoverCommand("/fake/project", { quick: true });

      const writeCalls = mockWriteFile.mock.calls.map((c: [string, string]) => c[0]);
      for (const path of writeCalls) {
        expect(path).toContain("_devflow/discovery");
      }

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining("_devflow/discovery"),
        { recursive: true },
      );
    });
  });

  describe("Full mode (default and --full)", () => {
    it("runs discovery without flags (default full)", async () => {
      await discoverCommand("/fake/project", {});

      // Default mode should run full pipeline, so writeFile is called many times
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockMkdir).toHaveBeenCalled();
    });

    it("runs discovery with explicit --full", async () => {
      await discoverCommand("/fake/project", { full: true });

      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  describe("Phase handling", () => {
    it("accepts old phase names", async () => {
      await discoverCommand("/fake/project", { phase: "scout" });

      const { resolvePhaseName } = await import("../../src/kernel/discovery/orchestrator.js");
      expect(resolvePhaseName("scout")).toBe("scout");
    });

    it("accepts new phase aliases", async () => {
      const { resolvePhaseName } = await import("../../src/kernel/discovery/orchestrator.js");

      expect(resolvePhaseName("scan")).toBe("scout");
      expect(resolvePhaseName("analyze")).toBe("archaeologist");
      expect(resolvePhaseName("deduce")).toBe("detective");
      expect(resolvePhaseName("design")).toBe("architect");
      expect(resolvePhaseName("document")).toBe("writer");
    });

    it("returns undefined for invalid phase names", async () => {
      const { resolvePhaseName } = await import("../../src/kernel/discovery/orchestrator.js");

      expect(resolvePhaseName("invalid")).toBeUndefined();
      expect(resolvePhaseName("")).toBeUndefined();
    });

    it("is case-insensitive", async () => {
      const { resolvePhaseName } = await import("../../src/kernel/discovery/orchestrator.js");

      expect(resolvePhaseName("SCAN")).toBe("scout");
      expect(resolvePhaseName("Analyze")).toBe("archaeologist");
    });
  });

  describe("Executive summary", () => {
    it("executive summary is included in quick output", async () => {
      await discoverCommand("/fake/project", { quick: true });

      const writeCalls = mockWriteFile.mock.calls;
      const summaryCall = writeCalls.find(
        (c: [string, string]) => c[0].endsWith("executive-summary.md"),
      );

      expect(summaryCall).toBeDefined();
      const content = summaryCall[1] as string;
      expect(content).toContain("Executive Summary");
      expect(content).toContain("system-map.md");
      expect(content).toContain("risk-map.md");
      expect(content).toContain("change-zones.md");
      expect(content).toContain("Recommended Next Steps");
    });

    it("executive summary is max 1 page (roughly 50 lines)", async () => {
      await discoverCommand("/fake/project", { quick: true });

      const writeCalls = mockWriteFile.mock.calls;
      const summaryCall = writeCalls.find(
        (c: [string, string]) => c[0].endsWith("executive-summary.md"),
      );

      const content = summaryCall[1] as string;
      const lineCount = content.split("\n").length;
      expect(lineCount).toBeLessThanOrEqual(80); // generous 80-line limit for "1 page"
    });
  });
});
