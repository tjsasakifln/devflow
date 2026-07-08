import { describe, it, expect } from "vitest";
import {
  DEFAULT_DIMENSIONS,
  getDimensionByName,
  resolveDimensions,
  computeDefaultMaxParallel,
} from "../../src/kernel/orchestration/dimensions.js";

// Mock os for computeDefaultMaxParallel
vi.mock("node:os", () => {
  const cpus = () => Array(8).fill({}); // 8 cores for default test
  return {
    default: { cpus, tmpdir: () => "/tmp" },
    cpus,
    tmpdir: () => "/tmp",
  };
});

describe("DEFAULT_DIMENSIONS", () => {
  it("should have exactly 6 default dimensions", () => {
    expect(DEFAULT_DIMENSIONS).toHaveLength(6);
  });

  it("should have all expected dimension names", () => {
    const names = DEFAULT_DIMENSIONS.map((d) => d.name);
    expect(names).toContain("security");
    expect(names).toContain("performance");
    expect(names).toContain("architecture");
    expect(names).toContain("tests");
    expect(names).toContain("docs");
    expect(names).toContain("deps");
  });

  it("should have glob patterns for each dimension", () => {
    for (const dim of DEFAULT_DIMENSIONS) {
      expect(dim.globPatterns.length).toBeGreaterThan(0);
      expect(dim.description).toBeTruthy();
    }
  });

  it("should have dimension-specific glob patterns", () => {
    const security = DEFAULT_DIMENSIONS.find((d) => d.name === "security");
    expect(security!.globPatterns).toContain("**/auth/**");
    expect(security!.globPatterns).toContain("**/guards/**");

    const tests = DEFAULT_DIMENSIONS.find((d) => d.name === "tests");
    expect(tests!.globPatterns).toContain("**/*.test.ts");
    expect(tests!.globPatterns).toContain("**/*.spec.ts");

    const deps = DEFAULT_DIMENSIONS.find((d) => d.name === "deps");
    expect(deps!.globPatterns).toContain("package.json");
  });
});

describe("getDimensionByName", () => {
  it("should return dimension by name", () => {
    const dim = getDimensionByName("security");
    expect(dim).toBeDefined();
    expect(dim!.name).toBe("security");
  });

  it("should return undefined for unknown dimension", () => {
    const dim = getDimensionByName("nonexistent");
    expect(dim).toBeUndefined();
  });

  it("should be case-sensitive", () => {
    const dim = getDimensionByName("Security");
    expect(dim).toBeUndefined();
  });
});

describe("resolveDimensions", () => {
  it("should resolve valid dimension names", () => {
    const dims = resolveDimensions(["security", "performance"]);
    expect(dims).toHaveLength(2);
    expect(dims[0]!.name).toBe("security");
    expect(dims[1]!.name).toBe("performance");
  });

  it("should throw on unknown dimension name", () => {
    expect(() => resolveDimensions(["unknown"])).toThrow("Unknown dimension");
  });

  it("should throw with helpful error listing available dimensions", () => {
    try {
      resolveDimensions(["unknown"]);
      expect.fail("Should have thrown");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain("unknown");
      expect(msg).toContain("security");
      expect(msg).toContain("performance");
    }
  });

  it("should handle single dimension", () => {
    const dims = resolveDimensions(["tests"]);
    expect(dims).toHaveLength(1);
    expect(dims[0]!.name).toBe("tests");
  });

  it("should trim whitespace from names", () => {
    const dims = resolveDimensions(["  security ", " performance "]);
    expect(dims).toHaveLength(2);
  });

  it("should return empty array for empty input", () => {
    const dims = resolveDimensions([]);
    expect(dims).toEqual([]);
  });
});

describe("computeDefaultMaxParallel", () => {
  it("should compute max parallel based on CPU count", () => {
    const max = computeDefaultMaxParallel();
    // 8 cores - 2 = 6, min(16, 6) = 6
    expect(max).toBe(6);
  });
});
