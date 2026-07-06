import path from "node:path";
import { ArtifactManager } from "../artifacts/manager.js";
import { inspectProject } from "../project/inspector.js";
import { detectState } from "../engine/state-detector.js";
import { computeRecommendation } from "../engine/next-action.js";
import { generateCockpit } from "../cockpit/generator.js";
import { ensureClaudeMdSection } from "../integration/claude-code.js";
import { fileExists, ensureDir } from "../utils/fs.js";
import pc from "picocolors";

interface DoctorCheck {
  name: string;
  status: "PASS" | "FIXED" | "FAIL" | "MANUAL";
  message: string;
}

export async function doctorCommand(
  cwd: string,
  options: { fix?: boolean }
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const checks: DoctorCheck[] = [];

  console.log(pc.bold("\nDevflow Doctor\n"));
  console.log(pc.dim("Diagnosing project state...\n"));

  // Check 1: .devflow/ directory
  const devflowDir = path.join(rootPath, ".devflow");
  if (await fileExists(devflowDir)) {
    checks.push({
      name: ".devflow/ directory",
      status: "PASS",
      message: "Directory exists",
    });
  } else if (options.fix) {
    await ensureDir(devflowDir);
    await ensureDir(path.join(devflowDir, "decisions"));
    await ensureDir(path.join(devflowDir, "audits"));
    await ensureDir(path.join(devflowDir, "context"));
    checks.push({
      name: ".devflow/ directory",
      status: "FIXED",
      message: "Created directory structure",
    });
  } else {
    checks.push({
      name: ".devflow/ directory",
      status: "FAIL",
      message: "Missing — run `devflow init` to create",
    });
  }

  // Check 2: _devflow/ directory
  const devArtifacts = path.join(rootPath, "_devflow");
  if (await fileExists(devArtifacts)) {
    checks.push({
      name: "_devflow/ directory",
      status: "PASS",
      message: "Directory exists",
    });
  } else if (options.fix) {
    const manager = new ArtifactManager(rootPath);
    await manager.scaffoldAll();
    checks.push({
      name: "_devflow/ directory",
      status: "FIXED",
      message: "Created directory structure",
    });
  } else {
    checks.push({
      name: "_devflow/ directory",
      status: "FAIL",
      message: "Missing — run `devflow init` to create",
    });
  }

  // Check 3: state.json exists and is valid
  const stateFile = path.join(rootPath, ".devflow", "state.json");
  if (await fileExists(stateFile)) {
    const manager = new ArtifactManager(rootPath);
    const state = await manager.readState();
    if (state && state.currentState) {
      checks.push({
        name: "state.json",
        status: "PASS",
        message: `Valid — current state: ${state.currentState}`,
      });
    } else {
      checks.push({
        name: "state.json",
        status: options.fix ? "FIXED" : "FAIL",
        message: options.fix
          ? "Regenerated from filesystem inspection"
          : "Invalid or corrupt — run with --fix to regenerate",
      });
    }
  } else if (options.fix) {
    const inspection = await inspectProject(rootPath);
    const stateResult = await detectState(inspection);
    const manager = new ArtifactManager(rootPath);
    await manager.writeState({
      currentState: stateResult.currentState,
      previousState: null,
      confidence: stateResult.confidence,
      lastUpdated: new Date().toISOString(),
      activeFeatureId: inspection.activeFeature?.id ?? null,
      blockers: stateResult.blockers,
    });
    checks.push({
      name: "state.json",
      status: "FIXED",
      message: `Created — current state: ${stateResult.currentState}`,
    });
  } else {
    checks.push({
      name: "state.json",
      status: "FAIL",
      message: "Missing — run `devflow init` or --fix",
    });
  }

  // Check 4: DEVFLOW.md exists
  if (await fileExists(path.join(rootPath, "DEVFLOW.md"))) {
    checks.push({
      name: "DEVFLOW.md",
      status: "PASS",
      message: "Cockpit file exists",
    });
  } else if (options.fix) {
    const inspection = await inspectProject(rootPath);
    const stateResult = await detectState(inspection);
    const recommendation = computeRecommendation(stateResult, inspection);
    const cockpit = generateCockpit(stateResult, recommendation, inspection);
    const manager = new ArtifactManager(rootPath);
    await manager.safeWrite(
      path.join(rootPath, "DEVFLOW.md"),
      cockpit,
      "DEVFLOW.md"
    );
    checks.push({
      name: "DEVFLOW.md",
      status: "FIXED",
      message: "Generated from current state",
    });
  } else {
    checks.push({
      name: "DEVFLOW.md",
      status: "FAIL",
      message: "Missing — run `devflow update-cockpit` or --fix",
    });
  }

  // Check 5: CLAUDE.md integration
  const claudeMdPath = path.join(rootPath, "CLAUDE.md");
  if (await fileExists(claudeMdPath)) {
    const { safeReadFile } = await import("../utils/fs.js");
    const { MARKER_START } = await import("../utils/markdown.js");
    const content = await safeReadFile(claudeMdPath);
    if (content && content.includes(MARKER_START)) {
      checks.push({
        name: "CLAUDE.md integration",
        status: "PASS",
        message: "Devflow section present",
      });
    } else if (options.fix) {
      await ensureClaudeMdSection(rootPath);
      checks.push({
        name: "CLAUDE.md integration",
        status: "FIXED",
        message: "Devflow section added",
      });
    } else {
      checks.push({
        name: "CLAUDE.md integration",
        status: "FAIL",
        message: "Devflow section missing — run --fix",
      });
    }
  } else if (options.fix) {
    await ensureClaudeMdSection(rootPath);
    checks.push({
      name: "CLAUDE.md integration",
      status: "FIXED",
      message: "CLAUDE.md created with Devflow section",
    });
  } else {
    checks.push({
      name: "CLAUDE.md integration",
      status: "MANUAL",
      message: "CLAUDE.md does not exist — run `devflow init` or --fix",
    });
  }

  // Check 6: Active feature consistency
  const manager = new ArtifactManager(rootPath);
  const activeFeature = await manager.readActiveFeature();
  if (activeFeature) {
    const featurePath = path.join(
      rootPath,
      "_devflow",
      "features",
      activeFeature.featureId
    );
    if (await fileExists(featurePath)) {
      checks.push({
        name: "Active feature",
        status: "PASS",
        message: `${activeFeature.featureId} — directory exists`,
      });
    } else {
      checks.push({
        name: "Active feature",
        status: "FAIL",
        message: `${activeFeature.featureId} — directory missing`,
      });
    }
  } else {
    checks.push({
      name: "Active feature",
      status: "PASS",
      message: "No active feature (normal for early-stage projects)",
    });
  }

  // Print results
  for (const check of checks) {
    const icon =
      check.status === "PASS"
        ? pc.green("✅")
        : check.status === "FIXED"
          ? pc.blue("🔧")
          : check.status === "FAIL"
            ? pc.red("❌")
            : pc.yellow("⚠️");

    console.log(`${icon} ${pc.bold(check.name)}`);
    console.log(`   ${pc.dim(check.message)}`);
  }

  // Summary
  const failed = checks.filter((c) => c.status === "FAIL").length;
  const manual = checks.filter((c) => c.status === "MANUAL").length;
  const fixed = checks.filter((c) => c.status === "FIXED").length;

  console.log();
  if (failed === 0 && manual === 0) {
    console.log(pc.green("✅ All checks passed!"));
  } else {
    if (failed > 0) {
      console.log(pc.red(`❌ ${failed} check(s) failed`));
    }
    if (manual > 0) {
      console.log(pc.yellow(`⚠️  ${manual} check(s) need manual attention`));
    }
    if (fixed > 0) {
      console.log(pc.blue(`🔧 ${fixed} issue(s) auto-fixed`));
    }
    if (!options.fix) {
      console.log(pc.dim("\nRun with --fix to auto-fix issues."));
    }
  }
  console.log(pc.bold("Next Step:"));
  if (failed === 0 && manual === 0) {
    console.log(pc.dim("  All healthy. Run `devflow status` to see current state."));
  } else {
    console.log(pc.dim("  Fix issues above, then run `devflow status` to verify state."));
  }
  console.log();
}
