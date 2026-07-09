import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

import {
  recordBypassEvent,
  detectBypassPatterns,
  getQualityDebt,
  recordRelaxedTolerance,
  recordGatekeepSameActor,
  recordLowPassRate,
} from "../../src/kernel/tracking/bypass-detector.js";

function makeTempDir(): string {
  return fs.mkdtemp(path.join(os.tmpdir(), "bypass-test-"));
}

async function cleanupTempDir(tmpDir: string): Promise<void> {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

describe("bypass-detector", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tmpDir);
  });

  describe("recordBypassEvent", () => {
    it("should create bypass-log.jsonl on first write", async () => {
      await recordBypassEvent(tmpDir, {
        timestamp: "2026-07-08T00:00:00.000Z",
        featureId: "test-feature",
        patternType: "riskTolerance-relaxed",
        details: { message: "Test event" },
      });

      const logPath = path.join(tmpDir, ".devflow", "audits", "bypass-log.jsonl");
      const content = await fs.readFile(logPath, "utf-8");
      expect(content).toContain("test-feature");
      expect(content).toContain("riskTolerance-relaxed");
    });

    it("should append to existing log", async () => {
      await recordBypassEvent(tmpDir, {
        timestamp: "2026-07-08T00:00:00.000Z",
        featureId: "feature-1",
        patternType: "riskTolerance-relaxed",
        details: { message: "First" },
      });
      await recordBypassEvent(tmpDir, {
        timestamp: "2026-07-08T00:00:01.000Z",
        featureId: "feature-2",
        patternType: "gatekeep-same-actor",
        details: { message: "Second" },
      });

      const logPath = path.join(tmpDir, ".devflow", "audits", "bypass-log.jsonl");
      const content = await fs.readFile(logPath, "utf-8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(2);
    });
  });

  describe("detectBypassPatterns — empty log", () => {
    it("should return empty report when no log exists", async () => {
      const report = await detectBypassPatterns(tmpDir);
      expect(report.patterns).toHaveLength(0);
      expect(report.totalPatterns).toBe(0);
      expect(report.qualityDebtCount).toBe(0);
      expect(report.hasDesperation).toBe(false);
      expect(report.warningMessage).toBeNull();
    });
  });

  describe("detectBypassPatterns — riskTolerance relaxed pattern", () => {
    it("should NOT detect pattern with only 2 features", async () => {
      await recordRelaxedTolerance(tmpDir, "feature-1", "relaxed");
      await recordRelaxedTolerance(tmpDir, "feature-2", "relaxed");

      const report = await detectBypassPatterns(tmpDir);
      const relaxedPatterns = report.patterns.filter(
        (p) => p.patternType === "riskTolerance-relaxed"
      );
      expect(relaxedPatterns).toHaveLength(0);
      expect(report.totalPatterns).toBe(0);
    });

    it("should detect pattern with 3+ features", async () => {
      await recordRelaxedTolerance(tmpDir, "feature-1", "relaxed");
      await recordRelaxedTolerance(tmpDir, "feature-2", "relaxed");
      await recordRelaxedTolerance(tmpDir, "feature-3", "relaxed");

      const report = await detectBypassPatterns(tmpDir);
      const relaxedPatterns = report.patterns.filter(
        (p) => p.patternType === "riskTolerance-relaxed"
      );
      expect(relaxedPatterns).toHaveLength(1);
      expect(relaxedPatterns[0]?.count).toBe(3);
      expect(report.hasDesperation).toBe(true);
    });

    it("should count unique features, not entries", async () => {
      // 5 entries but only 2 unique features — should not trigger
      await recordRelaxedTolerance(tmpDir, "feature-1", "relaxed");
      await recordRelaxedTolerance(tmpDir, "feature-1", "relaxed");
      await recordRelaxedTolerance(tmpDir, "feature-1", "relaxed");
      await recordRelaxedTolerance(tmpDir, "feature-2", "relaxed");
      await recordRelaxedTolerance(tmpDir, "feature-2", "relaxed");

      const report = await detectBypassPatterns(tmpDir);
      expect(report.totalPatterns).toBe(0);
    });
  });

  describe("detectBypassPatterns — gatekeep same-actor pattern", () => {
    it("should detect pattern with 2+ same-actor approvals", async () => {
      await recordGatekeepSameActor(tmpDir, "feature-1", "dev-user", false);
      await recordGatekeepSameActor(tmpDir, "feature-2", "dev-user", false);

      const report = await detectBypassPatterns(tmpDir);
      const sameActorPatterns = report.patterns.filter(
        (p) => p.patternType === "gatekeep-same-actor"
      );
      expect(sameActorPatterns).toHaveLength(1);
      expect(sameActorPatterns[0]?.count).toBe(2);
      expect(report.hasDesperation).toBe(true);
    });

    it("should NOT detect pattern with only 1 feature", async () => {
      await recordGatekeepSameActor(tmpDir, "feature-1", "dev-user", false);

      const report = await detectBypassPatterns(tmpDir);
      expect(report.totalPatterns).toBe(0);
    });
  });

  describe("detectBypassPatterns — low pass-rate pattern", () => {
    it("should detect pattern with 3+ low-pass features", async () => {
      await recordLowPassRate(tmpDir, "feature-1", 5, 25); // 20%
      await recordLowPassRate(tmpDir, "feature-2", 8, 25); // 32%
      await recordLowPassRate(tmpDir, "feature-3", 10, 25); // 40%

      const report = await detectBypassPatterns(tmpDir);
      const lowPassPatterns = report.patterns.filter(
        (p) => p.patternType === "feature-complete-low-pass-rate"
      );
      expect(lowPassPatterns).toHaveLength(1);
      expect(lowPassPatterns[0]?.count).toBe(3);
      expect(report.hasDesperation).toBe(true);
    });

    it("should NOT detect pattern with only 2 features", async () => {
      await recordLowPassRate(tmpDir, "feature-1", 5, 25);
      await recordLowPassRate(tmpDir, "feature-2", 8, 25);

      const report = await detectBypassPatterns(tmpDir);
      expect(report.totalPatterns).toBe(0);
    });
  });

  describe("getQualityDebt", () => {
    it("should return 0 when no events exist", async () => {
      const debt = await getQualityDebt(tmpDir);
      expect(debt).toBe(0);
    });

    it("should count unique features with bypass events", async () => {
      await recordBypassEvent(tmpDir, {
        timestamp: "2026-07-08T00:00:00.000Z",
        featureId: "feature-1",
        patternType: "riskTolerance-relaxed",
        details: { message: "Test" },
      });
      await recordBypassEvent(tmpDir, {
        timestamp: "2026-07-08T00:00:01.000Z",
        featureId: "feature-2",
        patternType: "gatekeep-same-actor",
        details: { message: "Test" },
      });
      await recordBypassEvent(tmpDir, {
        timestamp: "2026-07-08T00:00:02.000Z",
        featureId: "feature-1",
        patternType: "feature-complete-low-pass-rate",
        details: { message: "Test" },
      });

      const debt = await getQualityDebt(tmpDir);
      expect(debt).toBe(2);
    });
  });

  describe("multiple patterns simultaneously", () => {
    it("should detect all three patterns when all thresholds exceeded", async () => {
      // 3 relaxed features
      await recordRelaxedTolerance(tmpDir, "feature-1", "relaxed");
      await recordRelaxedTolerance(tmpDir, "feature-2", "relaxed");
      await recordRelaxedTolerance(tmpDir, "feature-3", "relaxed");

      // 2 same-actor approvals
      await recordGatekeepSameActor(tmpDir, "feature-4", "dev-user", false);
      await recordGatekeepSameActor(tmpDir, "feature-5", "dev-user", false);

      // 3 low-pass features
      await recordLowPassRate(tmpDir, "feature-6", 5, 25);
      await recordLowPassRate(tmpDir, "feature-7", 8, 25);
      await recordLowPassRate(tmpDir, "feature-8", 10, 25);

      const report = await detectBypassPatterns(tmpDir);
      expect(report.totalPatterns).toBe(3);
      expect(report.hasDesperation).toBe(true);
      expect(report.qualityDebtCount).toBe(8);
      expect(report.warningMessage).not.toBeNull();
      expect(report.warningMessage).toContain("Quality Debt");
    });
  });

  describe("malformed log handling", () => {
    it("should handle partially malformed log gracefully", async () => {
      const auditDir = path.join(tmpDir, ".devflow", "audits");
      await fs.mkdir(auditDir, { recursive: true });
      const logPath = path.join(auditDir, "bypass-log.jsonl");

      const validEntry = JSON.stringify({
        timestamp: "2026-07-08T00:00:00.000Z",
        featureId: "feature-1",
        patternType: "riskTolerance-relaxed",
        details: { message: "Valid" },
      });

      await fs.writeFile(
        logPath,
        validEntry + "\n{invalid json\n" + validEntry + "\n",
        "utf-8"
      );

      const report = await detectBypassPatterns(tmpDir);
      // Should still process valid entries
      expect(report.qualityDebtCount).toBe(1);
    });
  });
});
