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

const mockExtractSchema = vi.hoisted(() => vi.fn());
vi.mock("../../../src/kernel/discovery/schema-extractor.js", () => ({ extractSchema: mockExtractSchema }));

import { runArchitect } from "../../../src/kernel/discovery/architect.js";

const STACK: any = {
  language: "typescript", packageManager: "npm", sourceDir: "src",
  testDir: "test", testFramework: "vitest", linter: null, formatter: null,
  hasDocker: false, hasCI: false, ciProvider: null,
  typeCheckCommand: null, lintCommand: null, testCommand: null, typeChecker: null,
};

const PKG_EMPTY = JSON.stringify({ name: "p", dependencies: {}, devDependencies: {} });
const PKG_DEPS = JSON.stringify({ name: "p", dependencies: { express: "^4", axios: "^1", prisma: "^5" } });

describe("Discovery Architect", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("runArchitect returns report and schemaReport", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/index.ts\n";
      return "\n";
    });
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return PKG_EMPTY;
      return "export const a = 1;";
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r).toHaveProperty("report");
    expect(r).toHaveProperty("schemaReport");
    expect(r.report).toHaveProperty("c4ContextDiagram");
    expect(r.report).toHaveProperty("c4ContainerDiagram");
    expect(r.report).toHaveProperty("integrations");
    expect(r.report).toHaveProperty("modules");
    expect(r.report).toHaveProperty("markdown");
  });

  it("report markdown contains all major sections", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/index.ts\n";
      return "\n";
    });
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return PKG_EMPTY;
      return "export const a = 1;";
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.markdown).toContain("Architecture Report");
    expect(r.report.markdown).toContain("C4 Context Diagram");
    expect(r.report.markdown).toContain("C4 Container Diagram");
    expect(r.report.markdown).toContain("Integration Map");
    expect(r.report.markdown).toContain("Module Overview");
  });

  it("extracts module structure with imports and exports", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/index.ts\nsrc/cli.ts\n";
      return "\n";
    });
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return PKG_EMPTY;
      if (fp.endsWith("index.ts")) return 'import { run } from "./cli";\nexport const main = () => run();';
      if (fp.endsWith("cli.ts")) return 'export function execute() { return "ok"; }\nexport const VERSION = "1.0";';
      return "";
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.modules.length).toBeGreaterThan(0);
    const idx = r.report.modules.find((m) => m.name === "index");
    const cli = r.report.modules.find((m) => m.name === "cli");
    expect(idx).toBeDefined();
    expect(idx?.imports).toContain("./cli");
    expect(idx?.exportedItems).toContain("main");
    expect(cli).toBeDefined();
    expect(cli?.exportedItems).toContain("execute");
  });

  it("limits imports to 15 and exports to 10", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/large.ts\n";
      return "\n";
    });
    const imps = Array.from({length:25},(_,i)=>"import { x"+i+" } from './mod"+i+"';").join("\n");
    const exps = Array.from({length:15},(_,i)=>"export const y"+i+" = "+i+";").join("\n");
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return PKG_EMPTY;
      return imps + "\n" + exps;
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.modules).toHaveLength(1);
    expect(r.report.modules[0].imports.length).toBeLessThanOrEqual(15);
    expect(r.report.modules[0].exportedItems.length).toBeLessThanOrEqual(10);
  });

  it("detects integrations from package.json", async () => {
    mockExecSync.mockReturnValue("\n");
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return PKG_DEPS;
      throw Object.assign(new Error(), { code: "ENOENT" });
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.integrations.length).toBeGreaterThan(0);
    expect(r.report.integrations.some((i) => i.name === "REST API Client")).toBe(true);
    expect(r.report.integrations.some((i) => i.name === "Database ORM")).toBe(true);
  });

  it("detects external API URLs in source", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("https")) return "src/api.ts\n";
      return "\n";
    });
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return PKG_EMPTY;
      throw Object.assign(new Error(), { code: "ENOENT" });
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.integrations.find((i) => i.name.includes("URL"))).toBeDefined();
  });

  it("handles non-JS/TS language", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/main.py\n";
      return "\n";
    });
    const r = await runArchitect("/fake/project", { ...STACK, language: "python" });
    expect(r.report.modules.length).toBeGreaterThan(0);
    expect(r.report.modules[0].imports).toHaveLength(0);
  });

  it("includes ERD when schema extractor returns data", async () => {
    mockExecSync.mockReturnValue("\n");
    mockReadFile.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
    mockExtractSchema.mockResolvedValue({
      tables: [{ name: "User", columns: [{ name: "id", type:"string", key:"PK", nullable:false }], source:"prisma/schema.prisma" }],
      relationships: [],
      mermaidERD: "erDiagram\n    User {\n        string id PK\n    }",
    });
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.hasSchema).toBe(true);
    expect(r.report.erd).toContain("erDiagram");
    expect(r.schemaReport.schemaMarkdown).toContain("# SCHEMA.md");
  });

  it("handles null schema", async () => {
    mockExecSync.mockReturnValue("\n");
    mockReadFile.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.hasSchema).toBe(false);
    expect(r.report.erd).toBeNull();
    expect(r.schemaReport.schemaMarkdown).toContain("No database schema detected");
  });

  it("C4 context diagram includes external systems", async () => {
    mockExecSync.mockReturnValue("\n");
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return PKG_DEPS;
      throw Object.assign(new Error(), { code: "ENOENT" });
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.c4ContextDiagram).toContain("C4Context");
    expect(r.report.c4ContextDiagram).toContain("System_Ext");
  });

  it("C4 container diagram categorizes modules", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/index.ts\nsrc/utils/h.ts\n";
      return "\n";
    });
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return PKG_EMPTY;
      return "export const a = 1;";
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.c4ContainerDiagram).toContain("C4Container");
    expect(r.report.c4ContainerDiagram).toContain("Container");
  });

  it("handles execSync errors gracefully", async () => {
    mockExecSync.mockImplementation(() => { throw new Error("err"); });
    mockReadFile.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.modules).toHaveLength(0);
    expect(r.report.integrations).toHaveLength(0);
  });

  it("handles missing package.json", async () => {
    mockExecSync.mockReturnValue("\n");
    mockReadFile.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.integrations).toHaveLength(0);
  });

  it("handles malformed package.json", async () => {
    mockExecSync.mockReturnValue("\n");
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return "not-json{{";
      throw Object.assign(new Error(), { code: "ENOENT" });
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.integrations).toHaveLength(0);
  });

  it("markdown includes total modules count", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("find")) return "src/index.ts\nsrc/cli.ts\n";
      return "\n";
    });
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return PKG_EMPTY;
      return "export const a = 1;";
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.markdown).toContain("Total modules analyzed: 2");
  });

  it("markdown shows empty state when no modules", async () => {
    mockExecSync.mockReturnValue("\n");
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.markdown).toContain("No modules analyzed");
  });

  it("handles project with no integrations", async () => {
    mockExecSync.mockReturnValue("\n");
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("package.json")) return JSON.stringify({ name:"p", dependencies:{}, devDependencies:{} });
      throw Object.assign(new Error(), { code: "ENOENT" });
    });
    mockExtractSchema.mockResolvedValue(null);
    const r = await runArchitect("/fake/project", STACK);
    expect(r.report.integrations).toHaveLength(0);
    expect(r.report.markdown).toContain("No external integrations detected");
  });

  it("schemaReport builds proper markdown with tables", async () => {
    mockExecSync.mockReturnValue("\n");
    mockReadFile.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
    mockExtractSchema.mockResolvedValue({
      tables: [{ name:"User", columns:[
        { name:"id", type:"string", key:"PK", nullable:false },
        { name:"name", type:"string", key:"none", nullable:true }
      ], source:"prisma/schema.prisma" }],
      relationships: [],
      mermaidERD: "erDiagram\n    User {\n        string id PK\n        string name\n    }",
    });
    const r = await runArchitect("/fake/project", STACK);
    expect(r.schemaReport.schemaMarkdown).toContain("SCHEMA.md");
    expect(r.schemaReport.schemaMarkdown).toContain("erDiagram");
    expect(r.schemaReport.schemaMarkdown).toContain("PK");
  });
});
