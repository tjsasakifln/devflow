import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock execSync before importing the module
const mockExecSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({
  execSync: mockExecSync,
}));

// Now import after mocks are set up
const { validateOOQuality } = await import("../../src/kernel/validators/oo.js");

describe("validateOOQuality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("circular dependency check (madge)", () => {
    it("detects circular dependencies when madge finds them", () => {
      mockExecSync.mockReturnValueOnce(`
src/a.ts → src/b.ts → src/a.ts
src/x.ts → src/y.ts
      `);
      // eslint complexity pass
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      // dependency-cruiser pass
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      // find passes for cohesion
      mockExecSync.mockReturnValueOnce("10"); // dir count
      mockExecSync.mockReturnValueOnce("15"); // file count

      const result = validateOOQuality("/fake/project");
      expect(result.metrics.circularDeps).toBeGreaterThanOrEqual(1);
      const circViolation = result.violations.find(
        (v) => v.type === "circular",
      );
      expect(circViolation).toBeDefined();
      expect(circViolation!.severity).toBe("error");
    });

    it("sets circularDeps to 0 when no circular deps found", () => {
      mockExecSync.mockReturnValueOnce("No circular dependencies found!");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10"); // dir count
      mockExecSync.mockReturnValueOnce("15"); // file count

      const result = validateOOQuality("/fake/project");
      expect(result.metrics.circularDeps).toBe(0);
      const circViolation = result.violations.find(
        (v) => v.type === "circular",
      );
      expect(circViolation).toBeUndefined();
    });

    it("handles madge not available gracefully", () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error("command not found");
      });
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      const circViolation = result.violations.find(
        (v) => v.type === "circular",
      );
      expect(circViolation).toBeDefined();
      expect(circViolation!.severity).toBe("warn");
      expect(circViolation!.description).toContain("skipped");
    });
  });

  describe("complexity and size check (ESLint)", () => {
    it("reports complexity violations exceeding threshold", () => {
      // madge pass
      mockExecSync.mockReturnValueOnce("No circular");
      // eslint pass
      mockExecSync.mockReturnValueOnce(
        JSON.stringify([
          {
            filePath: "/fake/project/src/test.ts",
            messages: [
              {
                ruleId: "complexity",
                message: "Function has complexity of 15",
                line: 10,
              },
            ],
          },
        ]),
      );
      // dependency-cruiser pass
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project", {
        maxComplexity: 10,
      });
      expect(result.metrics.maxComplexity).toBe(15);
      expect(result.metrics.avgComplexity).toBe(15);
      const complexityViolation = result.violations.find(
        (v) => v.type === "complexity",
      );
      expect(complexityViolation).toBeDefined();
      expect(complexityViolation!.severity).toBe("error");
    });

    it("reports size violations from max-lines rules", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(
        JSON.stringify([
          {
            filePath: "/fake/project/src/huge.ts",
            messages: [
              {
                ruleId: "max-lines",
                message: "File exceeds max lines",
                line: 1,
              },
            ],
          },
        ]),
      );
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      expect(result.metrics.filesOverSizeLimit).toBe(1);
      const sizeViolation = result.violations.find(
        (v) => v.type === "size",
      );
      expect(sizeViolation).toBeDefined();
      expect(sizeViolation!.severity).toBe("error");
    });

    it("handles complex project type without violations", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      expect(result.pass).toBe(true);
    });

    it("handles ESLint not available gracefully", () => {
      mockExecSync.mockImplementationOnce(() => "No circular");
      mockExecSync.mockImplementationOnce(() => {
        throw new Error("eslint not found");
      });
      // No more calls after eslint fails — eslint catch block
      // But dependency-cruiser and find calls still need to exist
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      const complexityViolation = result.violations.find(
        (v) => v.type === "complexity",
      );
      expect(complexityViolation).toBeDefined();
      expect(complexityViolation!.severity).toBe("warn");
    });

    it("handles ESLint JSON parse failure gracefully", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      // Return non-JSON to trigger parse failure
      mockExecSync.mockReturnValueOnce("Non-JSON output");
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      // Should not crash — parse failure just means no results
      expect(result.violations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("coupling check (dependency-cruiser)", () => {
    it("computes average coupling from modules", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({
          modules: [
            { dependencies: [{ id: "a" }, { id: "b" }] },
            { dependencies: [{ id: "c" }] },
          ],
        }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      expect(result.metrics.coupling).toBeCloseTo(1.5, 1);
    });

    it("reports coupling violation when above threshold", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({
          modules: [
            { dependencies: [{ id: "a" }, { id: "b" }] },
            { dependencies: [{ id: "c" }, { id: "d" }] },
          ],
        }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project", {
        maxCoupling: 1,
      });
      const couplingViolation = result.violations.find(
        (v) => v.type === "coupling",
      );
      expect(couplingViolation).toBeDefined();
      expect(couplingViolation!.severity).toBe("error");
    });

    it("reports low cohesion when too many modules have high coupling", () => {
      // Create 10 modules, 4 with high coupling (>1)
      const modules = Array.from({ length: 10 }, (_, i) => ({
        dependencies: i < 4 ? Array.from({ length: 5 }, () => ({ id: `dep${i}` })) : [],
      }));

      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project", {
        maxCoupling: 1,
      });
      const cohesionViolation = result.violations.find(
        (v) => v.type === "cohesion" && v.description.includes("high coupling"),
      );
      expect(cohesionViolation).toBeDefined();
      expect(cohesionViolation!.severity).toBe("warn");
    });

    it("handles dependency-cruiser missing gracefully", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockImplementationOnce(() => {
        throw new Error("dc not found");
      });
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      // Should not crash
      expect(result.metrics.coupling).toBeNull();
    });
  });

  describe("cohesion score (heuristic)", () => {
    it("computes cohesion score when files per dir <= 15", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10"); // dirs
      mockExecSync.mockReturnValueOnce("10"); // files = 1 per dir

      const result = validateOOQuality("/fake/project");
      expect(result.metrics.cohesionScore).toBe(85);
    });

    it("computes lower cohesion score when files per dir > 20", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10"); // dirs
      mockExecSync.mockReturnValueOnce("300"); // 30 files/dir

      const result = validateOOQuality("/fake/project");
      expect(result.metrics.cohesionScore).toBeLessThan(85);
      const cohesionViolation = result.violations.find(
        (v) => v.type === "cohesion" && v.description.includes("cohesion"),
      );
      expect(cohesionViolation).toBeDefined();
    });

    it("handles edge case with 0 dirs or files gracefully", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("0"); // 0 dirs
      mockExecSync.mockReturnValueOnce("0"); // 0 files

      const result = validateOOQuality("/fake/project");
      expect(result.metrics.cohesionScore).toBeNull();
    });

    it("handles find command failure gracefully", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockImplementationOnce(() => {
        throw new Error("find not found");
      });

      const result = validateOOQuality("/fake/project");
      expect(result.metrics.cohesionScore).toBeNull();
    });
  });

  describe("overall result", () => {
    it("returns pass=true when no error violations", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      expect(result.pass).toBe(true);
    });

    it("returns pass=false when error violations exist", () => {
      mockExecSync.mockReturnValueOnce(`
src/a.ts → src/b.ts → src/a.ts
      `);
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      expect(result.pass).toBe(false);
    });

    it("summary reflects pass or fail state", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      mockExecSync.mockReturnValueOnce(
        JSON.stringify({ modules: [] }),
      );
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      expect(result.summary).toContain("acceptable");
    });
  });

  describe("dependency-cruiser JSON parse failure", () => {
    it("gracefully handles dc output that is not JSON", () => {
      mockExecSync.mockReturnValueOnce("No circular");
      mockExecSync.mockReturnValueOnce(JSON.stringify([]));
      // Return non-JSON for dc
      mockExecSync.mockReturnValueOnce("Not JSON output");
      mockExecSync.mockReturnValueOnce("10");
      mockExecSync.mockReturnValueOnce("15");

      const result = validateOOQuality("/fake/project");
      expect(result.metrics.coupling).toBeNull();
    });
  });
});
