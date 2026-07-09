import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("node:fs", () => ({ readFileSync: vi.fn(), readdirSync: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readdir: vi.fn(), stat: vi.fn() }));
import { readFileSync } from "node:fs";
import { defaultExclusionPatterns, loadExclusionRules, shouldExclude, filterExcludedFiles } from "../../../src/adapters/git/exclusion-rules.js";

describe("defaultExclusionPatterns", () => {
  it("returns common patterns", () => {
    const p = defaultExclusionPatterns();
    expect(p).toContain("dist/"); expect(p).toContain("node_modules/"); expect(p).toContain("coverage/"); expect(p.length).toBeGreaterThan(10);
  });
});

describe("loadExclusionRules", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns defaults no ignore files", () => {
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error("ENOENT"); });
    expect(loadExclusionRules("/p").patterns).toContain("dist/");
  });
  it("merges .gitignore", () => {
    vi.mocked(readFileSync).mockImplementationOnce(() => ".env\n").mockImplementationOnce(() => { throw new Error("ENOENT"); });
    expect(loadExclusionRules("/p").patterns).toContain(".env");
  });
});

describe("shouldExclude", () => {
  it("excludes default patterns", () => {
    const r = loadExclusionRules("/p");
    expect(shouldExclude("node_modules/x.js", r)).toBe(true);
    expect(shouldExclude("src/index.ts", r)).toBe(false);
  });
  it("honors negation", () => {
    expect(shouldExclude("dist/hide.js", { patterns: ["dist/", "!dist/keep.txt"], defaultExcludes: [] })).toBe(true);
    expect(shouldExclude("dist/keep.txt", { patterns: ["dist/", "!dist/keep.txt"], defaultExcludes: [] })).toBe(false);
  });
});

describe("filterExcludedFiles", () => {
  it("filters", () => { expect(filterExcludedFiles(["a.ts", "b.log"], { patterns: ["*.log"], defaultExcludes: [] })).toEqual(["a.ts"]); });
});
