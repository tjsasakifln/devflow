/**
 * Solo detection tests — verify git committer counting and solo developer detection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock execSync before importing the module
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import { detectSoloDeveloper } from "../../src/kernel/detection/solo.js";

describe("detectSoloDeveloper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect solo developer with exactly 1 committer", () => {
    vi.mocked(execSync).mockReturnValue(
      "    5\tJohn Solo <john@example.com>\n"
    );

    const result = detectSoloDeveloper("/fake/repo");

    expect(result.committerCount).toBe(1);
    expect(result.isSolo).toBe(true);
    expect(result.committers).toEqual(["John Solo <john@example.com>"]);
    expect(result.error).toBeUndefined();
  });

  it("should detect team project with 2+ committers", () => {
    vi.mocked(execSync).mockReturnValue(
      "   10\tAlice <alice@example.com>\n    8\tBob <bob@example.com>\n"
    );

    const result = detectSoloDeveloper("/fake/repo");

    expect(result.committerCount).toBe(2);
    expect(result.isSolo).toBe(false);
    expect(result.committers).toHaveLength(2);
    expect(result.committers).toContain("Alice <alice@example.com>");
    expect(result.committers).toContain("Bob <bob@example.com>");
    expect(result.error).toBeUndefined();
  });

  it("should detect solo developer with 0 committers (empty repo)", () => {
    vi.mocked(execSync).mockReturnValue("");

    const result = detectSoloDeveloper("/fake/repo");

    expect(result.committerCount).toBe(0);
    expect(result.isSolo).toBe(true);
    expect(result.committers).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it("should safely handle git command failure", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("fatal: not a git repository");
    });

    const result = detectSoloDeveloper("/not-a-git-repo");

    expect(result.committerCount).toBe(0);
    expect(result.isSolo).toBe(false);
    expect(result.committers).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("not a git repository");
  });

  it("should safely handle execSync timeout", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("ETIMEDOUT");
    });

    const result = detectSoloDeveloper("/fake/repo");

    expect(result.committerCount).toBe(0);
    expect(result.isSolo).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should parse multi-line git shortlog output correctly", () => {
    vi.mocked(execSync).mockReturnValue(
      "   30\tLead Dev <lead@bigco.com>\n   22\tSenior Dev <senior@bigco.com>\n   15\tJunior Dev <junior@bigco.com>\n    3\tIntern <intern@bigco.com>\n"
    );

    const result = detectSoloDeveloper("/fake/repo");

    expect(result.committerCount).toBe(4);
    expect(result.isSolo).toBe(false);
    expect(result.committers).toHaveLength(4);
  });

  it("should handle whitespace variations in git shortlog output", () => {
    vi.mocked(execSync).mockReturnValue(" \t 1\t  Padded Name <padded@test.com>  \n");

    const result = detectSoloDeveloper("/fake/repo");

    expect(result.committerCount).toBe(1);
    expect(result.isSolo).toBe(true);
    expect(result.committers[0]).toContain("Padded Name");
  });

  it("should return 0 committers for new repo with no commits in 30 days", () => {
    vi.mocked(execSync).mockReturnValue("");

    const result = detectSoloDeveloper("/fake/repo");

    expect(result.committerCount).toBe(0);
    expect(result.isSolo).toBe(true);
  });
});
