import { describe, it, expect } from "vitest";
import { resolvePhaseName, PHASE_ALIASES, NEW_PHASE_NAMES } from "../../src/kernel/discovery/orchestrator.js";

describe("Discovery Orchestrator — Phase Aliasing", () => {
  describe("resolvePhaseName", () => {
    it("resolves old phase names to themselves", () => {
      expect(resolvePhaseName("scout")).toBe("scout");
      expect(resolvePhaseName("archaeologist")).toBe("archaeologist");
      expect(resolvePhaseName("detective")).toBe("detective");
      expect(resolvePhaseName("architect")).toBe("architect");
      expect(resolvePhaseName("writer")).toBe("writer");
    });

    it("resolves new verb aliases to canonical names", () => {
      expect(resolvePhaseName("scan")).toBe("scout");
      expect(resolvePhaseName("analyze")).toBe("archaeologist");
      expect(resolvePhaseName("deduce")).toBe("detective");
      expect(resolvePhaseName("design")).toBe("architect");
      expect(resolvePhaseName("document")).toBe("writer");
    });

    it("is case-insensitive", () => {
      expect(resolvePhaseName("SCAN")).toBe("scout");
      expect(resolvePhaseName("Analyze")).toBe("archaeologist");
      expect(resolvePhaseName("DEDUCE")).toBe("detective");
      expect(resolvePhaseName("Scan")).toBe("scout");
    });

    it("returns undefined for unrecognized names", () => {
      expect(resolvePhaseName("unknown")).toBeUndefined();
      expect(resolvePhaseName("")).toBeUndefined();
      expect(resolvePhaseName("scanner")).toBeUndefined();
      expect(resolvePhaseName("dig")).toBeUndefined();
    });

    it("trims whitespace", () => {
      expect(resolvePhaseName("  scout  ")).toBe("scout");
      expect(resolvePhaseName("  scan  ")).toBe("scout");
    });
  });

  describe("PHASE_ALIASES map", () => {
    it("contains all 5 old names", () => {
      expect(PHASE_ALIASES["scout"]).toBe("scout");
      expect(PHASE_ALIASES["archaeologist"]).toBe("archaeologist");
      expect(PHASE_ALIASES["detective"]).toBe("detective");
      expect(PHASE_ALIASES["architect"]).toBe("architect");
      expect(PHASE_ALIASES["writer"]).toBe("writer");
    });

    it("contains all 5 new aliases", () => {
      expect(PHASE_ALIASES["scan"]).toBe("scout");
      expect(PHASE_ALIASES["analyze"]).toBe("archaeologist");
      expect(PHASE_ALIASES["deduce"]).toBe("detective");
      expect(PHASE_ALIASES["design"]).toBe("architect");
      expect(PHASE_ALIASES["document"]).toBe("writer");
    });

    it("has exactly 10 entries (5 old + 5 new)", () => {
      expect(Object.keys(PHASE_ALIASES).length).toBe(10);
    });
  });

  describe("NEW_PHASE_NAMES", () => {
    it("contains the 5 new names", () => {
      expect(NEW_PHASE_NAMES).toEqual(["scan", "analyze", "deduce", "design", "document"]);
    });
  });
});
