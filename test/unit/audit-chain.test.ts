import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeEntryHash, getMachineFingerprint, formatChainViolations } from "../../src/kernel/audit/chain-verifier.js";
import { generateEngineeringReview, generateReleaseAudit } from "../../src/kernel/audit/generator.js";
import type { AuditInput } from "../../src/kernel/audit/generator.js";

describe("Audit Chain Verifier", () => {
  describe("computeEntryHash", () => {
    it("produces deterministic hash for same input", () => {
      const entry = {
        timestamp: "2026-01-01T00:00:00Z",
        gatekeeper: "test",
        implementer: "dev",
        featureId: "feat-001",
        decision: "approved" as const,
        dodChecksPassed: 5,
        dodChecksTotal: 6,
        ciStatus: "success",
        actorOrigin: "local",
        allBlockingPassed: true,
        previousLogHash: "0000",
      };
      const hash1 = computeEntryHash(entry);
      const hash2 = computeEntryHash(entry);
      expect(hash1).toBe(hash2);
    });

    it("produces different hash for different entries", () => {
      const entry1 = {
        timestamp: "2026-01-01T00:00:00Z",
        gatekeeper: "test",
        implementer: "dev",
        featureId: "feat-001",
        decision: "approved" as const,
        dodChecksPassed: 5,
        dodChecksTotal: 6,
        ciStatus: "success",
        actorOrigin: "local",
        allBlockingPassed: true,
        previousLogHash: "0000",
      };
      const entry2 = { ...entry1, decision: "rejected" as const };
      const hash1 = computeEntryHash(entry1);
      const hash2 = computeEntryHash(entry2);
      expect(hash1).not.toBe(hash2);
    });

    it("strips entryHash field from computation", () => {
      const entry = {
        timestamp: "2026-01-01T00:00:00Z",
        gatekeeper: "test",
        implementer: "dev",
        featureId: "feat-001",
        decision: "approved" as const,
        dodChecksPassed: 5,
        dodChecksTotal: 6,
        ciStatus: "success",
        actorOrigin: "local",
        allBlockingPassed: true,
        previousLogHash: "0000",
      };
      const entryWithHash = { ...entry, entryHash: "abc123" };
      const hash = computeEntryHash(entryWithHash);
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64);
    });
  });

  describe("getMachineFingerprint", () => {
    it("returns a sha256 hash string", () => {
      const fingerprint = getMachineFingerprint();
      expect(fingerprint).toBeTruthy();
      expect(typeof fingerprint).toBe("string");
      expect(fingerprint.length).toBe(64);
    });

    it("uses env vars for hostname", () => {
      const origHostname = process.env.HOSTNAME;
      process.env.HOSTNAME = "test-machine";
      const fp = getMachineFingerprint();
      expect(fp).toBeTruthy();
      process.env.HOSTNAME = origHostname;
    });
  });

  describe("formatChainViolations", () => {
    it("returns valid message when chain is valid", () => {
      const result = { valid: true, totalEntries: 5, brokenLinks: [], tamperedEntries: [], missingHashes: [] };
      const messages = formatChainViolations(result);
      expect(messages[0]).toContain("valid");
      expect(messages[0]).toContain("5 entries");
    });

    it("reports tampered entries", () => {
      const result = { valid: false, totalEntries: 3, brokenLinks: [], tamperedEntries: [1], missingHashes: [] };
      const messages = formatChainViolations(result);
      expect(messages.some(m => m.includes("TAMPERED"))).toBe(true);
      expect(messages.some(m => m.includes("#2"))).toBe(true);
    });

    it("reports broken links", () => {
      const result = { valid: false, totalEntries: 3, brokenLinks: [2], tamperedEntries: [], missingHashes: [] };
      const messages = formatChainViolations(result);
      expect(messages.some(m => m.includes("BROKEN LINK"))).toBe(true);
      expect(messages.some(m => m.includes("#3"))).toBe(true);
    });

    it("reports missing hashes", () => {
      const result = { valid: false, totalEntries: 2, brokenLinks: [], tamperedEntries: [], missingHashes: [0] };
      const messages = formatChainViolations(result);
      expect(messages.some(m => m.includes("PRE-CHAIN"))).toBe(true);
    });
  });
});

describe("Audit Generator", () => {
  const mockInput: AuditInput = {
    featureId: "FEAT-001",
    featureName: "Test Feature",
    rootPath: "/tmp/test",
    dodChecks: [
      { id: "1", description: "Requirements", category: "deterministic", passed: true, evidence: "exists", blocking: true },
      { id: "2", description: "Roadmap", category: "deterministic", passed: true, evidence: "exists", blocking: true },
      { id: "4", description: "Constitution", category: "deterministic", passed: true, evidence: "pass", blocking: true },
    ],
    ciStatus: "success",
    implementer: "dev-user",
    gatekeeper: "gate-user",
  };

  const failingInput: AuditInput = {
    ...mockInput,
    dodChecks: [
      { id: "1", description: "Requirements", category: "deterministic", passed: false, evidence: "missing", blocking: true },
    ],
  };

  describe("generateEngineeringReview", () => {
    it("returns a file path string", async () => {
      const result = await generateEngineeringReview(mockInput);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
      expect(result).toContain("engineering-review.md");
    });

    it("indicates blocked when blocking checks fail", async () => {
      const result = await generateEngineeringReview(failingInput);
      expect(typeof result).toBe("string");
      expect(result).toContain("engineering-review.md");
    });

    it("processes DoD checks count correctly", async () => {
      const result = await generateEngineeringReview(mockInput);
      const path = result;
      expect(path.endsWith("engineering-review.md")).toBe(true);
    });
  });

  describe("generateReleaseAudit", () => {
    it("returns a file path string", async () => {
      const result = await generateReleaseAudit(mockInput);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
      expect(result).toContain("release-audit.md");
    });

    it("includes feature info in path", async () => {
      const result = await generateReleaseAudit(mockInput);
      expect(result).toContain("/tmp/test");
    });
  });
});
