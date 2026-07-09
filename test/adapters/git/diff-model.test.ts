import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("node:child_process", () => ({ execSync: vi.fn() }));
import { execSync } from "node:child_process";
import { parseNameStatus, parseNumStat, getMergeBase, isBinary, buildDiffModel } from "../../../src/adapters/git/diff-model.js";

describe("parseNameStatus", () => {
  it("parses added", () => expect(parseNameStatus("A\tx.ts")).toEqual([{ status: "A", path: "x.ts" }]));
  it("parses modified", () => expect(parseNameStatus("M\tx.ts")).toEqual([{ status: "M", path: "x.ts" }]));
  it("parses renamed", () => expect(parseNameStatus("R100\ta.ts\tb.ts")).toEqual([{ status: "R", path: "b.ts", oldPath: "a.ts" }]));
  it("returns empty for empty", () => expect(parseNameStatus("")).toEqual([]));
});

describe("parseNumStat", () => {
  it("parses numbers", () => expect(parseNumStat("1\t2\tx.ts")).toEqual([{ additions: 1, deletions: 2, path: "x.ts", binary: false }]));
  it("handles binary", () => expect(parseNumStat("-\t-\tx.png")).toEqual([{ additions: 0, deletions: 0, path: "x.png", binary: true }]));
  it("returns empty for empty", () => expect(parseNumStat("")).toEqual([]));
});

describe("getMergeBase", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns sha", () => { vi.mocked(execSync).mockReturnValue("abc\n"); expect(getMergeBase("/r", "main")).toBe("abc"); });
  it("empty on fail", () => { vi.mocked(execSync).mockImplementation(() => { throw new Error(""); }); expect(getMergeBase("/x", "main")).toBe(""); });
});

describe("isBinary", () => {
  beforeEach(() => vi.clearAllMocks());
  it("true for binary", () => { vi.mocked(execSync).mockReturnValue("-\t-\tx.png\n"); expect(isBinary("x.png", "/r")).toBe(true); });
  it("false for text", () => { vi.mocked(execSync).mockReturnValue("1\t2\tx.ts\n"); expect(isBinary("x.ts", "/r")).toBe(false); });
  it("false on fail", () => { vi.mocked(execSync).mockImplementation(() => { throw new Error(""); }); expect(isBinary("x.ts", "/r")).toBe(false); });
});

describe("buildDiffModel", () => {
  beforeEach(() => vi.clearAllMocks());
  it("empty when no git", async () => { vi.mocked(execSync).mockImplementation(() => { throw new Error(""); }); expect((await buildDiffModel("/x")).files).toEqual([]); });
  it("includes staged and unstaged", async () => {
    vi.mocked(execSync).mockReturnValueOnce("abc\n").mockReturnValueOnce("main\n").mockReturnValueOnce("M\ts.ts\n").mockReturnValueOnce("1\t1\ts.ts\n").mockReturnValueOnce("M\tu.ts\n").mockReturnValueOnce("2\t2\nu.ts\n").mockReturnValueOnce("");
    const m = await buildDiffModel("/r");
    expect(m.stagedFiles).toHaveLength(1); expect(m.unstagedFiles).toHaveLength(1);
  });
  it("uses base option", async () => {
    vi.mocked(execSync).mockReturnValueOnce("abc\n").mockReturnValueOnce("bs\n").mockReturnValueOnce("M\tb.ts\n").mockReturnValueOnce("3\t4\tb.ts\n").mockReturnValueOnce("").mockReturnValueOnce("").mockReturnValueOnce("");
    const m = await buildDiffModel("/r", { base: "main" });
    expect(m.baseFiles).toHaveLength(1); expect(m.mergeBase).toBe("bs"); expect(m.baseBranch).toBe("main");
  });
});
