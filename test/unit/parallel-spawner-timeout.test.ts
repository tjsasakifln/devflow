import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { ParallelSpawner } from "../../src/kernel/orchestration/parallel-spawner.js";
import type { DimensionDef, AgentResult } from "../../src/kernel/orchestration/types.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFork = vi.hoisted(() => vi.fn());
const killedProcesses: number[] = [];

vi.mock("node:child_process", () => ({ fork: mockFork }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(
      JSON.stringify({
        rootPath: "/test",
        dimension: "test",
        relevantFiles: [],
        timeoutMs: 120000,
        runId: "test-run",
      }),
    ),
    readdir: vi.fn().mockResolvedValue([]),
    rm: vi.fn().mockImplementation((...args: unknown[]) => {
      const lastArg = args[args.length - 1];
      if (typeof lastArg === 'function') (lastArg as Function)(null);
      return Promise.resolve(undefined);
    }),
    stat: vi.fn().mockResolvedValue({ isFile: () => true, size: 1000 }),
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

function createMockChildProcess(
  exitCode: number,
  stdoutData: string,
  delayMs: number,
  id: number = 0,
): ChildProcess {
  const emitter = new EventEmitter() as Record<string, unknown>;
  const stdout = new EventEmitter() as ChildProcess["stdout"];
  const stderr = new EventEmitter() as ChildProcess["stderr"];

  Object.defineProperty(emitter, "stdout", { value: stdout });
  Object.defineProperty(emitter, "stderr", { value: stderr });

  (emitter as any).kill = () => true;

  const timeout = setTimeout(() => {
    stdout.emit("data", Buffer.from(stdoutData));
    setImmediate(() => {
      emitter.emit("close", exitCode, null);
    });
  }, delayMs);

  vi.spyOn(emitter as any, "kill").mockImplementation(
    (_signal?: string) => {
      killedProcesses.push(id);
      clearTimeout(timeout);
      setImmediate(() => {
        emitter.emit("close", -1, null);
      });
      return true;
    },
  );

  return emitter as unknown as ChildProcess;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const DIM_A: DimensionDef = {
  name: "fast-dim",
  description: "Fast dimension",
  globPatterns: ["*.ts"],
};

const DIM_B: DimensionDef = {
  name: "slow-dim",
  description: "Slow dimension",
  globPatterns: ["*.ts"],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ParallelSpawner Timeout Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    killedProcesses.length = 0;
    vi.useRealTimers();
  });

  it("should handle agent that completes before timeout", async () => {
    mockFork.mockImplementation(() =>
      createMockChildProcess(
        0,
        JSON.stringify({
          dimension: "fast-dim",
          findings: [{ file: "test.ts", line: 1, severity: "info", message: "Test", dimension: "fast-dim" }],
          durationMs: 50,
          exitCode: 0,
        } as AgentResult),
        50,
      ),
    );

    const spawner = new ParallelSpawner("/test");
    const result = await spawner.spawnAgents([DIM_A], {
      maxParallel: 1,
      timeoutPerAgent: 5000,
    });

    expect(result.agentResults).toHaveLength(1);
    expect(result.agentResults[0]!.exitCode).toBe(0);
    expect(result.agentResults[0]!.findings).toHaveLength(1);
    expect(killedProcesses).toEqual([]);
  });

  it("should timeout agent that exceeds limit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockFork.mockImplementation(() =>
      createMockChildProcess(0, "{}", 9999999, 1),
    );

    const spawner = new ParallelSpawner("/test");
    const spawnPromise = spawner.spawnAgents([DIM_B], {
      maxParallel: 1,
      timeoutPerAgent: 100,
    });

    await vi.advanceTimersByTimeAsync(500);
    const result = await spawnPromise;
    vi.useRealTimers();

    expect(killedProcesses.length).toBeGreaterThanOrEqual(1);
    expect(result.timedOutAgents).toContain("slow-dim");
  });

  it("should not kill other agents when one times out", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockFork
      .mockImplementationOnce(() =>
        createMockChildProcess(
          0,
          JSON.stringify({ dimension: "fast-dim", findings: [], durationMs: 20, exitCode: 0 } as AgentResult),
          20,
          1,
        ),
      )
      .mockImplementationOnce(() =>
        createMockChildProcess(0, "{}", 9999999, 2),
      );

    const spawner = new ParallelSpawner("/test");
    const spawnPromise = spawner.spawnAgents([DIM_A, DIM_B], {
      maxParallel: 2,
      timeoutPerAgent: 100,
    });

    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(200);
    const result = await spawnPromise;
    vi.useRealTimers();

    const fastAgent = result.agentResults.find((a) => a.dimension === "fast-dim");
    expect(fastAgent).toBeDefined();

    const slowAgent = result.agentResults.find((a) => a.dimension === "slow-dim");
    expect(slowAgent).toBeDefined();

    // The fast agent should complete (either exit code 0 or undefined)
    // The slow agent should time out
    expect(result.timedOutAgents).toContain("slow-dim");
    expect(result.timedOutAgents).not.toContain("fast-dim");
    expect(result.failedAgents).not.toContain("fast-dim");
  });

  it("should handle mixed success and failure", async () => {
    mockFork
      .mockImplementationOnce(() =>
        createMockChildProcess(
          0,
          JSON.stringify({ dimension: "fast-dim", findings: [], durationMs: 20, exitCode: 0 } as AgentResult),
          20,
        ),
      )
      .mockImplementationOnce(() =>
        createMockChildProcess(
          1,
          JSON.stringify({
            dimension: "slow-dim",
            findings: [],
            durationMs: 30,
            exitCode: 1,
            error: "Something went wrong",
          } as AgentResult),
          30,
        ),
      );

    const spawner = new ParallelSpawner("/test");
    const result = await spawner.spawnAgents([DIM_A, DIM_B], {
      maxParallel: 2,
      timeoutPerAgent: 5000,
    });

    expect(result.agentResults).toHaveLength(2);

    // Check by dimension name (order-agnostic — parallel execution is non-deterministic)
    const fastResult = result.agentResults.find((a) => a.dimension === "fast-dim");
    const slowResult = result.agentResults.find((a) => a.dimension === "slow-dim");
    expect(fastResult).toBeDefined();
    expect(slowResult).toBeDefined();
    expect(fastResult!.exitCode).toBe(0);
    expect(slowResult!.exitCode).toBe(1);
    expect(result.failedAgents).toHaveLength(1);
    expect(result.timedOutAgents).toHaveLength(0);
  });
});
