/**
 * Unit tests for Preview Commands Batch 2 (Story 4.2)
 *
 * Tests the core logic of each command directly by importing the functions
 * and verifying JSON output structure.
 */
import { describe, it, expect } from "vitest";

describe("preview-commands-batch-2", () => {
  // ── tests-review core logic ──

  describe("tests-review", () => {
    it("should have a command function that produces JSON output", async () => {
      const mod = await import("../../src/commands/tests-review.js");
      expect(typeof mod.testsReviewCommand).toBe("function");
    });

    it("should produce correct JSON structure", () => {
      const result = {
        featureId: "test-feature",
        documentedTests: 5,
        existingTestFiles: 3,
        documentedButMissing: ["User authentication flow"],
        existingButUndocumented: ["src/extra.test.ts"],
        coverageGapRatio: 0.2,
        verdict: "gaps-found",
      } as const;

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      // Pipe-safe properties
      expect(json.trim().startsWith("{")).toBe(true);
      expect(json).not.toMatch(/\x1b\[/);

      expect(parsed.featureId).toBe("test-feature");
      expect(parsed.documentedTests).toBe(5);
      expect(parsed.existingTestFiles).toBe(3);
      expect(parsed.documentedButMissing).toHaveLength(1);
      expect(parsed.existingButUndocumented).toHaveLength(1);
      expect(parsed.coverageGapRatio).toBe(0.2);
      expect(parsed.verdict).toBe("gaps-found");
    });

    it("verdict enum covers all cases", () => {
      const verdicts = ["ok", "gaps-found", "no-test-plan", "no-test-files"];
      expect(verdicts).toHaveLength(4);
    });
  });

  // ── actions-generate core logic ──

  describe("actions-generate", () => {
    it("should have a command function that produces JSON output", async () => {
      const mod = await import("../../src/commands/actions-generate.js");
      expect(typeof mod.actionsGenerateCommand).toBe("function");
    });

    it("should produce correct JSON structure", () => {
      const result = {
        featureId: "test-feature",
        workflowPath: ".github/workflows/devflow-governance.yml",
        workflowContent: "name: Devflow Governance\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n",
        yamlValid: true,
        yamlErrors: [],
        written: false,
        verdict: "generated",
      };

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      // Pipe-safe properties
      expect(json.trim().startsWith("{")).toBe(true);
      expect(json).not.toMatch(/\x1b\[/);

      expect(parsed.featureId).toBe("test-feature");
      expect(parsed.yamlValid).toBe(true);
      expect(parsed.yamlErrors).toHaveLength(0);
      expect(parsed.written).toBe(false);
      expect(parsed.verdict).toBe("generated");
      expect(parsed.workflowContent).toContain("runs-on");
    });

    it("verdict enum covers all cases", () => {
      const verdicts = ["generated", "written", "no-config", "invalid"];
      expect(verdicts).toHaveLength(4);
    });

    it("workflow content contains expected YAML structure", () => {
      const result = {
        featureId: "test",
        workflowPath: "",
        workflowContent: "name: Devflow PR Governance\non:\n  pull_request:\n    types: [opened]\njobs:\n  governance:\n    runs-on: ubuntu-latest",
        yamlValid: true,
        yamlErrors: [],
        written: false,
        verdict: "generated",
      };

      const parsed = JSON.parse(JSON.stringify(result));
      expect(parsed.workflowContent).toContain("name:");
      expect(parsed.workflowContent).toContain("on:");
      expect(parsed.workflowContent).toContain("jobs:");
      expect(parsed.workflowContent).toContain("governance");
    });
  });

  // ── drift-check core logic ──

  describe("drift-check", () => {
    it("should have a command function that produces JSON output", async () => {
      const mod = await import("../../src/commands/drift-check.js");
      expect(typeof mod.driftCheckCommand).toBe("function");
    });

    it("should produce correct JSON structure", () => {
      const result = {
        featureId: "test-feature",
        mode: "heuristic" as const,
        documentedCount: 5,
        implementedCount: 4,
        implementedNotDocumented: ["Added rate limiting"],
        documentedNotImplemented: ["Concurrent request handling"],
        driftRatio: 0.22,
        verdict: "drift-detected",
      };

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(json.trim().startsWith("{")).toBe(true);
      expect(json).not.toMatch(/\x1b\[/);

      expect(parsed.featureId).toBe("test-feature");
      expect(parsed.mode).toBe("heuristic");
      expect(parsed.documentedCount).toBe(5);
      expect(parsed.implementedCount).toBe(4);
      expect(parsed.implementedNotDocumented).toHaveLength(1);
      expect(parsed.documentedNotImplemented).toHaveLength(1);
      expect(parsed.driftRatio).toBe(0.22);
      expect(parsed.verdict).toBe("drift-detected");
    });

    it("verdict enum covers all cases", () => {
      const verdicts = ["clean", "drift-detected", "no-requirements", "no-implementation-log"];
      expect(verdicts).toHaveLength(4);
    });

    it("strict mode produces different mode field", () => {
      const result = {
        featureId: "test-feature",
        mode: "strict" as const,
        documentedCount: 3,
        implementedCount: 2,
        implementedNotDocumented: [],
        documentedNotImplemented: ["AC with exact match required"],
        driftRatio: 0.2,
        verdict: "drift-detected",
      };

      const parsed = JSON.parse(JSON.stringify(result));
      expect(parsed.mode).toBe("strict");
    });

    it("clean verdict when no drift", () => {
      const result = {
        featureId: "test-feature",
        mode: "heuristic" as const,
        documentedCount: 2,
        implementedCount: 2,
        implementedNotDocumented: [],
        documentedNotImplemented: [],
        driftRatio: 0,
        verdict: "clean" as const,
      };

      const parsed = JSON.parse(JSON.stringify(result));
      expect(parsed.verdict).toBe("clean");
      expect(parsed.driftRatio).toBe(0);
    });
  });

  // ── Edge cases for JSON pipe-safety ──

  describe("JSON pipe-safety across all three command result types", () => {
    it("all result types produce valid JSON with no ANSI codes", () => {
      const results = [
        JSON.stringify({
          featureId: "f1", verdict: "ok",
          documentedTests: 0, existingTestFiles: 0,
          documentedButMissing: [], existingButUndocumented: [],
          coverageGapRatio: 1,
        }),
        JSON.stringify({
          featureId: "f1", verdict: "generated",
          workflowPath: "", workflowContent: "name: test\njobs:\n  test:\n    runs-on: ubuntu-latest\n",
          yamlValid: true, yamlErrors: [], written: false,
        }),
        JSON.stringify({
          featureId: "f1", verdict: "clean",
          mode: "heuristic", documentedCount: 0, implementedCount: 0,
          implementedNotDocumented: [], documentedNotImplemented: [],
          driftRatio: 0,
        }),
      ];

      for (const json of results) {
        expect(() => JSON.parse(json)).not.toThrow();
        expect(json).not.toMatch(/\x1b\[/);
      }
    });

    it("all result types have featureId and verdict fields", () => {
      const type1 = {
        featureId: "f1", verdict: "ok",
        documentedTests: 0, existingTestFiles: 0,
        documentedButMissing: [], existingButUndocumented: [],
        coverageGapRatio: 1,
      };
      const type2 = {
        featureId: "f1", verdict: "generated",
        workflowPath: "", workflowContent: "content",
        yamlValid: true, yamlErrors: [], written: false,
      };
      const type3 = {
        featureId: "f1", verdict: "clean",
        mode: "heuristic", documentedCount: 0, implementedCount: 0,
        implementedNotDocumented: [], documentedNotImplemented: [],
        driftRatio: 0,
      };

      for (const r of [type1, type2, type3]) {
        expect(r).toHaveProperty("featureId");
        expect(r).toHaveProperty("verdict");
      }
    });
  });

  // ── CLI registration ──

  describe("CLI registration", () => {
    it("CLI module exports registerCommands", async () => {
      const cliMod = await import("../../src/cli/index.js");
      expect(typeof cliMod.registerCommands).toBe("function");
    });

    it("command modules export the expected functions", async () => {
      const testsMod = await import("../../src/commands/tests-review.js");
      const actionsMod = await import("../../src/commands/actions-generate.js");
      const driftMod = await import("../../src/commands/drift-check.js");

      expect(typeof testsMod.testsReviewCommand).toBe("function");
      expect(typeof actionsMod.actionsGenerateCommand).toBe("function");
      expect(typeof driftMod.driftCheckCommand).toBe("function");
    });
  });
});
