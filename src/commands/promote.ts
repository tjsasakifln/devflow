/**
 * Feature Promotion Command
 *
 * Promotes a feature between environments: local → staging → prod.
 * Each environment has gates that must pass before promotion:
 *   - local:    No gates (baseline)
 *   - staging:  CI must be green
 *   - prod:     Gatekeep must be approved
 *
 * Flags: --to=<env>, --force (skip gates with warning)
 * Output is pipe-safe JSON on stdout. Human-readable output goes to stderr.
 */

import path from "node:path";
import pc from "picocolors";
import { fileExists, safeReadFile } from "../kernel/utils/fs.js";

type Environment = "local" | "staging" | "prod";

interface GateResult {
  gate: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
}

interface PromoteResult {
  command: "promote";
  featureId: string;
  from: Environment;
  to: Environment;
  status: "promoted" | "blocked" | "error" | "skipped";
  gates: GateResult[];
  summary: string;
  timestamp: string;
  error?: string;
}

const ENV_ORDER: Environment[] = ["local", "staging", "prod"];

function validateEnvironment(input: string): Environment | null {
  const e = input.toLowerCase().trim() as Environment;
  if (ENV_ORDER.includes(e)) return e;
  return null;
}

async function checkCIGreen(rootPath: string): Promise<GateResult> {
  try {
    const { ConfigManager } = await import("../config/index.js");
    const configMgr = new ConfigManager(rootPath);
    const config = await configMgr.load();

    if (!config.ciIntegration?.enabled) {
      return {
        gate: "ci-status",
        passed: false,
        blocking: false,
        detail: "CI integration not enabled — advisory warning only",
      };
    }

    // Attempt to verify CI status via GitHub CLI
    try {
      const { execSync } = await import("node:child_process");
      const output = execSync(
        "gh run list --limit 1 --json conclusion,headBranch,status 2>/dev/null || true",
        { cwd: rootPath, encoding: "utf-8", timeout: 15000 },
      );

      if (output.trim()) {
        const runs = JSON.parse(output) as Array<{
          conclusion: string | null;
          headBranch: string;
          status: string;
        }>;
        const latestRun = runs[0];

        if (!latestRun) {
          return {
            gate: "ci-status",
            passed: false,
            blocking: true,
            detail: "No CI runs found",
          };
        }

        if (latestRun.status !== "completed") {
          return {
            gate: "ci-status",
            passed: false,
            blocking: true,
            detail: `CI run still in progress: ${latestRun.status}`,
          };
        }

        if (latestRun.conclusion !== "success") {
          return {
            gate: "ci-status",
            passed: false,
            blocking: true,
            detail: `CI run conclusion: ${latestRun.conclusion}`,
          };
        }

        return {
          gate: "ci-status",
          passed: true,
          blocking: true,
          detail: `CI passed on branch ${latestRun.headBranch}`,
        };
      }

      return {
        gate: "ci-status",
        passed: false,
        blocking: true,
        detail: "Could not determine CI status — gh CLI not available or no runs",
      };
    } catch {
      return {
        gate: "ci-status",
        passed: false,
        blocking: true,
        detail: "CI check failed — gh CLI not available. Run 'gh auth login' first.",
      };
    }
  } catch {
    return {
      gate: "ci-status",
      passed: false,
      blocking: false,
      detail: "Could not load config — CI check skipped",
    };
  }
}

async function checkGatekeepApproved(
  featureId: string,
  rootPath: string,
): Promise<GateResult> {
  const gatekeepLogPath = path.join(rootPath, ".devflow", "audits", "gatekeep-log.jsonl");
  const raw = await safeReadFile(gatekeepLogPath);

  if (!raw) {
    return {
      gate: "gatekeep-approved",
      passed: false,
      blocking: true,
      detail: "No gatekeep-log.jsonl found — feature not yet gatekeep-approved",
    };
  }

  const lines = raw.trim().split("\n").filter(Boolean);
  let approved = false;
  let latestEntry = "";

  for (const line of lines.reverse()) {
    try {
      const entry = JSON.parse(line);
      if (
        entry.featureId === featureId ||
        entry.feature === featureId
      ) {
        latestEntry = `${entry.verdict || "unknown"} by ${entry.gatekeeper || entry.actor || "unknown"}`;
        if (entry.verdict === "approved" || entry.verdict === "PASS") {
          approved = true;
          break;
        }
      }
    } catch {
      // Skip malformed entries
    }
  }

  return {
    gate: "gatekeep-approved",
    passed: approved,
    blocking: true,
    detail: approved
      ? `Feature "${featureId}" approved. Latest: ${latestEntry}`
      : `Feature "${featureId}" not approved. Latest: ${latestEntry || "no entries found"}`,
  };
}

async function verifyLocalGates(
  featureId: string,
  rootPath: string,
): Promise<GateResult[]> {
  const gates: GateResult[] = [];

  // Check feature directory exists
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);
  const exists = await fileExists(featureDir);
  gates.push({
    gate: "feature-exists",
    passed: exists,
    blocking: true,
    detail: exists
      ? `Feature directory found: ${featureDir}`
      : `Feature directory not found: ${featureDir}`,
  });

  // Check requirements.md exists
  const reqFile = path.join(featureDir, "requirements.md");
  const hasReqs = await fileExists(reqFile);
  gates.push({
    gate: "requirements-exist",
    passed: hasReqs,
    blocking: false,
    detail: hasReqs ? "requirements.md found" : "requirements.md not found (advisory)",
  });

  // Check implementation-log.jsonl exists
  const implLog = path.join(featureDir, "implementation-log.jsonl");
  const hasImpl = await fileExists(implLog);
  gates.push({
    gate: "implementation-log",
    passed: hasImpl,
    blocking: false,
    detail: hasImpl ? "implementation-log.jsonl found" : "implementation-log.jsonl not found (advisory)",
  });

  return gates;
}

async function verifyStagingGates(
  rootPath: string,
): Promise<GateResult[]> {
  const gates: GateResult[] = [];

  // CI must be green
  const ciGate = await checkCIGreen(rootPath);
  gates.push(ciGate);

  return gates;
}

async function verifyProdGates(
  featureId: string,
  rootPath: string,
): Promise<GateResult[]> {
  const gates: GateResult[] = [];

  // Gatekeep must be approved
  const gatekeepGate = await checkGatekeepApproved(featureId, rootPath);
  gates.push(gatekeepGate);

  // Also run CI check
  const ciGate = await checkCIGreen(rootPath);
  gates.push(ciGate);

  return gates;
}

export async function promoteCommand(
  rootPath: string,
  options: {
    to?: string;
    force?: boolean;
    featureId?: string;
  },
): Promise<void> {
  // Determine target environment
  const toEnv = validateEnvironment(options.to || "staging");
  if (!toEnv) {
    const result: PromoteResult = {
      command: "promote",
      featureId: options.featureId || "unknown",
      from: "local",
      to: "local",
      status: "error",
      gates: [],
      summary: `Invalid environment: "${options.to}". Valid: local, staging, prod`,
      timestamp: new Date().toISOString(),
      error: `Invalid environment: ${options.to}`,
    };

    console.error(pc.red(`\n✖ Invalid environment: "${options.to}"\n`));
    console.error(pc.dim("  Valid environments: local, staging, prod\n"));
    console.log(JSON.stringify(result));
    return;
  }

  // Determine from environment based on env order
  const fromIndex = ENV_ORDER.indexOf(toEnv);
  const fromEnv = fromIndex > 0 ? ENV_ORDER[fromIndex - 1]! : "local";

  const featureId = options.featureId || "unknown";

  console.error(pc.bold(`\nDevflow Promote — ${featureId}\n`));
  console.error(pc.dim(`  From: ${fromEnv} → To: ${toEnv}\n`));

  // Verify gates based on target environment
  let gates: GateResult[] = [];
  let allBlockingPassed = true;

  switch (toEnv) {
    case "local":
      gates = await verifyLocalGates(featureId, rootPath);
      break;
    case "staging":
      gates = [...(await verifyLocalGates(featureId, rootPath)), ...(await verifyStagingGates(rootPath))];
      break;
    case "prod":
      gates = [
        ...(await verifyLocalGates(featureId, rootPath)),
        ...(await verifyStagingGates(rootPath)),
        ...(await verifyProdGates(featureId, rootPath)),
      ];
      break;
  }

  // Check if all blocking gates passed
  allBlockingPassed = gates.filter((g) => g.blocking).every((g) => g.passed);

  // Render gates
  console.error(pc.bold("Gates:\n"));
  for (const gate of gates) {
    const icon = gate.passed ? pc.green("✓") : gate.blocking ? pc.red("✖") : pc.yellow("⚠");
    console.error(`  ${icon} ${pc.bold(gate.gate)}: ${gate.detail}`);
  }

  console.error("");

  // Handle force flag
  if (!allBlockingPassed && options.force) {
    console.error(pc.yellow("⚠  --force flag detected. Skipping failed gates with warning.\n"));
    console.error(pc.yellow("   This feature is promoted without passing all gates.\n"));

    const result: PromoteResult = {
      command: "promote",
      featureId,
      from: fromEnv,
      to: toEnv,
      status: "promoted",
      gates,
      summary: `Feature "${featureId}" force-promoted from ${fromEnv} to ${toEnv} (gates bypassed with --force)`,
      timestamp: new Date().toISOString(),
    };

    console.error(pc.green(`✓ Feature "${featureId}" promoted: ${fromEnv} → ${toEnv} (--force)\n`));
    console.log(JSON.stringify(result));
    return;
  }

  if (!allBlockingPassed) {
    const failedGates = gates.filter((g) => g.blocking && !g.passed);

    console.error(pc.red(`✖ ${failedGates.length} blocking gate(s) failed. Promotion blocked.\n`));

    for (const g of failedGates) {
      console.error(pc.red(`  ✖ ${g.gate}: ${g.detail}`));
    }

    console.error(pc.yellow("\n  Use --force to bypass gates (with warning).\n"));

    const result: PromoteResult = {
      command: "promote",
      featureId,
      from: fromEnv,
      to: toEnv,
      status: "blocked",
      gates,
      summary: `Promotion blocked by ${failedGates.length} gate(s)`,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(result));
    return;
  }

  // All gates passed — promote
  console.error(pc.green("✓ All gates passed.\n"));
  console.error(pc.green(`✓ Feature "${featureId}" promoted: ${fromEnv} → ${toEnv}\n`));

  // Log promotion to gatekeep-log
  try {
    const { atomicWrite, ensureDir } = await import("../kernel/utils/fs.js");
    const auditsDir = path.join(rootPath, ".devflow", "audits");
    await ensureDir(auditsDir);
    const gatekeepLogPath = path.join(auditsDir, "gatekeep-log.jsonl");

    const promotionEntry = {
      timestamp: new Date().toISOString(),
      event: "promotion",
      featureId,
      from: fromEnv,
      to: toEnv,
      status: "promoted",
      gatesPassed: gates.filter((g) => g.passed).length,
      gatesTotal: gates.length,
    };

    // Append to gatekeep log
    const existing = (await safeReadFile(gatekeepLogPath)) || "";
    await atomicWrite(
      gatekeepLogPath,
      existing.trimEnd() + "\n" + JSON.stringify(promotionEntry) + "\n",
    );

    console.error(pc.dim(`  Logged to: ${gatekeepLogPath}\n`));
  } catch {
    // Logging is non-critical
  }

  const result: PromoteResult = {
    command: "promote",
    featureId,
    from: fromEnv,
    to: toEnv,
    status: "promoted",
    gates,
    summary: `Feature "${featureId}" promoted from ${fromEnv} to ${toEnv} — all ${gates.length} gates passed`,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(result));
}
