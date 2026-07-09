import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFile = vi.hoisted(() => vi.fn());
vi.mock("node:fs/promises", () => ({
  default: { readFile: mockReadFile, readdir: vi.fn().mockResolvedValue([]), stat: vi.fn().mockResolvedValue({ isFile: () => true }) },
  readFile: mockReadFile,
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ isFile: () => true }),
}));
const mockExecSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execSync: mockExecSync }));
import { runArchaeologist } from "../../../src/kernel/discovery/archaeologist.js";

const STACK: any = {
  language: "typescript", packageManager: "npm", sourceDir: "src",
  testDir: "test", testFramework: "vitest", linter: null, formatter: null,
  hasDocker: false, hasCI: false, ciProvider: null,
  typeCheckCommand: null, lintCommand: null, testCommand: null, typeChecker: null,
};

describe("Discovery Archaeologist", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("runArchaeologist returns a complete report", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/index.ts\n";
      if (cmd.includes("interface")) return "src/models.ts: export interface User { }\n";
      if (cmd.includes("type") && !cmd.includes("interface")) return "src/config.ts: export type Config = {}\n";
      if (cmd.includes("class")) return "src/service.ts: export class Service { }\n";
      if (cmd.includes("enum")) return "src/status.ts: export enum Status { }\n";
      return "5\n";
    });
    mockReadFile.mockResolvedValue("const x = 1;");
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report).toHaveProperty("complexFiles");
    expect(report).toHaveProperty("controlFlow");
    expect(report).toHaveProperty("dataStructures");
    expect(report).toHaveProperty("markdown");
  });

  it("report markdown contains all major sections", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/index.ts\n";
      return "0\n";
    });
    mockReadFile.mockResolvedValue("const x = 1;");
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.markdown).toContain("Archaeology Report");
    expect(report.markdown).toContain("Control Flow Overview");
    expect(report.markdown).toContain("Cyclomatic Complexity Hotspots");
    expect(report.markdown).toContain("Data Structures");
  });

  it("identifies files with high cyclomatic complexity", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/hot.ts\n";
      return "0\n";
    });
    mockReadFile.mockResolvedValue(Array.from({ length: 12 }, (_, i) => `if (${i}) {}`).join("\n"));
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.complexFiles.length).toBe(1);
    expect(report.complexFiles[0].file).toBe("src/hot.ts");
  });

  it("categorizes complexity levels correctly", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/high.ts\nsrc/med.ts\nsrc/mod.ts\n";
      return "0\n";
    });
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("high.ts")) return Array.from({ length: 31 }, (_, i) => `if (${i}) {}`).join("\n");
      if (fp.endsWith("med.ts")) return Array.from({ length: 22 }, (_, i) => `if (${i}) {}`).join("\n");
      if (fp.endsWith("mod.ts")) return Array.from({ length: 12 }, (_, i) => `if (${i}) {}`).join("\n");
      return "";
    });
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.complexFiles).toHaveLength(3);
    expect(report.complexFiles.find((f) => f.file.endsWith("high.ts"))?.description).toContain("High complexity");
    expect(report.complexFiles.find((f) => f.file.endsWith("med.ts"))?.description).toContain("Moderate-high");
    expect(report.complexFiles.find((f) => f.file.endsWith("mod.ts"))?.description).toContain("Moderate");
  });

  it("returns empty complexFiles when complexity does not exceed threshold", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/simple.ts\n";
      return "0\n";
    });
    mockReadFile.mockResolvedValue("const x = 1;");
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.complexFiles).toHaveLength(0);
  });

  it("skips files with content larger than 100K", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/huge.ts\nsrc/small.ts\n";
      return "0\n";
    });
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("huge.ts")) return "x".repeat(100001);
      return "const x = 1;";
    });
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.complexFiles).toHaveLength(0);
  });

  it("control flow counts construct types", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/index.ts\n";
      return "5\n";
    });
    mockReadFile.mockResolvedValue("const x = 1;");
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.controlFlow.conditionals).toBeGreaterThan(0);
    expect(report.controlFlow.switches).toBeGreaterThan(0);
    expect(report.controlFlow.tryCatch).toBeGreaterThan(0);
    expect(report.controlFlow.loops).toBeGreaterThan(0);
  });

  it("extracts TypeScript data structures", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/models.ts\n";
      if (cmd.includes("interface")) return "src/models.ts: export interface User { }\nsrc/models.ts: export interface Post { }\n";
      if (cmd.includes("type") && !cmd.includes("interface")) return "src/config.ts: export type Config = {}\n";
      if (cmd.includes("class")) return "src/service.ts: export class Service { }\n";
      if (cmd.includes("enum")) return "src/status.ts: export enum Status { }\n";
      return "0\n";
    });
    mockReadFile.mockResolvedValue("const x = 1;");
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.dataStructures.interfaces).toBe(2);
    expect(report.dataStructures.types).toBe(1);
    expect(report.dataStructures.classes).toBe(1);
    expect(report.dataStructures.enums).toBe(1);
    expect(report.dataStructures.records).toHaveLength(5);
  });

  it("handles non-TypeScript with generic class detection", async () => {
    const pyStack = { ...STACK, language: "python" };
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/main.py\n";
      if (cmd.includes("class")) return "src/models.py: class User(Base):\n";
      return "0\n";
    });
    const report = await runArchaeologist("/fake/project", pyStack);
    expect(report.dataStructures.classes).toBe(1);
    expect(report.dataStructures.records[0].kind).toBe("class");
  });

  it("handles unsupported language gracefully", async () => {
    const report = await runArchaeologist("/fake/project", { ...STACK, language: "cobol" });
    expect(report.complexFiles).toHaveLength(0);
    expect(report.controlFlow.conditionals).toBe(0);
  });

  it("handles execSync errors gracefully", async () => {
    mockExecSync.mockImplementation(() => { throw new Error("err"); });
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.complexFiles).toHaveLength(0);
    expect(report.markdown).toBeTruthy();
  });

  it("handles readFile ENOENT gracefully", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/index.ts\n";
      return "0\n";
    });
    mockReadFile.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.complexFiles).toHaveLength(0);
  });

  it("sorts complex files by score descending, limits to 20", async () => {
    const fileList = Array.from({ length: 25 }, (_, i) => `src/file${i}.ts`).join("\n") + "\n";
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return fileList;
      return "0\n";
    });
    mockReadFile.mockImplementation((fp: string) => {
      const m = fp.match(/file(\d+)\.ts$/);
      const n = m ? parseInt(m[1], 10) : 0;
      return Array.from({ length: n + 12 }, (_, i) => `if (${i}) {}`).join("\n");
    });
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.complexFiles.length).toBeLessThanOrEqual(20);
    for (let i = 1; i < report.complexFiles.length; i++) {
      expect(report.complexFiles[i].score).toBeLessThanOrEqual(report.complexFiles[i - 1].score);
    }
  });

  it("markdown shows no files exceed threshold when none complex", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/simple.ts\n";
      return "0\n";
    });
    mockReadFile.mockResolvedValue("const x = 1;");
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.markdown).toContain("No files exceed moderate complexity thresholds");
  });

  it("markdown shows detailed definitions table", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/models.ts\n";
      if (cmd.includes("interface")) return "src/models.ts: export interface User { }\n";
      return "0\n";
    });
    mockReadFile.mockResolvedValue("const x = 1;");
    const report = await runArchaeologist("/fake/project", STACK);
    expect(report.markdown).toContain("Detailed Definitions");
    expect(report.markdown).toContain("interface");
  });
});
