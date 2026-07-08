import { describe, it, expect } from "vitest";
import {
  consolidateResults,
  deduplicateFindings,
  sortFindings,
  mergeConsolidatedResults,
} from "../../src/kernel/orchestration/result-merger.js";
import type { AgentResult, Finding, ConsolidatedResult } from "../../src/kernel/orchestration/types.js";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const FINDING_A: Finding = {
  file: "src/auth/login.ts",
  line: 15,
  severity: "critical",
  message: "Hardcoded API key",
  dimension: "security",
};

const FINDING_B: Finding = {
  file: "src/auth/login.ts",
  line: 42,
  severity: "warning",
  message: "Missing rate limiting",
  dimension: "security",
};

const FINDING_C: Finding = {
  file: "src/db/query.ts",
  line: 0,
  severity: "warning",
  message: "Query inside loop — potential N+1",
  dimension: "performance",
};

const FINDING_D: Finding = {
  file: "src/db/query.ts",
  line: 0,
  severity: "info",
  message: "Large module check",
  dimension: "performance",
};

const FINDING_E: Finding = {
  // Duplicate of FINDING_A (same key)
  file: "src/auth/login.ts",
  line: 15,
  severity: "critical",
  message: "Hardcoded API key",
  dimension: "security",
};

describe("deduplicateFindings", () => {
  it("should remove exact duplicates by file+line+dimension+message", () => {
    const findings = [FINDING_A, FINDING_B, FINDING_E]; // E is duplicate of A
    const result = deduplicateFindings(findings);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(FINDING_A);
    expect(result[1]).toEqual(FINDING_B);
  });

  it("should not deduplicate same file+line but different dimension", () => {
    const securityFinding: Finding = {
      file: "src/auth/login.ts",
      line: 15,
      severity: "critical",
      message: "Something",
      dimension: "security",
    };
    const perfFinding: Finding = {
      file: "src/auth/login.ts",
      line: 15,
      severity: "critical",
      message: "Something",
      dimension: "performance",
    };

    const result = deduplicateFindings([securityFinding, perfFinding]);
    expect(result).toHaveLength(2);
  });

  it("should deduplicate same file+line+dimension but different message", () => {
    const f1: Finding = { ...FINDING_A };
    const f2: Finding = { ...FINDING_A, message: "Different message" };

    const result = deduplicateFindings([f1, f2]);
    expect(result).toHaveLength(2);
  });

  it("should return empty array for empty input", () => {
    expect(deduplicateFindings([])).toEqual([]);
  });

  it("should handle single element", () => {
    expect(deduplicateFindings([FINDING_A])).toEqual([FINDING_A]);
  });
});

describe("sortFindings", () => {
  it("should sort by severity: critical first, then warning, then info", () => {
    const findings = [FINDING_D, FINDING_B, FINDING_A];
    const result = sortFindings(findings);

    expect(result[0]!.severity).toBe("critical");
    expect(result[1]!.severity).toBe("warning");
    expect(result[2]!.severity).toBe("info");
  });

  it("should sort by file path within same severity", () => {
    const f1: Finding = { ...FINDING_B, file: "z.ts" };
    const f2: Finding = { ...FINDING_B, file: "a.ts" };

    const result = sortFindings([f1, f2]);
    expect(result[0]!.file).toBe("a.ts");
    expect(result[1]!.file).toBe("z.ts");
  });

  it("should sort by line within same file and severity", () => {
    const f1: Finding = { ...FINDING_A, line: 100 };
    const f2: Finding = { ...FINDING_A, line: 10 };

    const result = sortFindings([f1, f2]);
    expect(result[0]!.line).toBe(10);
    expect(result[1]!.line).toBe(100);
  });

  it("should not modify original array", () => {
    const findings = [FINDING_D, FINDING_B, FINDING_A];
    const original = [...findings];
    sortFindings(findings);
    expect(findings).toEqual(original);
  });
});

describe("consolidateResults", () => {
  const NOW = Date.now();

  it("should consolidate multiple agent results", () => {
    const results: AgentResult[] = [
      {
        dimension: "security",
        findings: [FINDING_A, FINDING_B],
        durationMs: 100,
        exitCode: 0,
      },
      {
        dimension: "performance",
        findings: [FINDING_C, FINDING_D],
        durationMs: 150,
        exitCode: 0,
      },
    ];

    const consolidated = consolidateResults(results, NOW, NOW + 500);

    expect(consolidated.totalFindings).toBe(4);
    expect(consolidated.byDimension["security"]).toHaveLength(2);
    expect(consolidated.byDimension["performance"]).toHaveLength(2);
    expect(consolidated.durationMs).toBe(500);
    expect(consolidated.timedOutAgents).toEqual([]);
    expect(consolidated.failedAgents).toEqual([]);
    expect(consolidated.agentResults).toHaveLength(2);
  });

  it("should handle overlapping findings across dimensions", () => {
    const sameFinding: Finding = {
      file: "src/auth/login.ts",
      line: 15,
      severity: "critical",
      message: "Hardcoded API key",
      dimension: "security",
    };

    const results: AgentResult[] = [
      {
        dimension: "security",
        findings: [sameFinding],
        durationMs: 100,
        exitCode: 0,
      },
      {
        dimension: "security",
        findings: [sameFinding],
        durationMs: 100,
        exitCode: 0,
      },
    ];

    const consolidated = consolidateResults(results, NOW, NOW + 200);

    // Duplicates should be deduped
    expect(consolidated.totalFindings).toBe(1);
    expect(consolidated.byDimension["security"]).toHaveLength(1);
  });

  it("should handle empty results", () => {
    const results: AgentResult[] = [];
    const consolidated = consolidateResults(results, NOW, NOW + 100);

    expect(consolidated.totalFindings).toBe(0);
    expect(consolidated.byDimension).toEqual({});
    expect(consolidated.durationMs).toBe(100);
  });

  it("should identify timed-out agents", () => {
    const results: AgentResult[] = [
      {
        dimension: "security",
        findings: [FINDING_A],
        durationMs: 120000,
        exitCode: -1,
        error: "Agent timed out after 120000ms",
      },
      {
        dimension: "performance",
        findings: [FINDING_C],
        durationMs: 50,
        exitCode: 0,
      },
    ];

    const consolidated = consolidateResults(results, NOW, NOW + 200);

    expect(consolidated.timedOutAgents).toContain("security");
    expect(consolidated.failedAgents).not.toContain("performance");
    // The timed-out agent's findings should not be included (exitCode != 0)
    expect(consolidated.byDimension["security"]).toBeUndefined();
    expect(consolidated.totalFindings).toBe(1);
  });

  it("should identify failed agents", () => {
    const results: AgentResult[] = [
      {
        dimension: "deps",
        findings: [],
        durationMs: 50,
        exitCode: 1,
        error: "Failed to parse package.json",
      },
      {
        dimension: "tests",
        findings: [],
        durationMs: 30,
        exitCode: 0,
      },
    ];

    const consolidated = consolidateResults(results, NOW, NOW + 100);

    expect(consolidated.failedAgents).toContain("deps");
    expect(consolidated.failedAgents).not.toContain("tests");
  });

  it("should populate topIssues with critical and warning findings", () => {
    const results: AgentResult[] = [
      {
        dimension: "security",
        findings: [FINDING_A, FINDING_B, FINDING_D],
        durationMs: 100,
        exitCode: 0,
      },
    ];

    const consolidated = consolidateResults(results, NOW, NOW + 100);

    // topIssues should include critical + warning (not info)
    expect(consolidated.topIssues.length).toBe(2);
    expect(consolidated.topIssues.every((f) => f.severity !== "info")).toBe(true);
  });
});

describe("mergeConsolidatedResults", () => {
  it("should merge multiple consolidated results", () => {
    const NOW = Date.now();

    const r1: ConsolidatedResult = {
      totalFindings: 2,
      byDimension: {
        security: [FINDING_A, FINDING_B],
      },
      topIssues: [FINDING_A, FINDING_B],
      durationMs: 100,
      timedOutAgents: [],
      failedAgents: [],
      agentResults: [
        {
          dimension: "security",
          findings: [FINDING_A, FINDING_B],
          durationMs: 100,
          exitCode: 0,
        },
      ],
    };

    const r2: ConsolidatedResult = {
      totalFindings: 1,
      byDimension: {
        performance: [FINDING_C],
      },
      topIssues: [FINDING_C],
      durationMs: 80,
      timedOutAgents: [],
      failedAgents: [],
      agentResults: [
        {
          dimension: "performance",
          findings: [FINDING_C],
          durationMs: 80,
          exitCode: 0,
        },
      ],
    };

    const merged = mergeConsolidatedResults([r1, r2]);

    expect(merged.totalFindings).toBe(3);
    expect(merged.byDimension["security"]).toHaveLength(2);
    expect(merged.byDimension["performance"]).toHaveLength(1);
    expect(merged.agentResults).toHaveLength(2);
  });

  it("should return empty result for empty array", () => {
    const merged = mergeConsolidatedResults([]);
    expect(merged.totalFindings).toBe(0);
    expect(merged.byDimension).toEqual({});
    expect(merged.durationMs).toBe(0);
  });

  it("should return single result unchanged", () => {
    const NOW = Date.now();
    const r: ConsolidatedResult = {
      totalFindings: 2,
      byDimension: { security: [FINDING_A, FINDING_B] },
      topIssues: [FINDING_A],
      durationMs: 100,
      timedOutAgents: [],
      failedAgents: [],
      agentResults: [
        { dimension: "security", findings: [FINDING_A, FINDING_B], durationMs: 100, exitCode: 0 },
      ],
    };

    const merged = mergeConsolidatedResults([r]);
    expect(merged).toEqual(r);
  });
});
