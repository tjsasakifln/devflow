import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { ParallelSpawner } from "../../src/kernel/orchestration/parallel-spawner.js";
import type { DimensionDef, AgentResult } from "../../src/kernel/orchestration/types.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFork = vi.hoisted(() => vi.fn());
const mockMkdir = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockWriteFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockReadFile = vi.hoisted(() =>
  vi.fn().mockResolvedValue(
    JSON.stringify({
      rootPath: "/test",
      dimension: "security",
      relevantFiles: ["src/auth/login.ts"],
      timeoutMs: 120000,
      runId: "test-run-1",
    }),
  ),
);
const mockReaddir = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockRm = vi.hoisted(() => vi.fn().mockImplementation((...args: unknown[]) => {
  // Support both callback and promise patterns for fs.rm
  const lastArg = args[args.length - 1];
  if (typeof lastArg === 'function') {
    (lastArg as Function)(null);
  }
  return Promise.resolve(undefined);
}));
const mockStat = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ isFile: () => true, size: 1000 }),
);

vi.mock("node:child_process", () => ({ fork: mockFork }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    readdir: mockReaddir,
    rm: mockRm,
    stat: mockStat,
  };
});
vi.mock("node:os", () => {
  const cpus = () => Array(8).fill({});
  return {
    default: { cpus, tmpdir: () => "/tmp" },
    cpus,
    tmpdir: () => "/tmp",
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock ChildProcess that emits close after a delay.
 * The emitter starts without a kill method — it's added manually.
 */
function createMockChildProcess(
  exitCode: number,
  stdoutData: string,
  delayMs: number = 10,
): ChildProcess {
  const emitter = new EventEmitter() as Record<string, unknown>;
  const stdout = new EventEmitter() as ChildProcess["stdout"];
  const stderr = new EventEmitter() as ChildProcess["stderr"];

  Object.defineProperty(emitter, "stdout", { value: stdout });
  Object.defineProperty(emitter, "stderr", { value: stderr });

  // Add kill method manually before spying (ChildProcess has kill)
  (emitter as any).kill = () => true;

  const killSpy = vi.spyOn(emitter as any, "kill").mockReturnValue(true);

  setTimeout(() => {
    stdout.emit("data", Buffer.from(stdoutData));
    setImmediate(() => {
      emitter.emit("close", exitCode, null);
    });
  }, delayMs);

  return emitter as unknown as ChildProcess;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SUCCESS_RESULT: AgentResult = {
  dimension: "security",
  findings: [
    { file: "src/auth/login.ts", line: 15, severity: "critical", message: "Hardcoded API key detected", dimension: "security" },
    { file: "src/auth/login.ts", line: 42, severity: "warning", message: "Missing rate limiting", dimension: "security" },
  ],
  durationMs: 100,
  exitCode: 0,
};

const EMPTY_RESULT: AgentResult = {
  dimension: "performance",
  findings: [],
  durationMs: 50,
  exitCode: 0,
};

const PERFORMANCE_DIMENSION: DimensionDef = {
  name: "performance",
  description: "Performance analysis",
  globPatterns: ["**/*.query*"],
};

const SECURITY_DIMENSION: DimensionDef = {
  name: "security",
  description: "Security analysis",
  globPatterns: ["**/auth/**"],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ParallelSpawner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a spawner instance", () => {
    const spawner = new ParallelSpawner("/test");
    expect(spawner).toBeInstanceOf(ParallelSpawner);
  });

  it("should return empty result for empty dimensions array", async () => {
    const spawner = new ParallelSpawner("/test");
    const result = await spawner.spawnAgents([]);

    expect(result.totalFindings).toBe(0);
    expect(result.durationMs).toBe(0);
    expect(result.agentResults).toEqual([]);
    expect(result.byDimension).toEqual({});
    expect(mockFork).not.toHaveBeenCalled();
  });

  it("should spawn agent and collect results", async () => {
    mockFork.mockImplementation(() =>
      createMockChildProcess(0, JSON.stringify(SUCCESS_RESULT)),
    );

    const spawner = new ParallelSpawner("/test");
    const result = await spawner.spawnAgents([SECURITY_DIMENSION], {
      maxParallel: 1,
      timeoutPerAgent: 5000,
    });

    expect(mockFork).toHaveBeenCalledTimes(1);
    const forkArgs = mockFork.mock.calls[0]!;
    expect(forkArgs[0]).toContain("agent-runner");
    expect(forkArgs[1]).toBeDefined();

    expect(result.totalFindings).toBe(2);
    expect(result.agentResults).toHaveLength(1);
    expect(result.agentResults[0]!.dimension).toBe("security");
    expect(result.byDimension["security"]).toHaveLength(2);
  });

  it("should spawn multiple agents for multiple dimensions", async () => {
    mockFork
      .mockImplementationOnce(() => createMockChildProcess(0, JSON.stringify(SUCCESS_RESULT)))
      .mockImplementationOnce(() => createMockChildProcess(0, JSON.stringify(EMPTY_RESULT)));

    const spawner = new ParallelSpawner("/test");
    const result = await spawner.spawnAgents(
      [SECURITY_DIMENSION, PERFORMANCE_DIMENSION],
      { maxParallel: 2, timeoutPerAgent: 5000 },
    );

    expect(mockFork).toHaveBeenCalledTimes(2);
    expect(result.agentResults).toHaveLength(2);
    expect(result.totalFindings).toBe(2);
    expect(result.byDimension["security"]).toHaveLength(2);
    // performance has 0 findings, so key may not exist
    expect(result.byDimension["performance"] ?? []).toHaveLength(0);
  });

  it("should handle agent failure (non-zero exit)", async () => {
    const failedResult: AgentResult = {
      dimension: "security",
      findings: [],
      durationMs: 50,
      exitCode: 1,
      error: "Analysis failed",
    };

    mockFork.mockImplementation(() =>
      createMockChildProcess(1, JSON.stringify(failedResult)),
    );

    const spawner = new ParallelSpawner("/test");
    const result = await spawner.spawnAgents([SECURITY_DIMENSION], {
      maxParallel: 1,
      timeoutPerAgent: 5000,
    });

    expect(result.failedAgents).toContain("security");
    expect(result.agentResults[0]!.exitCode).toBe(1);
  });

  it("should limit concurrency with maxParallel", async () => {
    const dims: DimensionDef[] = [
      { name: "a", description: "a", globPatterns: [] },
      { name: "b", description: "b", globPatterns: [] },
      { name: "c", description: "c", globPatterns: [] },
    ];

    mockFork.mockImplementation(() =>
      createMockChildProcess(0, JSON.stringify(EMPTY_RESULT)),
    );

    const spawner = new ParallelSpawner("/test");
    await spawner.spawnAgents(dims, { maxParallel: 1, timeoutPerAgent: 5000 });

    expect(mockFork).toHaveBeenCalledTimes(3);
  });

  it("should handle empty dimension patterns gracefully", async () => {
    const emptyDim: DimensionDef = {
      name: "empty",
      description: "Empty patterns",
      globPatterns: [],
    };

    mockFork.mockReturnValue(
      createMockChildProcess(
        0,
        JSON.stringify({ dimension: "empty", findings: [], durationMs: 10, exitCode: 0 } as AgentResult),
      ),
    );

    const spawner = new ParallelSpawner("/test");
    const result = await spawner.spawnAgents([emptyDim], {
      maxParallel: 1,
      timeoutPerAgent: 5000,
    });

    expect(result.totalFindings).toBe(0);
    expect(result.agentResults).toHaveLength(1);
  });
});
