// =============================================================================
// Adversarial Verify Pattern (Story 3.2)
// =============================================================================
// N findings → N verifiers independentes (3 lenses: correctness, security,
// repro). Cada verifier tenta REFUTAR o finding. Threshold >=2/3 sobrevive,
// 2-1 = "disputed" (escalado para revisão humana), <=1 = refutado.
//
// Integrates with:
//   - ParallelSpawner (Story 3.1) for concurrency-controlled worker pattern
//   - adversarial-review.ts for the --verify-mode=adversarial flag
//   - Workflow engine as a quality gate
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import type {
  Finding,
  AdversarialLens,
  AdversarialVerdict,
  VerificationResult,
  AdversarialVerificationResult,
  VerificationOutcome,
  VerificationConfig,
  DisputedFindingEntry,
} from "./types.js";
import { ensureDir } from "../utils/fs.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERIFIER_LENSES: AdversarialLens[] = [
  "correctness",
  "security",
  "repro",
];

/** Path for disputed findings output. */
const DISPUTED_FINDINGS_FILE = ".devflow/disputed-findings.json";

// ---------------------------------------------------------------------------
// AdversarialVerifier
// ---------------------------------------------------------------------------

/**
 * Verifies findings by running them through 3 independent adversarial lenses.
 * Each lens attempts to REFUTE the finding. Threshold logic determines the
 * final outcome.
 *
 * Uses the ParallelSpawner's worker-pool pattern for concurrency control.
 */
export class AdversarialVerifier {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Verify a batch of findings through all 3 adversarial lenses.
   *
   * @param findings - Array of findings to verify.
   * @param config - Optional configuration overrides.
   * @param contextId - Optional context ID for dispute tracking (e.g., feature ID).
   * @returns Array of verification results, one per finding.
   */
  async verify(
    findings: Finding[],
    config?: Partial<VerificationConfig>,
    contextId?: string,
  ): Promise<AdversarialVerificationResult> {
    if (findings.length === 0) {
      return {
        totalFindings: 0,
        survived: [],
        refuted: [],
        disputed: [],
        allResults: [],
        durationMs: 0,
        summary: "No findings to verify",
      };
    }

    const maxParallel = config?.maxParallel ?? Math.min(3, findings.length);
    const startTime = performance.now();

    // Process findings with concurrency-controlled worker pool
    const results: VerificationResult[] = [];
    const queue = [...findings];

    const workers: Promise<void>[] = [];
    const workerCount = Math.max(1, maxParallel);

    for (let i = 0; i < workerCount; i++) {
      workers.push(this.workerLoop(queue, results));
    }

    await Promise.all(workers);

    const durationMs = Math.max(1, Math.round(performance.now() - startTime));

    // Categorize by outcome
    const survived = results.filter((r) => r.outcome === "survived");
    const refuted = results.filter((r) => r.outcome === "refuted");
    const disputed = results.filter((r) => r.outcome === "disputed");

    // Persist disputed findings if any
    if (disputed.length > 0 && contextId) {
      await this.persistDisputedFindings(disputed, contextId);
    }

    return {
      totalFindings: results.length,
      survived,
      refuted,
      disputed,
      allResults: results,
      durationMs,
      summary: this.buildSummary(survived.length, refuted.length, disputed.length, results.length),
    };
  }

  /**
   * Quick one-off verification of a single finding.
   */
  async verifyOne(
    finding: Finding,
    config?: Partial<VerificationConfig>,
    contextId?: string,
  ): Promise<VerificationResult> {
    const result = await this.verify([finding], config, contextId);
    return result.allResults[0] ?? {
      finding,
      verdicts: [],
      outcome: "refuted",
      summary: "Verification failed — no result returned",
    };
  }

  // -------------------------------------------------------------------------
  // Worker pool
  // -------------------------------------------------------------------------

  /**
   * Worker loop: picks findings from the queue, verifies each one.
   */
  private async workerLoop(
    queue: Finding[],
    results: VerificationResult[],
  ): Promise<void> {
    while (true) {
      const finding = queue.shift();
      if (!finding) break;

      const result = await this.verifyFinding(finding);
      results.push(result);
    }
  }

  // -------------------------------------------------------------------------
  // Finding verification
  // -------------------------------------------------------------------------

  /**
   * Verify a single finding against all 3 lenses in parallel.
   */
  private async verifyFinding(finding: Finding): Promise<VerificationResult> {
    // Run all 3 lens verifiers in parallel
    const verifierTasks = VERIFIER_LENSES.map((lens) =>
      this.runVerifier(lens, finding),
    );

    const verdicts = await Promise.all(verifierTasks);

    // Apply threshold logic
    const refutedCount = verdicts.filter((v) => v.refuted).length;
    const survivedCount = verdicts.filter((v) => !v.refuted).length;

    let outcome: VerificationOutcome;
    let summary: string;

    if (survivedCount >= 2) {
      outcome = "survived";
      summary =
        `Finding survived adversarial verification: ${survivedCount}/3 lenses did not refute`;
    } else if (survivedCount === 1 && refutedCount === 2) {
      outcome = "disputed";
      summary =
        `Finding is DISPUTED (${survivedCount}-${refutedCount} split) — human review required`;
    } else {
      outcome = "refuted";
      summary =
        `Finding refuted by adversarial verification: ${refutedCount}/3 lenses refuted it`;
    }

    return { finding, verdicts, outcome, summary };
  }

  // -------------------------------------------------------------------------
  // Lens verifiers
  // -------------------------------------------------------------------------

  /**
   * Run a single lens verifier against a finding.
   * Each lens tries to REFUTE the finding, not confirm it.
   */
  private async runVerifier(
    lens: AdversarialLens,
    finding: Finding,
  ): Promise<AdversarialVerdict> {
    switch (lens) {
      case "correctness":
        return this.checkCorrectness(finding);
      case "security":
        return this.checkSecurity(finding);
      case "repro":
        return this.checkRepro(finding);
    }
  }

  /**
   * CORRECTNESS lens: analyzes logical consistency, classification accuracy,
   * invariants, and edge cases. Tries to find reasons the finding is
   * misclassified or logically unsound.
   */
  private async checkCorrectness(
    finding: Finding,
  ): Promise<AdversarialVerdict> {
    const reasons: string[] = [];

    // 0. Check for explicit vulnerability keywords — if the finding clearly
    //    identifies a vulnerability class, don't refute based on file location
    const vulnerabilityKeywords = [
      "sql injection", "sqli", "xss", "cross-site", "csrf",
      "command injection", "path traversal", "rce", "remote code execution",
      "ssrf", "server-side request forgery", "idor", "insecure direct object",
      "buffer overflow", "privilege escalation", "auth bypass",
      "authentication bypass", "deserialization", "prototype pollution",
    ];
    const findingLower = finding.message.toLowerCase();
    const hasVulnerabilityKeyword = vulnerabilityKeywords.some(
      (kw) => findingLower.includes(kw),
    );

    // 1. Critical severity in non-sensitive files suggests over-classification
    //    BUT only if finding doesn't mention a specific vulnerability
    if (
      finding.severity === "critical" &&
      !this.isSecuritySensitiveFile(finding.file) &&
      !hasVulnerabilityKeyword
    ) {
      reasons.push(
        "Critical severity in non-security-sensitive file — over-classification likely",
      );
    }

    // 2. Warning findings in test files are often intentional
    if (
      finding.severity === "warning" &&
      (finding.file.endsWith(".test.ts") ||
        finding.file.endsWith(".spec.ts") ||
        finding.file.includes("__tests__"))
    ) {
      reasons.push(
        "Warning in test file — likely expected or intentional",
      );
    }

    // 3. Info-level findings are informational only, not defects
    if (finding.severity === "info") {
      reasons.push(
        "Info-level finding is informational — no functional defect",
      );
    }

    // 4. File-size or line-count findings are advisory, not correctness issues
    if (
      finding.message.includes("Large file") ||
      finding.message.includes("Long file")
    ) {
      reasons.push(
        "File size/line count is a maintainability suggestion, not a correctness defect",
      );
    }

    // 5. Line 0 (file-level) findings lack precision
    if (finding.line === 0 && finding.severity === "info") {
      reasons.push(
        "File-level finding without specific location — insufficient precision for actionable defect",
      );
    }

    if (reasons.length >= 2) {
      // Multiple refutation signals → strongly refuted
      return {
        lens: "correctness",
        refuted: true,
        reason: reasons.join("; "),
      };
    }

    if (reasons.length === 1) {
      // Single signal → still refuted but weaker
      return {
        lens: "correctness",
        refuted: true,
        reason: reasons[0]!,
      };
    }

    // Not refuted — finding appears logically sound
    return {
      lens: "correctness",
      refuted: false,
      reason:
        "Finding appears logically consistent and correctly classified",
    };
  }

  /**
   * SECURITY lens: analyzes whether the finding represents a real,
   * exploitable security concern. Tries to find compensating controls
   * or false-positive patterns.
   */
  private async checkSecurity(
    finding: Finding,
  ): Promise<AdversarialVerdict> {
    // Pattern: credential/secret detection
    if (finding.message.includes("Potential secret") || finding.message.includes("credential")) {
      // Check context — test files and examples are low risk
      const isTestFile =
        finding.file.endsWith(".test.ts") ||
        finding.file.endsWith(".spec.ts") ||
        finding.file.includes("__tests__") ||
        finding.file.includes("/test/") ||
        finding.file.includes("mock");
      const isExampleFile =
        finding.file.includes(".example") ||
        finding.file.includes(".template") ||
        finding.file.includes("fixture");
      const isDocFile =
        finding.file.endsWith(".md") ||
        finding.file.endsWith(".mdx");

      if (isTestFile) {
        return {
          lens: "security",
          refuted: true,
          reason:
            "Credential pattern detected in test/mock file — not a production secret exposure",
        };
      }

      if (isExampleFile) {
        return {
          lens: "security",
          refuted: true,
          reason:
            "Pattern found in example/template file — placeholder value, not a real credential",
        };
      }

      if (isDocFile) {
        return {
          lens: "security",
          refuted: true,
          reason:
            "Pattern in documentation file — credential is for illustration, not exploitable",
        };
      }

      // Not refuted — real security concern
      return {
        lens: "security",
        refuted: false,
        reason:
          "Credential pattern in production-adjacent file — requires investigation",
      };
    }

    // Pattern: eval() or unsafe patterns
    if (finding.message.includes("eval") || finding.message.includes("unsafe")) {
      const isTestFile =
        finding.file.endsWith(".test.ts") || finding.file.endsWith(".spec.ts");
      if (isTestFile) {
        return {
          lens: "security",
          refuted: true,
          reason:
            "eval/unsafe pattern in test context — likely intentional for testing",
        };
      }
    }

    // Pattern: N+1 query or performance issues → not security
    if (finding.message.includes("N+1") || finding.message.includes("performance")) {
      return {
        lens: "security",
        refuted: true,
        reason:
          "Performance finding, not a security vulnerability — misclassified dimension",
      };
    }

    // Pattern: informational or advisory findings
    if (finding.severity === "info" && !this.isSecuritySensitiveFile(finding.file)) {
      return {
        lens: "security",
        refuted: true,
        reason:
          "Info-level finding — informational only, no security impact",
      };
    }

    // Pattern: structural/maintainability findings
    if (
      finding.message.includes("import") ||
      finding.message.includes("export") ||
      finding.message.includes("duplication") ||
      finding.message.includes("Duplicate") ||
      finding.message.includes("Large file") ||
      finding.message.includes("Long file") ||
      finding.message.includes("Deep relative")
    ) {
      return {
        lens: "security",
        refuted: true,
        reason:
          "Structural/maintainability finding — not a security vulnerability",
      };
    }

    // Pattern: test coverage or documentation findings
    if (
      finding.message.includes("no test") ||
      finding.message.includes("missing assertion") ||
      finding.message.includes("TODO") ||
      finding.message.includes("FIXME")
    ) {
      return {
        lens: "security",
        refuted: true,
        reason:
          "Test/documentation quality finding — no security implications",
      };
    }

    // Pattern: findings in doc/config files that aren't credential-related
    const isDocOrConfig =
      finding.file.endsWith(".md") ||
      finding.file.endsWith(".mdx") ||
      finding.file.endsWith(".yaml") ||
      finding.file.endsWith(".yml") ||
      finding.file.endsWith(".json");
    if (isDocOrConfig && !finding.message.includes("secret") && !finding.message.includes("credential")) {
      return {
        lens: "security",
        refuted: true,
        reason:
          "Finding in documentation/config file — not executable security concern",
      };
    }

    // Default: cannot refute from security perspective
    return {
      lens: "security",
      refuted: false,
      reason:
        "Security impact cannot be dismissed — recommend review",
    };
  }

  /**
   * REPRO lens: analyzes whether the finding is deterministically
   * reproducible or flaky/environment-dependent.
   */
  private async checkRepro(
    finding: Finding,
  ): Promise<AdversarialVerdict> {
    // 1. File-level findings (line 0) lack specific repro location
    if (finding.line === 0) {
      return {
        lens: "repro",
        refuted: true,
        reason:
          "Finding has no specific line location (line 0) — cannot be reliably reproduced",
      };
    }

    // 2. Pattern-based security findings are deterministic by nature
    if (
      finding.message.includes("Potential secret") ||
      finding.message.includes("hardcoded") ||
      finding.message.includes("credential")
    ) {
      // But test file findings may not indicate production risk
      return {
        lens: "repro",
        refuted: false,
        reason:
          "Pattern-based finding — deterministic and reliably reproducible",
      };
    }

    // 3. Structural findings (import depth, function count) are deterministic
    if (
      finding.message.includes("import") ||
      finding.message.includes("dependency") ||
      finding.message.includes("export") ||
      finding.message.includes("Deep relative")
    ) {
      return {
        lens: "repro",
        refuted: false,
        reason:
          "Structural finding — based on static analysis, 100% reproducible",
      };
    }

    // 4. Code duplication findings are deterministic
    if (
      finding.message.includes("Duplicate") ||
      finding.message.includes("duplication")
    ) {
      return {
        lens: "repro",
        refuted: false,
        reason:
          "Code duplication finding — deterministic, tooling confirms it",
      };
    }

    // 5. Test file findings without assertions
    if (
      finding.message.includes("no test") ||
      finding.message.includes("missing assertion")
    ) {
      return {
        lens: "repro",
        refuted: false,
        reason:
          "Test structure finding — static analysis result, fully reproducible",
      };
    }

    // Default: finding has specific location, likely reproducible
    return {
      lens: "repro",
      refuted: false,
      reason:
        "Finding has specific file and line — appears reproducible",
    };
  }

  // -------------------------------------------------------------------------
  // Dispute persistence
  // -------------------------------------------------------------------------

  /**
   * Persist disputed findings to .devflow/disputed-findings.json.
   */
  private async persistDisputedFindings(
    disputed: VerificationResult[],
    contextId: string,
  ): Promise<string> {
    const disputedDir = path.join(this.rootPath, ".devflow");
    await ensureDir(disputedDir);

    const disputeFilePath = path.join(this.rootPath, DISPUTED_FINDINGS_FILE);

    // Load existing disputes
    let existingEntries: DisputedFindingEntry[] = [];
    try {
      const raw = await fs.readFile(disputeFilePath, "utf-8");
      existingEntries = JSON.parse(raw) as DisputedFindingEntry[];
    } catch {
      // File doesn't exist or invalid — start fresh
    }

    // Append new disputed entries
    const timestamp = new Date().toISOString();
    const newEntries: DisputedFindingEntry[] = disputed.map((r) => ({
      finding: r.finding,
      verdicts: r.verdicts,
      timestamp,
      contextId,
    }));

    existingEntries.push(...newEntries);

    // Write merged result
    await fs.writeFile(
      disputeFilePath,
      JSON.stringify(existingEntries, null, 2),
      "utf-8",
    );

    return disputeFilePath;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Check if a file path is in a security-sensitive area.
   */
  private isSecuritySensitiveFile(filePath: string): boolean {
    const securityPatterns = [
      "/auth/",
      "/guard/",
      "/security/",
      "/crypto/",
      "auth.",
      "guard.",
      "security.",
      ".env",
      "secret",
      "credential",
      "token",
    ];
    return securityPatterns.some((p) => filePath.includes(p));
  }

  /**
   * Build a human-readable summary string.
   */
  private buildSummary(
    survivedCount: number,
    refutedCount: number,
    disputedCount: number,
    totalCount: number,
  ): string {
    const parts: string[] = [];

    if (survivedCount > 0) {
      parts.push(`${survivedCount}/${totalCount} findings survived`);
    }
    if (refutedCount > 0) {
      parts.push(`${refutedCount}/${totalCount} findings refuted`);
    }
    if (disputedCount > 0) {
      parts.push(
        `${disputedCount} findings DISPUTED — human review required`,
      );
    }

    if (parts.length === 0) {
      return "No findings were verified";
    }

    return parts.join("; ");
  }
}

// ---------------------------------------------------------------------------
// Standalone verification (convenience)
// ---------------------------------------------------------------------------

/**
 * Convenience function: create verifier, run verification, return results.
 * Useful as a one-shot call without instantiating the class.
 */
export async function verifyFindings(
  rootPath: string,
  findings: Finding[],
  config?: Partial<VerificationConfig>,
  contextId?: string,
): Promise<AdversarialVerificationResult> {
  const verifier = new AdversarialVerifier(rootPath);
  return verifier.verify(findings, config, contextId);
}
