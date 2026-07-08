import { describe, it, expect, vi } from "vitest";

// Mock fs for resolveDimensionsFromFile tests
const mockReadFile = vi.hoisted(() => vi.fn());
vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
}));

import { getDimensionByName, resolveDimensions, computeDefaultMaxParallel, DEFAULT_DIMENSIONS } from "../../src/kernel/orchestration/dimensions.js";

describe("Dimensions", () => {
  describe("DEFAULT_DIMENSIONS", () => {
    it("has 6 predefined dimensions", () => {
      expect(DEFAULT_DIMENSIONS.length).toBe(6);
    });

    it("each dimension has name, description, and globPatterns", () => {
      for (const dim of DEFAULT_DIMENSIONS) {
        expect(dim.name).toBeTruthy();
        expect(dim.description).toBeTruthy();
        expect(Array.isArray(dim.globPatterns)).toBe(true);
        expect(dim.globPatterns.length).toBeGreaterThan(0);
      }
    });

    it("includes security dimension", () => {
      const sec = DEFAULT_DIMENSIONS.find(d => d.name === "security");
      expect(sec).toBeDefined();
      expect(sec!.globPatterns).toContain("**/auth/**");
    });

    it("includes architecture dimension", () => {
      const arch = DEFAULT_DIMENSIONS.find(d => d.name === "architecture");
      expect(arch).toBeDefined();
      expect(arch!.globPatterns).toContain("**/src/kernel/**");
    });
  });

  describe("getDimensionByName", () => {
    it("returns dimension definition for valid name", () => {
      const dim = getDimensionByName("security");
      expect(dim).toBeDefined();
      expect(dim!.name).toBe("security");
    });

    it("returns undefined for unknown name", () => {
      const dim = getDimensionByName("nonexistent");
      expect(dim).toBeUndefined();
    });

    it("is case-sensitive", () => {
      const dim = getDimensionByName("Security");
      expect(dim).toBeUndefined();
    });
  });

  describe("resolveDimensions", () => {
    it("resolves single dimension", () => {
      const dims = resolveDimensions(["security"]);
      expect(dims).toHaveLength(1);
      expect(dims[0].name).toBe("security");
    });

    it("resolves multiple dimensions", () => {
      const dims = resolveDimensions(["security", "performance", "tests"]);
      expect(dims).toHaveLength(3);
      expect(dims.map(d => d.name)).toEqual(["security", "performance", "tests"]);
    });

    it("throws for unknown dimension", () => {
      expect(() => resolveDimensions(["unknown"])).toThrow("Unknown dimension");
    });

    it("throws with available dimensions listed", () => {
      expect(() => resolveDimensions(["bad"])).toThrow(/security/);
      expect(() => resolveDimensions(["bad"])).toThrow(/performance/);
    });

    it("trims whitespace from names", () => {
      const dims = resolveDimensions(["  security  "]);
      expect(dims).toHaveLength(1);
      expect(dims[0].name).toBe("security");
    });
  });

  describe("computeDefaultMaxParallel", () => {
    it("returns a positive integer", () => {
      const result = computeDefaultMaxParallel();
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
    });

    it("is capped at maximum 16", () => {
      const result = computeDefaultMaxParallel();
      expect(result).toBeLessThanOrEqual(16);
    });
  });

  describe("resolveDimensionsFromFile", () => {
    beforeEach(() => {
      mockReadFile.mockReset();
    });

    it("resolves dimensions from a JSON file with array", async () => {
      const { resolveDimensionsFromFile } = await import(
        "../../src/kernel/orchestration/dimensions.js"
      );
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify([
          { name: "custom", description: "Custom dimension", globPatterns: ["**/*.ts"] },
        ]),
      );

      const result = await resolveDimensionsFromFile("/fake/config.json");
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("custom");
    });

    it("resolves dimensions from JSON with dimensions key", async () => {
      const { resolveDimensionsFromFile } = await import(
        "../../src/kernel/orchestration/dimensions.js"
      );
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          dimensions: [
            { name: "custom", description: "Custom dimension", globPatterns: ["**/*.ts"] },
          ],
        }),
      );

      const result = await resolveDimensionsFromFile("/fake/config.json");
      expect(result).toHaveLength(1);
    });

    it("falls back to YAML parsing for .yaml files", async () => {
      const { resolveDimensionsFromFile } = await import(
        "../../src/kernel/orchestration/dimensions.js"
      );
      const yamlContent =
        "dimensions:\n  - name: custom\n    description: Custom\n    globPatterns:\n      - '**/*.ts'\n";
      mockReadFile.mockResolvedValueOnce(yamlContent);

      const result = await resolveDimensionsFromFile("/fake/config.yaml");
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("custom");
    });

    it("throws when YAML parsing also fails", async () => {
      const { resolveDimensionsFromFile } = await import(
        "../../src/kernel/orchestration/dimensions.js"
      );
      mockReadFile.mockResolvedValueOnce("not: valid: yaml: [");

      await expect(
        resolveDimensionsFromFile("/fake/config.yaml"),
      ).rejects.toThrow("Could not parse dimension config");
    });

    it("throws when JSON is valid but not the expected shape", async () => {
      const { resolveDimensionsFromFile } = await import(
        "../../src/kernel/orchestration/dimensions.js"
      );
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ notDimensions: true }),
      );

      await expect(
        resolveDimensionsFromFile("/fake/config.json"),
      ).rejects.toThrow("Invalid dimension config format");
    });
  });
});
