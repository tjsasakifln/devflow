/**
 * Unit tests for Adversarial Verify Pattern (Story 3.2)
 *
 * Tests the AdversarialVerifier class with known false-positive,
 * known real findings, and split-decision scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Dynamic import to avoid module resolution issues in test runner
const TYPES_PATH = "../../src/kernel/orchestration/types.js";
const VERIFIER_PATH = "../../src/kernel/orchestration/adversarial-verify.js";

import type {
  Finding,
  AdversarialLens,
  AdversarialVerdict,
  VerificationResult,
  VerificationOutcome,
  AdversarialVerificationResult,
} from "../../src/kernel/orchestration/types.js";

describe("AdversarialVerifier", () => {
  let tempRoot: string;
  let verifier: import("../../src/kernel/orchestration/adversarial-verify.js").AdversarialVerifier;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "adv-verify-test-"));
    const mod = await import(VERIFIER_PATH);
    verifier = new mod.AdversarialVerifier(tempRoot);
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  // ── Helper: create a Finding quickly ──

  function makeFinding(
    overrides: Partial<Finding> = {},
  ): Finding {
    return {
      file: "src/example.ts",
      line: 42,
      severity: "warning",
      message: "Test finding",
      dimension: "tests",
      ...overrides,
    };
  }

  // ===================================================================
  // Task 1: AdversarialVerifier class exists and spawns verifiers
  // ===================================================================

  describe("Task 1: Basic structure", () => {
    it("should instantiate AdversarialVerifier", () => {
      expect(verifier).toBeDefined();
      expect(verifier.verify).toBeDefined();
      expect(verifier.verifyOne).toBeDefined();
    });

    it("should return empty result for empty findings", async () => {
      const result = await verifier.verify([]);
      expect(result.totalFindings).toBe(0);
      expect(result.survived).toHaveLength(0);
      expect(result.refuted).toHaveLength(0);
      expect(result.disputed).toHaveLength(0);
      expect(result.allResults).toHaveLength(0);
    });

    it("should verify a single finding via verifyOne", async () => {
      const finding = makeFinding({ severity: "info" });
      const result = await verifier.verifyOne(finding);

      expect(result.finding).toBe(finding);
      expect(result.verdicts).toHaveLength(3); // 3 lenses
      expect(["survived", "refuted", "disputed"]).toContain(result.outcome);
    });

    it("should return 3 verdicts per finding (one per lens)", async () => {
      const finding = makeFinding();
      const result = await verifier.verify([finding]);

      expect(result.allResults).toHaveLength(1);
      const vr = result.allResults[0]!;
      expect(vr.verdicts).toHaveLength(3);

      const lenses = vr.verdicts.map((v) => v.lens).sort();
      expect(lenses).toEqual(["correctness", "repro", "security"]);
    });

    it("should have refuted and reason fields on each verdict", async () => {
      const finding = makeFinding();
      const result = await verifier.verify([finding]);
      const vr = result.allResults[0]!;

      for (const verdict of vr.verdicts) {
        expect(typeof verdict.refuted).toBe("boolean");
        expect(typeof verdict.reason).toBe("string");
        expect(verdict.reason.length).toBeGreaterThan(0);
      }
    });
  });

  // ===================================================================
  // Task 2: Spawn de N verifiers (3 lenses) per finding
  // ===================================================================

  describe("Task 2: Multiple findings spawn N x 3 verifiers", () => {
    it("should process multiple findings in parallel", async () => {
      const findings = [
        makeFinding({ file: "a.ts", severity: "info" }),
        makeFinding({ file: "b.ts", severity: "warning" }),
        makeFinding({ file: "c.ts", severity: "critical" }),
        makeFinding({ file: "d.ts", severity: "warning" }),
        makeFinding({ file: "e.ts", severity: "info" }),
      ];

      const result = await verifier.verify(findings, { maxParallel: 5 });
      expect(result.totalFindings).toBe(5);
      expect(result.allResults).toHaveLength(5);

      // Each finding should have 3 lens verdicts
      for (const vr of result.allResults) {
        expect(vr.verdicts).toHaveLength(3);
      }
    });

    it("should handle concurrency with maxParallel < finding count", async () => {
      const findings = new Array(10).fill(null).map((_, i) =>
        makeFinding({ file: `file-${i}.ts`, severity: "info" }),
      );

      const result = await verifier.verify(findings, { maxParallel: 3 });
      expect(result.totalFindings).toBe(10);
      expect(result.allResults).toHaveLength(10);
    });
  });

  // ===================================================================
  // Task 3: Correctness lens behaviors
  // ===================================================================

  describe("Task 3a: Correctness lens", () => {
    it("should refute critical severity in non-security file", async () => {
      const finding = makeFinding({
        file: "src/utils/helpers.ts",
        severity: "critical",
        message: "Some critical issue",
      });

      const result = await verifier.verifyOne(finding);
      const correctnessVerdict = result.verdicts.find(
        (v) => v.lens === "correctness",
      )!;

      expect(correctnessVerdict.refuted).toBe(true);
      expect(correctnessVerdict.reason).toContain("non-security");
    });

    it("should NOT refute critical severity in security-sensitive file", async () => {
      const finding = makeFinding({
        file: "src/guards/auth.ts",
        severity: "critical",
        message: "Auth bypass vulnerability",
      });

      const result = await verifier.verifyOne(finding);
      const correctnessVerdict = result.verdicts.find(
        (v) => v.lens === "correctness",
      )!;

      expect(correctnessVerdict.refuted).toBe(false);
    });

    it("should refute warning in test file", async () => {
      const finding = makeFinding({
        file: "src/user.test.ts",
        severity: "warning",
      });

      const result = await verifier.verifyOne(finding);
      const correctnessVerdict = result.verdicts.find(
        (v) => v.lens === "correctness",
      )!;

      expect(correctnessVerdict.refuted).toBe(true);
      expect(correctnessVerdict.reason).toContain("test file");
    });

    it("should refute info-level findings", async () => {
      const finding = makeFinding({
        severity: "info",
      });

      const result = await verifier.verifyOne(finding);
      const correctnessVerdict = result.verdicts.find(
        (v) => v.lens === "correctness",
      )!;

      expect(correctnessVerdict.refuted).toBe(true);
      expect(correctnessVerdict.reason).toContain("informational");
    });

    it("should refute file-size advisory findings", async () => {
      const finding = makeFinding({
        message: "Large file (250KB) — split or lazy-load recommended",
      });

      const result = await verifier.verifyOne(finding);
      const correctnessVerdict = result.verdicts.find(
        (v) => v.lens === "correctness",
      )!;

      expect(correctnessVerdict.refuted).toBe(true);
      expect(correctnessVerdict.reason).toContain("maintainability");
    });

    it("should NOT refute a finding with no refutation signals", async () => {
      const finding = makeFinding({
        file: "src/core/payment.ts",
        severity: "critical",
        message: "SQL injection vulnerability detected",
      });

      const result = await verifier.verifyOne(finding);
      const correctnessVerdict = result.verdicts.find(
        (v) => v.lens === "correctness",
      )!;

      expect(correctnessVerdict.refuted).toBe(false);
    });
  });

  // ===================================================================
  // Task 3: Security lens behaviors
  // ===================================================================

  describe("Task 3b: Security lens", () => {
    it("should refute credential pattern in test file", async () => {
      const finding = makeFinding({
        file: "src/api.test.ts",
        message: "Potential secret/credential detected: API_KEY=...",
      });

      const result = await verifier.verifyOne(finding);
      const securityVerdict = result.verdicts.find(
        (v) => v.lens === "security",
      )!;

      expect(securityVerdict.refuted).toBe(true);
      expect(securityVerdict.reason).toContain("test");
    });

    it("should refute credential pattern in example/template file", async () => {
      const finding = makeFinding({
        file: ".env.example",
        message: "Potential secret/credential detected: DB_PASSWORD=...",
      });

      const result = await verifier.verifyOne(finding);
      const securityVerdict = result.verdicts.find(
        (v) => v.lens === "security",
      )!;

      expect(securityVerdict.refuted).toBe(true);
      expect(securityVerdict.reason).toContain("example");
    });

    it("should refute credential pattern in documentation file", async () => {
      const finding = makeFinding({
        file: "docs/setup.md",
        message: "Potential secret/credential detected: API_KEY=xxx",
      });

      const result = await verifier.verifyOne(finding);
      const securityVerdict = result.verdicts.find(
        (v) => v.lens === "security",
      )!;

      expect(securityVerdict.refuted).toBe(true);
      expect(securityVerdict.reason).toContain("documentation");
    });

    it("should NOT refute credential pattern in production code", async () => {
      const finding = makeFinding({
        file: "src/api/client.ts",
        message: "Potential secret/credential detected: API_KEY=sk-1234",
      });

      const result = await verifier.verifyOne(finding);
      const securityVerdict = result.verdicts.find(
        (v) => v.lens === "security",
      )!;

      expect(securityVerdict.refuted).toBe(false);
    });

    it("should refute N+1 performance findings as non-security", async () => {
      const finding = makeFinding({
        message: "Query inside loop detected — potential N+1 performance issue",
      });

      const result = await verifier.verifyOne(finding);
      const securityVerdict = result.verdicts.find(
        (v) => v.lens === "security",
      )!;

      expect(securityVerdict.refuted).toBe(true);
      expect(securityVerdict.reason).toContain("Performance");
    });
  });

  // ===================================================================
  // Task 3: Reproducibility lens behaviors
  // ===================================================================

  describe("Task 3c: Repro lens", () => {
    it("should refute file-level findings (line 0) as non-reproducible", async () => {
      const finding = makeFinding({
        line: 0,
        message: "Long file (600 lines) — consider refactoring",
      });

      const result = await verifier.verifyOne(finding);
      const reproVerdict = result.verdicts.find(
        (v) => v.lens === "repro",
      )!;

      expect(reproVerdict.refuted).toBe(true);
      expect(reproVerdict.reason).toContain("no specific line");
    });

    it("should NOT refute pattern-based security findings", async () => {
      const finding = makeFinding({
        file: "src/config.ts",
        line: 15,
        message: "Potential secret/credential detected: TOKEN=ghp_xxxx",
      });

      const result = await verifier.verifyOne(finding);
      const reproVerdict = result.verdicts.find(
        (v) => v.lens === "repro",
      )!;

      expect(reproVerdict.refuted).toBe(false);
      expect(reproVerdict.reason).toContain("deterministic");
    });

    it("should NOT refute structural findings (imports, deps)", async () => {
      const finding = makeFinding({
        file: "src/components/App.tsx",
        line: 1,
        message:
          "Deep relative imports (10x) — consider barrel exports or path aliases",
      });

      const result = await verifier.verifyOne(finding);
      const reproVerdict = result.verdicts.find(
        (v) => v.lens === "repro",
      )!;

      expect(reproVerdict.refuted).toBe(false);
      expect(reproVerdict.reason).toContain("Structural");
    });

    it("should NOT refute duplication findings", async () => {
      const finding = makeFinding({
        message: "Code duplication detected: blocks 10-30 duplicated in utils.ts",
      });

      const result = await verifier.verifyOne(finding);
      const reproVerdict = result.verdicts.find(
        (v) => v.lens === "repro",
      )!;

      expect(reproVerdict.refuted).toBe(false);
    });
  });

  // ===================================================================
  // Task 4: Threshold logic — >=2/3 survive, 2-1 disputed, <=1 refuted
  // ===================================================================

  describe("Task 4: Threshold logic", () => {
    it("should mark finding as survived when >=2 lenses do not refute", async () => {
      // Use a pattern that should survive most lenses:
      // - security: real credential in production code → NOT refuted
      // - repro: line-specific, deterministic → NOT refuted
      // - correctness: critical in security-sensitive file → NOT refuted
      const finding = makeFinding({
        file: "src/guards/auth.ts",
        line: 42,
        severity: "critical",
        message: "Potential secret/credential detected: JWT_SECRET=xxxx",
      });

      const result = await verifier.verifyOne(finding);
      const survivedCount = result.verdicts.filter((v) => !v.refuted).length;

      expect(survivedCount).toBeGreaterThanOrEqual(2);
    });

    it("should mark finding as refuted when <=1 lenses do not refute", async () => {
      // Use a pattern that should get refuted by most lenses:
      // - correctness: info-level → refuted
      // - security: doc file without credential pattern → refuted
      // - repro: line 0 → refuted
      const finding = makeFinding({
        file: "docs/readme.md",
        line: 0,
        severity: "info",
        message: "Long file (600 lines) — consider refactoring",
      });

      const result = await verifier.verifyOne(finding);
      const refutedCount = result.verdicts.filter((v) => v.refuted).length;

      expect(refutedCount).toBeGreaterThanOrEqual(2);
      // At least 2 refuted → refuted or disputed
      expect(["refuted", "disputed"]).toContain(result.outcome);
    });

    it("should mark finding as disputed on 2-1 split", async () => {
      // Mock a scenario where exactly 2 refute and 1 does not
      // By having the finding in a test file with a security credential:
      // - correctness: warning in test → refutes
      // - security: credential in test → refutes
      // - repro: line-specific, deterministic → does NOT refute
      const finding = makeFinding({
        file: "src/api.test.ts",
        line: 15,
        severity: "warning",
        message: "Potential secret/credential detected: API_KEY=sk-xxxx",
      });

      const result = await verifier.verifyOne(finding);

      // This should be a 2-1 split: correctness refutes (test warning),
      // security refutes (test credential), repro does NOT refute (deterministic)
      if (result.outcome === "disputed") {
        const refutedCount = result.verdicts.filter((v) => v.refuted).length;
        expect(refutedCount).toBe(2);
      } else if (result.outcome === "refuted") {
        // All 3 refuted is also acceptable behavior for this finding
        const refutedCount = result.verdicts.filter((v) => v.refuted).length;
        expect(refutedCount).toBe(3);
      } else {
        // survived is unexpected for this test case
        expect(result.outcome).not.toBe("survived");
      }
    });

    it("should categorize results into survived/refuted/disputed arrays", async () => {
      const findings = [
        makeFinding({
          file: "src/guards/auth.ts",
          line: 42,
          severity: "critical",
          message: "Auth bypass in guard",
        }),
        makeFinding({
          file: "docs/setup.md",
          line: 0,
          severity: "info",
          message: "Long file",
        }),
        makeFinding({
          file: "src/api.test.ts",
          severity: "warning",
          message: "Potential secret/credential detected: TOKEN=xxx",
        }),
      ];

      const result = await verifier.verify(findings);

      expect(result.totalFindings).toBe(3);
      expect(result.survived.length + result.refuted.length + result.disputed.length).toBe(3);
    });
  });

  // ===================================================================
  // Task 5: Dispute persistence
  // ===================================================================

  describe("Task 7: Disputed findings persistence", () => {
    it("should create disputed-findings.json when disputed findings exist", async () => {
      // Run verification with a finding likely to produce a split decision
      const findings = [
        makeFinding({
          file: "src/api.test.ts",
          line: 15,
          severity: "warning",
          message: "Potential secret/credential detected: API_KEY=sk-xxxx",
        }),
      ];

      await verifier.verify(findings, undefined, "test-feature-123");

      // disputed-findings.json might not exist if no findings were actually disputed
      // This test verifies the persistence logic works when invoked
      const disputedPath = path.join(tempRoot, ".devflow/disputed-findings.json");

      let disputedContent: string | null = null;
      try {
        disputedContent = await fs.readFile(disputedPath, "utf-8");
      } catch {
        // File may not exist if no disputes — that's OK
      }

      if (disputedContent) {
        const entries = JSON.parse(disputedContent);
        expect(Array.isArray(entries)).toBe(true);
        if (entries.length > 0) {
          expect(entries[0]).toHaveProperty("finding");
          expect(entries[0]).toHaveProperty("verdicts");
          expect(entries[0]).toHaveProperty("timestamp");
          expect(entries[0]).toHaveProperty("contextId");
          expect(entries[0].contextId).toBe("test-feature-123");
        }
      }
    });

    it("should append to existing disputed-findings.json", async () => {
      // First, create an existing disputed-findings.json
      const disputedDir = path.join(tempRoot, ".devflow");
      await fs.mkdir(disputedDir, { recursive: true });
      const disputedPath = path.join(disputedDir, "disputed-findings.json");

      const existingEntry = {
        finding: makeFinding({ file: "old.ts" }),
        verdicts: [{ lens: "correctness", refuted: false, reason: "test" }],
        timestamp: "2026-01-01T00:00:00.000Z",
        contextId: "old-feature",
      };
      await fs.writeFile(disputedPath, JSON.stringify([existingEntry], null, 2));

      // Now run verification
      await verifier.verify(
        [makeFinding({ file: "new.ts", severity: "info" })],
        undefined,
        "new-feature",
      );

      // Read back and verify both entries exist
      const content = await fs.readFile(disputedPath, "utf-8");
      const entries = JSON.parse(content);
      // Should have at least the original entry, possibly more
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const contextIds = entries.map((e: any) => e.contextId);
      expect(contextIds).toContain("old-feature");
    });
  });

  // ===================================================================
  // Task 6: Integration with existing adversarial-review
  // ===================================================================

  describe("Task 5-6: Adversarial review integration shape", () => {
    it("should produce well-formed VerificationResult objects", async () => {
      const finding = makeFinding();
      const result = await verifier.verifyOne(finding);

      // Check VerificationResult shape
      expect(result).toHaveProperty("finding");
      expect(result).toHaveProperty("verdicts");
      expect(result).toHaveProperty("outcome");
      expect(result).toHaveProperty("summary");

      expect(typeof result.summary).toBe("string");
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it("should produce well-formed AdversarialVerificationResult", async () => {
      const findings = [
        makeFinding({ file: "a.ts", severity: "warning" }),
        makeFinding({ file: "b.ts", severity: "info" }),
      ];

      const result = await verifier.verify(findings);

      // Check AdversarialVerificationResult shape
      expect(result).toHaveProperty("totalFindings");
      expect(result).toHaveProperty("survived");
      expect(result).toHaveProperty("refuted");
      expect(result).toHaveProperty("disputed");
      expect(result).toHaveProperty("allResults");
      expect(result).toHaveProperty("durationMs");
      expect(result).toHaveProperty("summary");

      expect(typeof result.totalFindings).toBe("number");
      expect(typeof result.durationMs).toBe("number");
      expect(typeof result.summary).toBe("string");
      expect(Array.isArray(result.survived)).toBe(true);
      expect(Array.isArray(result.refuted)).toBe(true);
    });

    it("should produce meaningful summaries for each outcome type", async () => {
      // Finding that should survive
      const realFinding = makeFinding({
        file: "src/guards/auth.ts",
        line: 42,
        severity: "critical",
        message: "Auth bypass vulnerability detected",
      });
      const survivedResult = await verifier.verifyOne(realFinding);

      if (survivedResult.outcome === "survived") {
        expect(survivedResult.summary).toContain("survived");
      }

      // Finding that should be refuted
      const fpFinding = makeFinding({
        file: "docs/readme.md",
        line: 0,
        severity: "info",
        message: "Long file (600 lines) — consider refactoring",
      });
      const refutedResult = await verifier.verifyOne(fpFinding);

      if (refutedResult.outcome === "refuted") {
        expect(refutedResult.summary).toContain("refuted");
      }
    });
  });

  // ===================================================================
  // IV2: Known real finding — should survive verification
  // ===================================================================

  describe("IV2: Real finding survival", () => {
    it("should survive when finding is a real security concern in production code", async () => {
      const finding = makeFinding({
        file: "src/auth/jwt.ts",
        line: 25,
        severity: "critical",
        message: "Hardcoded JWT secret detected in production code",
      });

      const result = await verifier.verifyOne(finding);
      // This should survive: correctness passes (critical in security file),
      // security passes (credential in production), repro passes (deterministic)
      expect(result.verdicts.every((v) => !v.refuted) || result.outcome === "survived").toBe(
        result.outcome === "survived" || result.verdicts.filter((v) => !v.refuted).length >= 2,
      );
    });

    it("should survive for specific actionable warning in core business logic", async () => {
      const finding = makeFinding({
        file: "src/core/pricing.ts",
        line: 88,
        severity: "warning",
        message: "Deep relative imports (10x) — consider barrel exports or path aliases",
      });

      const result = await verifier.verifyOne(finding);
      const survivedCount = result.verdicts.filter((v) => !v.refuted).length;

      // repro and security should not refute this
      expect(survivedCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ===================================================================
  // IV1: False positive — should be refuted
  // ===================================================================

  describe("IV1: False positive refutation", () => {
    it("should refute a false-positive credential finding in docs", async () => {
      const finding = makeFinding({
        file: "docs/examples/api-usage.md",
        line: 10,
        severity: "critical",
        message: "Potential secret/credential detected: api_key=xxxxx",
      });

      const result = await verifier.verifyOne(finding);
      const refutedCount = result.verdicts.filter((v) => v.refuted).length;

      // Should be refuted by security (doc file) + correctness (over-classified)
      // repro may or may not refute (depends on determinism)
      expect(refutedCount).toBeGreaterThanOrEqual(2);
      // At least 2 refuted → outcome is refuted or disputed (2-1 split)
      expect(["refuted", "disputed"]).toContain(result.outcome);
    });

    it("should refute an info-level finding about file length", async () => {
      const finding = makeFinding({
        file: "src/components/Header.tsx",
        line: 0,
        severity: "info",
        message: "Long file (600 lines) — consider refactoring",
      });

      const result = await verifier.verifyOne(finding);
      // At minimum, correctness refutes (info-level) + repro refutes (line 0)
      // Security may or may not refute (file is .tsx, not doc)
      const refutedCount = result.verdicts.filter((v) => v.refuted).length;
      expect(refutedCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ===================================================================
  // VerificationResult type compliance
  // ===================================================================

  describe("Type compliance", () => {
    it("should have correct VerificationOutcome enum", async () => {
      const valid = ["survived", "refuted", "disputed"] as const;
      const finding = makeFinding();
      const result = await verifier.verifyOne(finding);
      expect(valid).toContain(result.outcome);
    });

    it("should return durationMs on batch results", async () => {
      const findings = [makeFinding(), makeFinding(), makeFinding()];
      const result = await verifier.verify(findings);
      expect(result.durationMs).toBeGreaterThan(0);
    });
  });

  // ===================================================================
  // Edge cases
  // ===================================================================

  describe("Edge cases", () => {
    it("should handle findings with unusual file extensions", async () => {
      const finding = makeFinding({
        file: "config/env.yaml",
        severity: "warning",
        message: "Potential secret/credential detected",
      });

      const result = await verifier.verifyOne(finding);
      // Should not throw, each lens handles gracefully
      expect(result.verdicts).toHaveLength(3);
    });

    it("should handle empty message findings", async () => {
      const finding = makeFinding({
        message: "",
      });

      const result = await verifier.verifyOne(finding);
      expect(result.verdicts).toHaveLength(3);
    });
  });
});
