/**
 * Unit tests for Tool Verifier (Story 1.4)
 *
 * Tests pre-flight tool checking, install commands, and blocked vector detection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (hoisted to avoid hoisting issues with vi.mock) ──

const mockExistsSync = vi.hoisted(() => vi.fn());
const mockExecSync = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execSync: mockExecSync,
}));

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
}));

// Import after mocks
import {
  getKnownTools,
  checkToolAvailability,
  runPreFlightCheck,
  formatToolTable,
  getBlockedVectorSet,
} from "../../src/kernel/checks/tool-verifier.js";

describe("Tool Verifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default platform to linux
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  });

  // ── getKnownTools ──

  describe("getKnownTools", () => {
    it("returns 3 known tools", () => {
      const tools = getKnownTools();
      expect(tools.length).toBe(3);
    });

    it("each tool has required fields", () => {
      for (const tool of getKnownTools()) {
        expect(tool.name).toBeTruthy();
        expect(tool.displayName).toBeTruthy();
        expect(tool.binaryNames.length).toBeGreaterThan(0);
        expect(tool.packageName).toBeTruthy();
        expect(tool.installHint).toBeTruthy();
      }
    });

    it("dependency-cruiser is used by Hidden Coupling vector", () => {
      const tool = getKnownTools().find((t) => t.name === "dependency-cruiser");
      expect(tool).toBeDefined();
      expect(tool!.usedByVectors).toContain("Hidden Coupling");
    });

    it("jscpd is used by Code Duplication vector", () => {
      const tool = getKnownTools().find((t) => t.name === "jscpd");
      expect(tool).toBeDefined();
      expect(tool!.usedByVectors).toContain("Code Duplication");
    });

    it("madge is known but not used by any vector", () => {
      const tool = getKnownTools().find((t) => t.name === "madge");
      expect(tool).toBeDefined();
      expect(tool!.usedByVectors).toEqual([]);
    });
  });

  // ── checkToolAvailability ──

  describe("checkToolAvailability", () => {
    const dependencyCruiser = {
      name: "dependency-cruiser",
      displayName: "Dependency Cruiser",
      binaryNames: ["dependency-cruiser", "depcruise"],
      packageName: "dependency-cruiser",
      usedByVectors: ["Hidden Coupling"],
      installHint: "npm install --save-dev dependency-cruiser",
    };

    it("returns available:true when binary found in node_modules/.bin/", async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue("16.0.0\n");

      const result = await checkToolAvailability(dependencyCruiser, "/test");

      expect(result.available).toBe(true);
      expect(result.version).toBe("16.0.0");
      expect(result.tool.name).toBe("dependency-cruiser");
      // Should check node_modules/.bin/dependency-cruiser first
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining("node_modules/.bin/dependency-cruiser"),
      );
    });

    it("returns available:true when binary found on PATH", async () => {
      // Not found in node_modules/.bin/
      mockExistsSync.mockReturnValue(false);
      // Found via which on PATH
      mockExecSync.mockReturnValue("/usr/local/bin/depcruise\n");

      const result = await checkToolAvailability(dependencyCruiser, "/test");

      expect(result.available).toBe(true);
      // which command was called
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("which"),
        expect.any(Object),
      );
    });

    it("returns available:false when binary not found anywhere", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      const result = await checkToolAvailability(dependencyCruiser, "/test");

      expect(result.available).toBe(false);
      expect(result.error).toContain("npm install --save-dev dependency-cruiser");
    });
  });

  // ── runPreFlightCheck ──

  describe("runPreFlightCheck", () => {
    it("returns allAvailable:true when all tools found", async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue("1.0.0\n");

      const result = await runPreFlightCheck("/test");

      expect(result.allAvailable).toBe(true);
      expect(result.missing.length).toBe(0);
      expect(result.tools.length).toBe(3);
      expect(result.blockedVectors.length).toBe(0);
    });

    it("returns blocked vectors when tools are missing", async () => {
      // dependency-cruiser: found
      // jscpd: not found
      // madge: not found
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes("dependency-cruiser") || path.includes("depcruise")) {
          return true;
        }
        return false;
      });
      // Only dependency-cruiser version succeeds
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("dependency-cruiser") || cmd.includes("depcruise")) {
          return "16.0.0\n";
        }
        throw new Error("not found");
      });

      const result = await runPreFlightCheck("/test");

      expect(result.allAvailable).toBe(false);
      expect(result.missing.length).toBe(2); // jscpd + madge
      expect(result.blockedVectors).toContain("Code Duplication");
      expect(result.blockedVectors).not.toContain("Hidden Coupling");
    });

    it("returns allAvailable:false when all tools missing", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      const result = await runPreFlightCheck("/test");

      expect(result.allAvailable).toBe(false);
      expect(result.missing.length).toBe(3);
      expect(result.blockedVectors).toContain("Hidden Coupling");
      expect(result.blockedVectors).toContain("Code Duplication");
    });
  });

  // ── getBlockedVectorSet ──

  describe("getBlockedVectorSet", () => {
    it("returns empty set when all tools available", async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue("1.0.0\n");

      const result = await runPreFlightCheck("/test");
      const blocked = getBlockedVectorSet(result);

      expect(blocked.size).toBe(0);
    });

    it("returns set with Code Duplication when jscpd missing", async () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes("jscpd")) return false;
        return true;
      });
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("jscpd")) throw new Error("not found");
        return "1.0.0\n";
      });

      const result = await runPreFlightCheck("/test");
      const blocked = getBlockedVectorSet(result);

      expect(blocked.has("Code Duplication")).toBe(true);
      expect(blocked.has("Hidden Coupling")).toBe(false);
    });
  });

  // ── formatToolTable ──

  describe("formatToolTable", () => {
    it("returns a formatted table string", async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue("1.0.0\n");

      const result = await runPreFlightCheck("/test");
      const table = formatToolTable(result);

      expect(table).toContain("Tool");
      expect(table).toContain("Status");
      expect(table).toContain("Dependency Cruiser");
      expect(table).toContain("jscpd");
      expect(table).toContain("OK");
    });

    it("contains install hints when tools are missing", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      const result = await runPreFlightCheck("/test");
      const table = formatToolTable(result);

      expect(table).toContain("MISS");
      expect(table).toContain("Install:");
      expect(table).toContain("2 vector(s) will be skipped");
    });
  });
});
