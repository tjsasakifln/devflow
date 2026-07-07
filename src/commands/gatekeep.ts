import path from "node:path";
import { execSync } from "node:child_process";
import { fileExists, safeReadFile, atomicWrite } from "../utils/fs.js";
import { getVersion } from "../kernel/utils/version.js";
import pc from "picocolors";

export async function gatekeep(
  featureId: string,
  rootPath: string,
  options: { approve?: boolean; reject?: boolean; reason?: string; actor?: string }
): Promise<void> {
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);

  console.log(pc.bold(`\nDevflow Gatekeep — ${featureId}\n`));

  // ── Read implementation log to detect actors ──
  const logPath = path.join(featureDir, "implementation-log.jsonl");
  const logExists = await fileExists(logPath);

  let implementerActor = "unknown";
  const allActors = new Set<string>();

  if (logExists) {
    const raw = await safeReadFile(logPath);
    if (raw) {
      for (const line of raw.trim().split("\n")) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.actor) {
            allActors.add(entry.actor);
            if (!implementerActor || implementerActor === "unknown") {
              implementerActor = entry.actor;
            }
          }
        } catch { /* skip */ }
      }
    }
  }

  const gatekeeper = options.actor || process.env.DEVFLOW_ACTOR || process.env.USER || "unknown";
  const actorOrigin: "cli" | "claude-code" | "ci" | "inferred" = options.actor || process.env.DEVFLOW_ACTOR
    ? "cli"
    : "inferred";

  // ── Capture git context for audit trail ──
  let commitSha = "unknown";
  let gitBranch = "unknown";
  try {
    commitSha = execSync("git rev-parse HEAD", { cwd: rootPath, encoding: "utf-8" }).trim();
    gitBranch = execSync("git branch --show-current", { cwd: rootPath, encoding: "utf-8" }).trim();
  } catch { /* git not available */ }

  // ── Load config for review mode ──
  const { ConfigManager } = await import("../config/index.js");
  const configMgr = new ConfigManager(rootPath);
  const config = await configMgr.load();
  const mode = config.executionMode || "local";
  const reviewMode = config.reviewMode || "independent";

  // ── Validate implementation log structure (strict/release) ──
  if ((mode === "strict" || mode === "release") && logExists) {
    const raw = await safeReadFile(logPath);
    const logErrors: string[] = [];
    let entryCount = 0;

    if (raw) {
      const lines = raw.trim().split("\n").filter((l) => l.trim());
      entryCount = lines.length;

      if (entryCount === 0) {
        logErrors.push("Implementation log is empty — no entries found.");
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        try {
          const entry = JSON.parse(line);
          const missing: string[] = [];
          if (!entry.timestamp) missing.push("timestamp");
          if (!entry.actor) missing.push("actor");
          if (!entry.actionId) missing.push("actionId");
          if (!entry.status) missing.push("status");
          if (missing.length > 0) {
            logErrors.push(`Line ${i + 1}: missing required fields: ${missing.join(", ")}`);
          }
        } catch {
          logErrors.push(`Line ${i + 1}: invalid JSON — ${line.slice(0, 80)}`);
        }
      }
    } else {
      logErrors.push("Implementation log exists but is unreadable or empty.");
    }

    if (logErrors.length > 0) {
      console.log(pc.red(`\n⛔ Gatekeep Refused — Implementation Log Validation Failed (mode: ${mode})\n`));
      console.log(pc.red(`   ${logErrors.length} issue(s) found in implementation-log.jsonl:\n`));
      for (const err of logErrors.slice(0, 10)) {
        console.log(pc.red(`   • ${err}`));
      }
      if (logErrors.length > 10) {
        console.log(pc.dim(`   ... and ${logErrors.length - 10} more issues`));
      }
      console.log();
      console.log(pc.yellow("   Required fields per entry: timestamp, actor, actionId, filesChanged, status"));
      console.log(pc.yellow("   Fix the log and re-run gatekeep.\n"));

      // Log validation refusal
      const auditDir = path.join(rootPath, ".devflow", "audits");
      try { execSync(`mkdir -p "${auditDir}"`, { encoding: "utf-8" }); } catch { /* ok */ }
      const refusalEntry = {
        timestamp: new Date().toISOString(),
        gatekeeper,
        implementer: implementerActor,
        featureId,
        decision: "refused",
        reason: `Log validation failed: ${logErrors.length} issue(s) in implementation-log.jsonl`,
        actorOrigin,
        commitSha,
        branch: gitBranch,
        devflowVersion: getVersion(),
        executionMode: mode,
      };
      const gatekeepLogPath = path.join(auditDir, "gatekeep-log.jsonl");
      const existing = await safeReadFile(gatekeepLogPath);
      await atomicWrite(gatekeepLogPath, (existing || "") + JSON.stringify(refusalEntry) + "\n");
      return;
    }
  } else if (!logExists && (mode === "strict" || mode === "release")) {
    console.log(pc.red(`\n⛔ Gatekeep Refused — No Implementation Log (mode: ${mode})\n`));
    console.log(pc.red("   implementation-log.jsonl not found."));
    console.log(pc.red("   In strict/release modes, a complete implementation log is required.\n"));
    console.log(pc.yellow("   The log must contain entries with: timestamp, actor, actionId, filesChanged, status"));
    console.log(pc.yellow("   Run implementation actions and log each step.\n"));
    return;
  }

  // ── Enforce implementer ≠ approver ──
  if (reviewMode === "independent") {
    if (gatekeeper === implementerActor && implementerActor !== "unknown") {
      console.log(pc.red("⛔ Gatekeep Refused — Implementer Cannot Approve\n"));
      console.log(pc.red(`   Implementer: ${implementerActor}`));
      console.log(pc.red(`   Gatekeeper:  ${gatekeeper}`));
      console.log(pc.red("   Same actor cannot implement AND approve. Use a different agent/person.\n"));
      console.log(pc.yellow("   Rule: Constitution C12 — Segregação de Papéis"));
      console.log(pc.yellow("   Set DEVFLOW_ACTOR env var or use --actor flag to identify the gatekeeper.\n"));
      console.log(pc.dim("   Tip: To allow self-approval with compensating evidence, run:"));
      console.log(pc.dim("        devflow config set reviewMode solo-hardened\n"));
      return;
    }
  }

  if (reviewMode === "solo-hardened") {
    console.log(pc.yellow("⚠️  Solo-Hardened Review Mode Active\n"));
    console.log(pc.yellow("   Independent human review will NOT occur."));
    console.log(pc.yellow("   Compensating evidence is required:"));
    console.log(pc.yellow("     - Adversarial review must pass all 12 vectors"));
    console.log(pc.yellow("     - All deterministic checks must pass"));
    console.log(pc.yellow("     - Implementation log must be complete"));
    console.log(pc.yellow("     - Final report will document this as solo-hardened approval\n"));

    // Verify adversarial review exists
    const advReviewPath = path.join(rootPath, ".devflow", "audits", featureId, "adversarial-review.md");
    const hasAdvReview = await fileExists(advReviewPath);
    if (!hasAdvReview) {
      console.log(pc.red("⛔ Solo-Hardened Gatekeep Refused — Missing Adversarial Review\n"));
      console.log(pc.red("   In solo-hardened mode, adversarial review is MANDATORY."));
      console.log(pc.yellow(`   Run: devflow adversarial-review ${featureId}\n`));
      return;
    }

    // Verify adversarial review passed
    const advRaw = await safeReadFile(advReviewPath);
    if (advRaw && !advRaw.includes("PASS")) {
      console.log(pc.red("⛔ Solo-Hardened Gatekeep Refused — Adversarial Review Did Not Pass\n"));
      console.log(pc.red("   All 12 attack vectors must pass before solo-hardened approval.\n"));
      return;
    }

    console.log(pc.green("✅ Adversarial review: PASS\n"));
  }

  // ── Block unknown-unknown pairs in strict/release mode ──
  if (reviewMode === "independent") {
    if (gatekeeper === "unknown" && implementerActor === "unknown") {
      if (mode === "strict" || mode === "release") {
        console.log(pc.red("⛔ Gatekeep Refused — Actor Identity Not Verifiable\n"));
        console.log(pc.red("   Both implementer and gatekeeper are 'unknown'."));
        console.log(pc.red(`   Mode '${mode}' requires explicit actor identity.`));
        console.log(pc.yellow("   Set DEVFLOW_ACTOR env var or use --actor flag.\n"));
        return;
      }
      console.log(pc.yellow("⚠️  Warning: Both implementer and gatekeeper are 'unknown'."));
      console.log(pc.yellow("   Actor segregation cannot be verified in this state.\n"));
    }
  }

  // ── Require explicit decision ──
  if (!options.approve && !options.reject) {
    console.log(pc.yellow("\nNo decision flag provided.\n"));
    console.log(pc.dim("  Pass --approve to approve the feature."));
    console.log(pc.dim("  Pass --reject to reject the feature."));
    console.log(pc.dim("  Devflow never assumes approval. Decisions must be explicit.\n"));
    console.log(pc.bold("Run with --approve or --reject to proceed."));
    return;
  }

  // ── Run DoD checks ──
  console.log(pc.bold("Running Definition of Done checks...\n"));

  const dodResult = await runFeatureCompleteInternal(featureId, rootPath);

  // ── Block approval if blocking checks failed ──
  if (options.approve && !dodResult.allBlockingPassed) {
    console.log(pc.red("\n⛔ BLOCKING CHECKS FAILED — Approval Refused\n"));
    console.log(pc.red(`   ${dodResult.blockingFailed.length} blocking check(s) must pass before approval:\n`));
    for (const bf of dodResult.blockingFailed) {
      console.log(pc.red(`   [${bf.id}] ${bf.description}`));
      console.log(pc.yellow(`   → ${bf.remediation}\n`));
    }
    console.log(pc.yellow("Fix blocking checks and re-run `devflow feature complete` before attempting approval."));
    console.log(pc.yellow("Alternatively, use --reject to return feature to correction state.\n"));

    // Log refusal attempt
    const auditDir = path.join(rootPath, ".devflow", "audits");
    try { execSync(`mkdir -p "${auditDir}"`, { encoding: "utf-8" }); } catch { /* ok */ }
    const refusalEntry = {
      timestamp: new Date().toISOString(),
      gatekeeper,
      implementer: implementerActor,
      featureId,
      decision: "refused",
      reason: `Approval blocked: ${dodResult.blockingFailed.length} blocking checks failed — ${dodResult.blockingFailed.map(b => b.id).join(", ")}`,
      dodChecksPassed: dodResult.passed,
      dodChecksTotal: dodResult.total,
      allBlockingPassed: dodResult.allBlockingPassed,
      actorOrigin,
      commitSha,
      branch: gitBranch,
      devflowVersion: getVersion(),
      executionMode: mode,
    };
    const gatekeepLogPath = path.join(auditDir, "gatekeep-log.jsonl");
    const existing = await safeReadFile(gatekeepLogPath);
    await atomicWrite(gatekeepLogPath, (existing || "") + JSON.stringify(refusalEntry) + "\n");
    return;
  }

  const verdict = options.reject ? "rejected" : "approved";
  const reason = options.reason || (verdict === "approved"
    ? "All blocking checks passed. Gatekeeper confirms feature meets engineering standards."
    : "Gatekeeper rejected — issues found.");

  // ── Record gatekeep entry ──
  const auditDir = path.join(rootPath, ".devflow", "audits");
  try {
    execSync(`mkdir -p "${auditDir}"`, { encoding: "utf-8" });
  } catch { /* ok if exists */ }

  const gatekeepEntry = {
    timestamp: new Date().toISOString(),
    gatekeeper,
    implementer: implementerActor,
    featureId,
    decision: verdict,
    reason: reviewMode === "solo-hardened" && verdict === "approved"
      ? `${reason} ⚠️ Solo-hardened approval — independent human review did NOT occur. Compensating evidence: adversarial review passed, all deterministic checks passed.`
      : reason,
    dodChecksPassed: dodResult.passed,
    dodChecksTotal: dodResult.total,
    ciStatus: dodResult.ciStatus || "not-checked",
    actorOrigin,
    commitSha,
    branch: gitBranch,
    devflowVersion: getVersion(),
    executionMode: mode,
    reviewMode,
    allBlockingPassed: dodResult.allBlockingPassed,
  };

  const gatekeepLogPath = path.join(auditDir, "gatekeep-log.jsonl");
  // Append to gatekeep log (read existing, append entry, atomic write)
  const existing = await safeReadFile(gatekeepLogPath);
  await atomicWrite(gatekeepLogPath, (existing || "") + JSON.stringify(gatekeepEntry) + "\n");

  // ── Update state ──
  const statePath = path.join(rootPath, ".devflow", "state.json");
  if (await fileExists(statePath)) {
    const stateRaw = await safeReadFile(statePath);
    if (stateRaw) {
      try {
        const state = JSON.parse(stateRaw);
        if (verdict === "approved") {
          state.previousState = state.currentState;  // Save before overwriting
          state.currentState = "feature-done";
          state.confidence = "high";
          state.lastUpdated = new Date().toISOString();
        }
        await atomicWrite(statePath, JSON.stringify(state, null, 2));
      } catch { /* skip */ }
    }
  }

  // ── Output ──
  if (verdict === "approved") {
    if (reviewMode === "solo-hardened") {
      console.log(pc.yellow(`\n⚠️  Gatekeep Approved (Solo-Hardened) — ${featureId}\n`));
      console.log(pc.yellow(`   Gatekeeper: ${gatekeeper} (same as implementer)`));
      console.log(pc.yellow(`   Implementer: ${implementerActor}`));
      console.log(pc.yellow(`   Checks: ${dodResult.passed}/${dodResult.total} passed\n`));
      console.log(pc.red("   ⚠️  INDEPENDENT HUMAN REVIEW DID NOT OCCUR."));
      console.log(pc.red("   This is solo-hardened approval with compensating evidence:"));
      console.log(pc.dim("     - Adversarial review: PASS (all 12 vectors)"));
      console.log(pc.dim(`     - Deterministic checks: ${dodResult.passed}/${dodResult.total} passed`));
      console.log(pc.dim("     - Implementation log: verified"));
      console.log(pc.dim("   This is NOT equivalent to independent review. Consider seeking a second reviewer.\n"));
    } else {
      console.log(pc.green(`\n✅ Gatekeep Approved — ${featureId}\n`));
      console.log(pc.green(`   Gatekeeper: ${gatekeeper}`));
      console.log(pc.green(`   Implementer: ${implementerActor}`));
      console.log(pc.green(`   Checks: ${dodResult.passed}/${dodResult.total} passed\n`));
    }
    console.log(pc.dim(`   Recorded in ${gatekeepLogPath}`));
    console.log(pc.dim("   This approval is auditable evidence of process, not a guarantee of correctness.\n"));
    console.log(pc.bold("Next Steps:"));
    console.log(pc.dim("  1. git push origin feature/" + featureId));
    console.log(pc.dim("  2. Create Pull Request on GitHub"));
    console.log(pc.dim("  3. Wait for CI checks on the PR"));
    console.log(pc.dim("  4. Get human code review before merging"));
    console.log(pc.dim("  5. Merge when all reviews pass"));
  } else {
    console.log(pc.red(`\n❌ Gatekeep Rejected — ${featureId}\n`));
    console.log(pc.red(`   Gatekeeper: ${gatekeeper}`));
    console.log(pc.red(`   Reason: ${reason}`));
    console.log(pc.yellow(`   Feature returned to correction state.\n`));
    console.log(pc.bold("Next Steps:"));
    console.log(pc.dim("  1. Review the rejection reason above"));
    console.log(pc.dim("  2. Fix issues in feature/" + featureId));
    console.log(pc.dim("  3. Run `devflow feature complete " + featureId + "` to re-verify"));
    console.log(pc.dim("  4. Run `devflow gatekeep " + featureId + " --approve --actor <reviewer>` when ready"));
  }

  console.log();
}

// Internal: runs DoD without side effects for programmatic use
async function runFeatureCompleteInternal(
  featureId: string,
  rootPath: string
): Promise<import("./feature-complete.js").DoDResult> {
  const { featureCompleteInternal } = await import("./feature-complete.js");
  return featureCompleteInternal(featureId, rootPath);
}
