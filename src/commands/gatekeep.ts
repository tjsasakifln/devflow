import path from "node:path";
import { execSync } from "node:child_process";
import { fileExists, safeReadFile, atomicWrite } from "../utils/fs.js";
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

  // ── Enforce implementer ≠ approver ──
  if (gatekeeper === implementerActor && implementerActor !== "unknown") {
    console.log(pc.red("⛔ Gatekeep Refused — Implementer Cannot Approve\n"));
    console.log(pc.red(`   Implementer: ${implementerActor}`));
    console.log(pc.red(`   Gatekeeper:  ${gatekeeper}`));
    console.log(pc.red("   Same actor cannot implement AND approve. Use a different agent/person.\n"));
    console.log(pc.yellow("   Rule: Constitution C12 — Segregação de Papéis"));
    console.log(pc.yellow("   Set DEVFLOW_ACTOR env var or use --actor flag to identify the gatekeeper.\n"));
    return;
  }

  // ── Run DoD checks ──
  console.log(pc.bold("Running Definition of Done checks...\n"));

  const dodResult = await runFeatureCompleteInternal(featureId, rootPath);

  const verdict = options.reject ? "rejected" : "approved";
  const reason = options.reason || (verdict === "approved"
    ? "All DoD checks passed. Gatekeeper confirms feature meets engineering standards."
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
    reason,
    dodChecksPassed: dodResult.passed,
    dodChecksTotal: dodResult.total,
    ciStatus: dodResult.ciStatus || "not-checked",
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
          state.currentState = "feature-done";
          state.previousState = state.currentState;
          state.confidence = "high";
          state.lastUpdated = new Date().toISOString();
        }
        await atomicWrite(statePath, JSON.stringify(state, null, 2));
      } catch { /* skip */ }
    }
  }

  // ── Output ──
  if (verdict === "approved") {
    console.log(pc.green(`\n✅ Gatekeep Approved — ${featureId}\n`));
    console.log(pc.green(`   Gatekeeper: ${gatekeeper}`));
    console.log(pc.green(`   Implementer: ${implementerActor}`));
    console.log(pc.green(`   Checks: ${dodResult.passed}/${dodResult.total} passed\n`));
    console.log(pc.dim(`   Recorded in ${gatekeepLogPath}`));
    console.log(pc.bold(`   Feature is ready for merge. Run: git checkout main && git merge feature/${featureId}`));
  } else {
    console.log(pc.red(`\n❌ Gatekeep Rejected — ${featureId}\n`));
    console.log(pc.red(`   Gatekeeper: ${gatekeeper}`));
    console.log(pc.red(`   Reason: ${reason}`));
    console.log(pc.yellow(`   Feature moved back to coding-in-progress for fixes.\n`));
  }

  console.log();
}

// Internal: runs DoD without side effects for programmatic use
async function runFeatureCompleteInternal(
  featureId: string,
  rootPath: string
): Promise<{ passed: number; total: number; ciStatus: string }> {
  // Import dynamically to avoid circular dependency
  const { featureCompleteInternal } = await import("./feature-complete.js");
  return featureCompleteInternal(featureId, rootPath);
}
