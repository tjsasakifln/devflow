/**
 * Git Adapter Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/adapters/process/safe-runner.js", () => ({ runProcess: vi.fn() }));
vi.mock("node:fs/promises", () => ({ stat: vi.fn(), appendFile: vi.fn(), readFile: vi.fn(), mkdir: vi.fn() }));
// Mock the paths constant used by logHookBypass and getHookBypasses
vi.mock("../../../src/kernel/constants/paths.js", () => ({
  HOOK_BYPASS_LOG_RELPATH: ".devflow/audits/hook-bypass.jsonl",
}));

import { runProcess } from "../../../src/adapters/process/safe-runner.js";
import { stat, appendFile, readFile, mkdir } from "node:fs/promises";

import {
  getCurrentBranch, getCommitSha, getStatus, isFeatureBranch, getGitContext,
  getGitUserEmail, getStagedDiff, getUnstagedDiff, getWorkingTreeStatus,
  logHookBypass, getHookBypasses, isWorktree, getWorktreeList, detectSubmodules,
} from "../../../src/adapters/git/index.js";

function setGitDir() { vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any); }
function noGitDir() { vi.mocked(stat).mockRejectedValue(new Error("ENOENT")); }
function mockRP(stdout: string, ec = 0) { vi.mocked(runProcess).mockResolvedValue({ exitCode: ec, stdout, stderr: "", timedOut: false, killed: false }); }
function mockRPOnce(stdout: string, ec = 0) { vi.mocked(runProcess).mockResolvedValueOnce({ exitCode: ec, stdout, stderr: "", timedOut: false, killed: false }); }

describe("getCurrentBranch", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("returns branch", async () => { mockRP("main"); expect(await getCurrentBranch("/r")).toBe("main"); });
  it("null no git", async () => { noGitDir(); expect(await getCurrentBranch("/x")).toBeNull(); });
  it("null on failure", async () => { vi.mocked(runProcess).mockResolvedValue({ exitCode: 1, stdout: "", stderr: "", timedOut: false, killed: false }); expect(await getCurrentBranch("/r")).toBeNull(); });
});

describe("getCommitSha", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("returns SHA", async () => { mockRP("abc"); expect(await getCommitSha("/r")).toBe("abc"); });
  it("null no git", async () => { noGitDir(); expect(await getCommitSha("/x")).toBeNull(); });
});

describe("getStatus", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("clean", async () => { mockRP(""); expect(await getStatus("/r")).toBe("clean"); });
  it("dirty", async () => { mockRP(" M x.ts"); expect(await getStatus("/r")).toBe("dirty"); });
  it("unknown no git", async () => { noGitDir(); expect(await getStatus("/x")).toBe("unknown"); });
});

describe("isFeatureBranch", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("false main", async () => { mockRP("main"); expect(await isFeatureBranch("/r")).toBe(false); });
  it("false master", async () => { mockRP("master"); expect(await isFeatureBranch("/r")).toBe(false); });
  it("true feature", async () => { mockRP("feat/x"); expect(await isFeatureBranch("/r")).toBe(true); });
  it("false no git", async () => { noGitDir(); expect(await isFeatureBranch("/x")).toBe(false); });
});

describe("getGitContext", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("full context", async () => {
    mockRPOnce("main"); mockRPOnce("abc"); mockRPOnce("");
    const ctx = await getGitContext("/r");
    expect(ctx.hasGit).toBe(true);
    expect(ctx.branch).toBe("main");
    expect(ctx.commitSha).toBe("abc");
    expect(ctx.isClean).toBe(true);
  });
  it("no-git context", async () => { noGitDir(); const ctx = await getGitContext("/x"); expect(ctx.hasGit).toBe(false); });
});

describe("getStagedDiff", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("returns diff", async () => { mockRP("M\ta.ts"); expect(await getStagedDiff("/r")).toContain("a.ts"); });
  it("empty no git", async () => { noGitDir(); expect(await getStagedDiff("/x")).toBe(""); });
});

describe("getUnstagedDiff", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("returns diff", async () => { mockRP("M\nu.ts"); expect(await getUnstagedDiff("/r")).toContain("u.ts"); });
});

describe("getGitUserEmail", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("returns email", async () => { mockRP("a@b.com"); expect(await getGitUserEmail("/r")).toBe("a@b.com"); });
  it("null no git", async () => { noGitDir(); expect(await getGitUserEmail("/x")).toBeNull(); });
});

describe("logHookBypass", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); vi.mocked(mkdir).mockResolvedValue(undefined); vi.mocked(appendFile).mockResolvedValue(undefined); });
  it("writes JSON entry", async () => {
    mockRPOnce("main"); mockRPOnce("abc"); mockRPOnce("a@b.com");
    await logHookBypass("/r", "pre-commit", "testing");
    const json = JSON.parse(vi.mocked(appendFile).mock.calls[0]![1] as string);
    expect(json.hook).toBe("pre-commit");
    expect(json.branch).toBe("main");
    expect(json.sha).toBe("abc");
  });
  it("handles failures gracefully", async () => {
    mockRPOnce("main"); mockRPOnce("abc"); mockRPOnce("a@b.com");
    vi.mocked(appendFile).mockRejectedValue(new Error("fail"));
    await expect(logHookBypass("/r", "pre-commit", "x")).resolves.toBeUndefined();
  });
});

describe("getHookBypasses", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("parses entries", async () => {
    vi.mocked(readFile).mockResolvedValue('{"hook":"pre","timestamp":"2026-07-08T10:00:00Z","branch":"m","sha":"a","user":"u","reason":"r"}\n');
    expect(await getHookBypasses("/r")).toHaveLength(1);
  });
  it("filters by since", async () => {
    vi.mocked(readFile).mockResolvedValue(
      '{"hook":"a","timestamp":"2026-07-08T10:00:00Z","branch":"m","sha":"a","user":"u","reason":"old"}\n' +
      '{"hook":"b","timestamp":"2026-07-08T12:00:00Z","branch":"m","sha":"b","user":"u","reason":"new"}\n');
    const r = await getHookBypasses("/r", "2026-07-08T11:00:00Z");
    expect(r).toHaveLength(1);
    expect(r[0]!.reason).toBe("new");
  });
  it("empty on missing file", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
    expect(await getHookBypasses("/r")).toEqual([]);
  });
  it("skips malformed lines", async () => {
    vi.mocked(readFile).mockResolvedValue('{"hook":"v","timestamp":"2026-07-08T10:00:00Z","branch":"m","sha":"a","user":"u","reason":"ok"}\nbad\n');
    expect(await getHookBypasses("/r")).toHaveLength(1);
  });
});

describe("isWorktree", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("detects worktree", async () => { mockRP("true"); expect(await isWorktree("/r")).toBe(true); });
  it("not worktree", async () => { mockRP("false"); expect(await isWorktree("/r")).toBe(false); });
  it("false no git", async () => { noGitDir(); expect(await isWorktree("/x")).toBe(false); });
});

describe("getWorktreeList", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("parses output", async () => { mockRP("/r/main  (main)\n/r/wt  (feat)"); expect(await getWorktreeList("/r")).toHaveLength(2); });
  it("empty on failure", async () => { vi.mocked(runProcess).mockResolvedValue({ exitCode: 1, stdout: "", stderr: "", timedOut: false, killed: false }); expect(await getWorktreeList("/r")).toEqual([]); });
  it("empty no git", async () => { noGitDir(); expect(await getWorktreeList("/x")).toEqual([]); });
});

describe("detectSubmodules", () => {
  beforeEach(() => { vi.clearAllMocks(); setGitDir(); });
  it("parses lines with - prefix", async () => {
    mockRP("-5a3f2c1 path/to/sub (v1.0)");
    const mods = await detectSubmodules("/r");
    expect(mods).toHaveLength(1);
    expect(mods[0]).toBe("path/to/sub");
  });
  it("handles uninitialized", async () => { mockRP("-5a3f2c1 sub2"); expect(await detectSubmodules("/r")).toHaveLength(1); });
  it("empty on failure", async () => { vi.mocked(runProcess).mockResolvedValue({ exitCode: 1, stdout: "", stderr: "", timedOut: false, killed: false }); expect(await detectSubmodules("/r")).toEqual([]); });
  it("empty no git", async () => { noGitDir(); expect(await detectSubmodules("/x")).toEqual([]); });
});
