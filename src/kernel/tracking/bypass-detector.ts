import path from "node:path";
import { atomicWrite, safeReadFile, ensureDir } from "../utils/fs.js";
import { BYPASS_LOG_RELPATH } from "../constants/paths.js";

// ── Types ──

export type BypassPatternType =
  | "riskTolerance-relaxed"
  | "gatekeep-same-actor"
  | "feature-complete-low-pass-rate";

export interface BypassEvent {
  timestamp: string;
  featureId: string;
  patternType: BypassPatternType;
  details: {
    actor?: string;
    riskTolerance?: string;
    passed?: number;
    total?: number;
    passRate?: number;
    hadAdversarialReview?: boolean;
    message: string;
  };
}

export interface DetectedPattern {
  patternType: BypassPatternType;
  severity: "low" | "medium" | "high";
  count: number;
  threshold: number;
  triggerCount: number;
  description: string;
  suggestion: string;
}

export interface BypassReport {
  patterns: DetectedPattern[];
  totalPatterns: number;
  qualityDebtCount: number;
  hasDesperation: boolean;
  warningMessage: string | null;
}

// ── Helpers ──

function getBypassLogPath(rootPath: string): string {
  return path.join(rootPath, BYPASS_LOG_RELPATH);
}

// ── Public API ──

/**
 * Record a bypass event to the local bypass log.
 * Tracking is local-only — no telemetry, no phone-home.
 */
export async function recordBypassEvent(
  rootPath: string,
  event: BypassEvent
): Promise<void> {
  const logPath = getBypassLogPath(rootPath);
  await ensureDir(path.dirname(logPath));

  const existing = await safeReadFile(logPath);
  await atomicWrite(logPath, (existing || "") + JSON.stringify(event) + "\n");
}

/**
 * Detect all bypass patterns from the local bypass log.
 * Returns a report of detected patterns, quality debt count, and warning.
 */
export async function detectBypassPatterns(
  rootPath: string
): Promise<BypassReport> {
  const logPath = getBypassLogPath(rootPath);
  const raw = await safeReadFile(logPath);
  const patterns: DetectedPattern[] = [];

  if (!raw) {
    return {
      patterns: [],
      totalPatterns: 0,
      qualityDebtCount: 0,
      hasDesperation: false,
      warningMessage: null,
    };
  }

  const events: BypassEvent[] = raw
    .trim()
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as BypassEvent;
      } catch {
        return null;
      }
    })
    .filter((e): e is BypassEvent => e !== null);

  // ── Pattern 1: 3+ features with riskTolerance relaxed in sequence ──
  const relaxedEvents = events.filter(
    (e) => e.patternType === "riskTolerance-relaxed"
  );
  const uniqueRelaxedFeatures = new Set(relaxedEvents.map((e) => e.featureId));
  if (uniqueRelaxedFeatures.size >= 3) {
    patterns.push({
      patternType: "riskTolerance-relaxed",
      severity: "high",
      count: uniqueRelaxedFeatures.size,
      threshold: 3,
      triggerCount: uniqueRelaxedFeatures.size,
      description: `${uniqueRelaxedFeatures.size} features created/modified with riskTolerance=relaxed — gates are advisory, not blocking.`,
      suggestion:
        "Consider tightening to riskTolerance=moderate (default) to restore blocking gates. Use strict for production-critical work.",
    });
  }

  // ── Pattern 2: 2+ gatekeep --approve with same actor without adversarial review ──
  const sameActorEvents = events.filter(
    (e) => e.patternType === "gatekeep-same-actor"
  );
  const uniqueSameActorFeatures = new Set(
    sameActorEvents.map((e) => e.featureId)
  );
  if (uniqueSameActorFeatures.size >= 2) {
    patterns.push({
      patternType: "gatekeep-same-actor",
      severity: "high",
      count: uniqueSameActorFeatures.size,
      threshold: 2,
      triggerCount: sameActorEvents.filter((e) => {
        const event = sameActorEvents.find(
          (oe) => oe.featureId === e.featureId
        );
        return event && !event.details.hadAdversarialReview;
      }).length,
      description: `${uniqueSameActorFeatures.size} features approved by same actor without adversarial review — Constitution C12 (implementer ≠ approver) is being bypassed.`,
      suggestion:
        "Use a different gatekeeper actor, or enable adversarial review as compensating evidence for solo-hardened mode.",
    });
  }

  // ── Pattern 3: feature complete with <50% pass rate 3+ times ──
  const lowPassEvents = events.filter(
    (e) => e.patternType === "feature-complete-low-pass-rate"
  );
  const uniqueLowPassFeatures = new Set(
    lowPassEvents.map((e) => e.featureId)
  );
  if (uniqueLowPassFeatures.size >= 3) {
    patterns.push({
      patternType: "feature-complete-low-pass-rate",
      severity: "high",
      count: uniqueLowPassFeatures.size,
      threshold: 3,
      triggerCount: uniqueLowPassFeatures.size,
      description: `${uniqueLowPassFeatures.size} features completed with <50% DoD pass rate — Definition of Done checks are being systematically bypassed.`,
      suggestion:
        "Review requirements and planning before creating features. Consider using devflow doctor to diagnose why checks are failing.",
    });
  }

  // ── Compute quality debt ──
  const allAffectedFeatures = new Set(events.map((e) => e.featureId));
  const qualityDebtCount = allAffectedFeatures.size;

  // ── Determine if we have "desperation" (any high-severity pattern) ──
  const hasDesperation = patterns.length > 0;
  const highSeverityPatterns = patterns.filter((p) => p.severity === "high");
  const hasHighSeverity = highSeverityPatterns.length > 0;

  // ── Generate consolidated warning ──
  let warningMessage: string | null = null;
  if (hasDesperation) {
    const lines: string[] = [
      "⚠️  Bypass Pattern Detected — Quality Gates Are Being Circumvented",
      "",
    ];

    for (const pattern of patterns) {
      lines.push(`  • ${pattern.description}`);
    }

    lines.push("");
    lines.push(
      `  Quality Debt: ${qualityDebtCount} feature(s) with bypassed gates`
    );
    lines.push("");

    if (hasHighSeverity) {
      lines.push("  Recommended Actions:");
      for (const pattern of highSeverityPatterns) {
        lines.push(`    - ${pattern.suggestion}`);
      }
      lines.push(
        `    - Run: devflow config set riskTolerance moderate --require-justification`
      );
      lines.push(
        "    - Consider: devflow doctor --fix to address underlying issues"
      );
    }

    warningMessage = lines.join("\n");
  }

  return {
    patterns,
    totalPatterns: patterns.length,
    qualityDebtCount,
    hasDesperation,
    warningMessage,
  };
}

/**
 * Quick quality debt counter — lightweight version for status command.
 * Returns the count of unique features with bypass events.
 */
export async function getQualityDebt(rootPath: string): Promise<number> {
  const logPath = getBypassLogPath(rootPath);
  const raw = await safeReadFile(logPath);

  if (!raw) return 0;

  const features = new Set<string>();
  for (const line of raw.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as BypassEvent;
      if (event.featureId) features.add(event.featureId);
    } catch {
      // skip malformed lines
    }
  }

  return features.size;
}

/**
 * Record a riskTolerance-relaxed bypass event.
 */
export async function recordRelaxedTolerance(
  rootPath: string,
  featureId: string,
  riskTolerance: string
): Promise<void> {
  await recordBypassEvent(rootPath, {
    timestamp: new Date().toISOString(),
    featureId,
    patternType: "riskTolerance-relaxed",
    details: {
      riskTolerance,
      message: `Feature "${featureId}" created/modified with riskTolerance="${riskTolerance}" — gates are advisory.`,
    },
  });
}

/**
 * Record a gatekeep same-actor bypass event.
 */
export async function recordGatekeepSameActor(
  rootPath: string,
  featureId: string,
  actor: string,
  hadAdversarialReview: boolean
): Promise<void> {
  await recordBypassEvent(rootPath, {
    timestamp: new Date().toISOString(),
    featureId,
    patternType: "gatekeep-same-actor",
    details: {
      actor,
      hadAdversarialReview,
      message: `Feature "${featureId}" approved by same actor "${actor}"${
        hadAdversarialReview ? " with" : " without"
      } adversarial review.`,
    },
  });
}

/**
 * Record a feature-complete low-pass-rate bypass event.
 */
export async function recordLowPassRate(
  rootPath: string,
  featureId: string,
  passed: number,
  total: number
): Promise<void> {
  const passRate = total > 0 ? passed / total : 0;
  await recordBypassEvent(rootPath, {
    timestamp: new Date().toISOString(),
    featureId,
    patternType: "feature-complete-low-pass-rate",
    details: {
      passed,
      total,
      passRate,
      message: `Feature "${featureId}" completed with ${passed}/${total} checks passing (${Math.round(passRate * 100)}% — below 50% threshold).`,
    },
  });
}
