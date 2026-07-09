/**
 * Safe Process Runner Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("node:fs/promises", () => ({ stat: vi.fn() }));

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { validateCwd, isAllowedCommand, runProcess } from "../../../src/adapters/process/safe-runner.js";

describe("validateCwd", () => {
  beforeEach(() => vi.clearAllMocks());
  it("true for valid dir", async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    expect(await validateCwd("/d")).toBe(true);
  });
  it("false when missing", async () => {
    vi.mocked(stat).mockRejectedValue(new Error("ENOENT"));
    expect(await validateCwd("/x")).toBe(false);
  });
  it("false when not dir", async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any);
    expect(await validateCwd("/f.ts")).toBe(false);
  });
});

describe("isAllowedCommand", () => {
  it("allows listed", () => { expect(isAllowedCommand("git", ["git"])).toBe(true); });
  it("blocks unlisted", () => { expect(isAllowedCommand("rm", ["git"])).toBe(false); });
  it("uses defaults", () => { expect(isAllowedCommand("git")).toBe(true); expect(isAllowedCommand("rm")).toBe(false); });
});

describe("runProcess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails when cwd invalid", async () => {
    vi.mocked(stat).mockRejectedValue(new Error("ENOENT"));
    const r = await runProcess({ command: "git", args: ["s"], cwd: "/x", timeout: 1000 });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("cwd does not exist");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("fails when command not allowed", async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    const r = await runProcess({ command: "rm", args: [], cwd: "/r", timeout: 1000, allowedCommands: ["git"] });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("Command not in allowlist");
    expect(spawn).not.toHaveBeenCalled();
  });

  /**
   * These tests integrate with spawn mock. The challenge is that runProcess
   * awaits validateCwd() before setting up event handlers in the Promise
   * constructor. So events must be emitted AFTER the handlers are registered,
   * which happens in a microtask. We use setImmediate/setTimeout(0) to defer.
   */
  function makeSpawnable() {
    let closeHandler: any = null;
    let errorHandler: any = null;
    const stdoutHandlers: Array<(d: Buffer) => void> = [];
    const stderrHandlers: Array<(d: Buffer) => void> = [];

    vi.mocked(spawn).mockImplementation(() => ({
      stdout: { on: vi.fn((_e: string, h: any) => { stdoutHandlers.push(h); }) },
      stderr: { on: vi.fn((_e: string, h: any) => { stderrHandlers.push(h); }) },
      on: vi.fn((event: string, h: any) => {
        if (event === "close") closeHandler = h;
        if (event === "error") errorHandler = h;
      }),
    }) as any);

    return {
      emitStdout: (d: string) => stdoutHandlers.forEach(h => h(Buffer.from(d, "utf-8"))),
      emitStderr: (d: string) => stderrHandlers.forEach(h => h(Buffer.from(d, "utf-8"))),
      emitClose: (code: number | null, sig?: string | null) => closeHandler?.(code, sig ?? null),
      emitError: (err: Error) => errorHandler?.(err),
    };
  }

  it("executes and captures stdout", async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    const child = makeSpawnable();
    const p = runProcess({ command: "git", args: ["status"], cwd: "/r", timeout: 5000 });

    // Defer emit to after runProcess sets up event handlers (microtask)
    await new Promise<void>(r => setTimeout(() => { child.emitStdout("output\n"); child.emitClose(0); r(); }, 0));
    const result = await p;

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("output");
  });

  it("captures stderr", async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    const child = makeSpawnable();
    const p = runProcess({ command: "git", args: ["x"], cwd: "/r", timeout: 5000 });

    await new Promise<void>(r => setTimeout(() => { child.emitStderr("error\n"); child.emitClose(1); r(); }, 0));
    const result = await p;

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("error");
  });

  it("handles ENOENT error event", async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    const child = makeSpawnable();
    const p = runProcess({ command: "node", args: [], cwd: "/r", timeout: 5000 });

    const err = new Error("spawn ENOENT");
    (err as any).code = "ENOENT";
    await new Promise<void>(r => setTimeout(() => { child.emitError(err); r(); }, 0));

    const result = await p;
    expect(result.stderr).toContain("Command not found");
  });

  it("detects SIGTERM as timeout", async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    const child = makeSpawnable();
    const p = runProcess({ command: "git", args: ["s"], cwd: "/r", timeout: 100 });

    await new Promise<void>(r => setTimeout(() => { child.emitClose(null, "SIGTERM"); r(); }, 0));
    const result = await p;

    expect(result.timedOut).toBe(true);
    expect(result.killed).toBe(true);
  });

  it("merges custom env", async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    const child = makeSpawnable();
    const p = runProcess({ command: "node", args: ["s"], cwd: "/r", timeout: 5000, env: { X: "y" } });

    await new Promise<void>(r => setTimeout(() => { child.emitClose(0, null); r(); }, 0));
    await p;

    expect(spawn).toHaveBeenCalledWith("node", ["s"], expect.objectContaining({
      env: expect.objectContaining({ X: "y" }),
    }));
  });

  it("accepts custom allowlist", async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    const child = makeSpawnable();
    const p = runProcess({ command: "python", args: ["s.py"], cwd: "/r", timeout: 5000, allowedCommands: ["python"] });

    await new Promise<void>(r => setTimeout(() => { child.emitClose(0); r(); }, 0));
    const result = await p;
    expect(result.exitCode).toBe(0);
  });
});
