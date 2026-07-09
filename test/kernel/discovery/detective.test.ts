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
import { runDetective } from "../../../src/kernel/discovery/detective.js";

const STACK: any = {
  language: "typescript", packageManager: "npm", sourceDir: "src",
  testDir: "test", testFramework: "vitest", linter: null, formatter: null,
  hasDocker: false, hasCI: false, ciProvider: null,
  typeCheckCommand: null, lintCommand: null, testCommand: null, typeChecker: null,
};

describe("Discovery Detective", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("runDetective returns a complete report", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("validate")) return "src/v.ts: validateInput(data)\n";
      if (cmd.includes("guard") || cmd.includes("can[A-Z]")) return "src/a.ts: guard()\n";
      if (cmd.includes("assert") || cmd.includes("expect")) return "src/t.ts: assert(x)\n";
      if (cmd.includes("hasRole") || cmd.includes("hasPermission")) return "src/a.ts: hasRole()\n";
      if (cmd.includes("rateLimit") || cmd.includes("throttle")) return "\n";
      if (cmd.includes("MIN_") || cmd.includes("MAX_") || cmd.includes("LIMIT_")) return "\n";
      if (cmd.includes("STATUS_") || cmd.includes("STATE_")) return "\n";
      if (cmd.includes("ERROR_") || cmd.includes("ERR_")) return "\n";
      if (cmd.includes("git log")) return "2026-06-15|dev|feat: GraphQL\n2026-06-10|dev|fix: timeout\n";
      if (cmd.includes("switch")) return "src/order.ts\n";
      if (cmd.includes("PENDING") || cmd.includes("DRAFT") || cmd.includes("OPEN") || cmd.includes("CREATED")) return "\n";
      return "\n";
    });
    mockReadFile.mockResolvedValue("switch (orderState) { case PENDING: case ACTIVE: }");
    const report = await runDetective("/fake/project", STACK);
    expect(report).toHaveProperty("businessRules");
    expect(report).toHaveProperty("adrs");
    expect(report).toHaveProperty("stateMachines");
    expect(report).toHaveProperty("markdown");
  });

  it("report markdown contains all major sections", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("git log")) return "2026-06-15|dev|feat\n";
      return "src/x.ts: code\n";
    });
    const report = await runDetective("/fake/project", STACK);
    expect(report.markdown).toContain("Detective Report");
    expect(report.markdown).toContain("Business Rules Detected");
    expect(report.markdown).toContain("Retroactive ADRs");
    expect(report.markdown).toContain("State Machines Detected");
  });

  it("extracts business rules from code patterns", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("validate")) return "src/v.ts: validate()\n";
      return "\n";
    });
    const report = await runDetective("/fake/project", STACK);
    expect(report.businessRules.length).toBeGreaterThan(0);
    expect(report.businessRules.some((r) => r.pattern === "Validation Rules")).toBe(true);
  });

  it("includes project-specific business patterns", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("validate")||cmd.includes("guard")||cmd.includes("assert")||cmd.includes("hasRole")||cmd.includes("rateLimit")) return "\n";
      if (cmd.includes("MIN_")||cmd.includes("MAX_")||cmd.includes("LIMIT_")) return "src/config.ts: const MAX_RETRIES = 3\n";
      if (cmd.includes("STATUS_")||cmd.includes("STATE_")) return "\n";
      if (cmd.includes("ERROR_")||cmd.includes("ERR_")) return "\n";
      return "\n";
    });
    const report = await runDetective("/fake/project", STACK);
    expect(report.businessRules.find((r) => r.pattern === "Business Rules")).toBeDefined();
  });

  it("limits examples to 8 per rule", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("validate")) return Array.from({length:20},(_,i)=>"src/f"+i+".ts: v()").join("\n")+"\n";
      return "\n";
    });
    const report = await runDetective("/fake/project", STACK);
    const vr = report.businessRules.find((r) => r.pattern === "Validation Rules");
    expect(vr?.examples.length).toBeLessThanOrEqual(8);
  });

  it("extracts ADRs from git log with decision keywords", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("git log")) return "2026-06-15|alice|feat: migrate to GraphQL\n2026-06-10|bob|fix: timeout\n";
      return "\n";
    });
    const report = await runDetective("/fake/project", STACK);
    expect(report.adrs.some((a) => a.type === "architectural-decision")).toBe(true);
    expect(report.adrs.some((a) => a.author === "alice")).toBe(true);
  });

  it("classifies commits by type", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("git log")) return "2026-06-15|dev|fix: crash\n2026-06-10|dev|feat: dashboard\n2026-06-05|dev|docs: readme\n";
      return "\n";
    });
    const report = await runDetective("/fake/project", STACK);
    expect(report.adrs.some((a) => a.type === "fix")).toBe(true);
    expect(report.adrs.some((a) => a.type === "feature")).toBe(true);
    expect(report.adrs.some((a) => a.type === "other")).toBe(true);
  });

  it("limits ADRs to 30 entries", async () => {
    const many = Array.from({length:50},(_,i)=>"2026-06-"+((i%30)+1)+"|dev|c"+i).join("\n")+"\n";
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("git log")) return many;
      return "\n";
    });
    const report = await runDetective("/fake/project", STACK);
    expect(report.adrs.length).toBeLessThanOrEqual(30);
  });

  it("detects state machines from switch/case blocks", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("switch")) return "src/workflow.ts\n";
      return "\n";
    });
    mockReadFile.mockImplementation((fp: string) => {
      if (fp.endsWith("workflow.ts")) return "switch (requestState) { case STATE_PENDING: case STATE_ACTIVE: }";
      throw Object.assign(new Error(), { code: "ENOENT" });
    });
    const report = await runDetective("/fake/project", STACK);
    expect(report.stateMachines.length).toBeGreaterThan(0);
  });

  it("detects enum-based state definitions", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("switch")) return "\n";
      if (cmd.includes("PENDING")) return "src/status.ts: enum Status { PENDING, ACTIVE }\n";
      return "\n";
    });
    const report = await runDetective("/fake/project", STACK);
    expect(report.stateMachines.length).toBeGreaterThan(0);
    expect(report.stateMachines.some((sm) => sm.states.includes("PENDING"))).toBe(true);
  });

  it("handles non-TypeScript languages", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("validate")) return "src/v.py: validate()\n";
      return "\n";
    });
    const report = await runDetective("/fake/project", { ...STACK, language: "python" });
    expect(report.businessRules.length).toBeGreaterThan(0);
  });

  it("handles execSync errors", async () => {
    mockExecSync.mockImplementation(() => { throw new Error("err"); });
    const report = await runDetective("/fake/project", STACK);
    expect(report.businessRules).toHaveLength(0);
    expect(report.adrs).toHaveLength(0);
    expect(report.stateMachines).toHaveLength(0);
  });

  it("handles empty git log", async () => {
    mockExecSync.mockReturnValue("\n");
    const report = await runDetective("/fake/project", STACK);
    expect(report.adrs).toHaveLength(0);
    expect(report.markdown).toContain("No git history available");
  });

  it("handles unsupported language", async () => {
    const report = await runDetective("/fake/project", { ...STACK, language: "cobol" });
    expect(report.businessRules).toHaveLength(0);
    expect(report.stateMachines).toHaveLength(0);
  });

  it("markdown shows no business rules message", async () => {
    mockExecSync.mockReturnValue("\n");
    const report = await runDetective("/fake/project", STACK);
    expect(report.markdown).toContain("No business rule patterns detected");
  });

  it("markdown includes commit profile with type counts", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("git log")) return "2026-06-15|alice|feat: one\n2026-06-14|bob|feat: two\n2026-06-13|alice|fix: bug\n";
      return "src/x.ts: code\n";
    });
    const report = await runDetective("/fake/project", STACK);
    expect(report.markdown).toContain("Recent Commit Profile");
    expect(report.markdown).toContain("feature");
  });
});
