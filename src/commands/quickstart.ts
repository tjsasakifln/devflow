/**
 * Devflow Quickstart — Interactive Onboarding Wizard
 *
 * 3-step wizard that guides first-time users from zero to running Devflow
 * commands in under 5 minutes. Auto-detects project state and pre-selects defaults.
 *
 * Falls back to text guide in non-interactive mode (CI, --non-interactive, etc.).
 */

import path from "node:path";
import { fileExists } from "../kernel/utils/fs.js";
import { detectStackProfile } from "../kernel/detection/stack.js";
import {
  isInteractive,
  selectOption,
  confirmOrExit,
} from "../kernel/utils/prompts.js";
import pc from "picocolors";

interface QuickstartState {
  projectType: "new" | "existing";
  hasPackageJson: boolean;
  hasDevflow: boolean;
  goal: "build-feature" | "understand-codebase" | "review-code";
}

export async function quickstartCommand(cwd: string): Promise<void> {
  console.log(pc.bold("\nDevflow Quickstart\n"));
  console.log(pc.dim("  3-step onboarding — get from zero to running.\n"));

  if (!isInteractive()) {
    await showTextGuide(cwd);
    return;
  }

  // ── Step 1: "What do you have?" ──
  const projectInfo = await detectProjectState(cwd);

  const projectType = await step1WhatDoYouHave(projectInfo);

  // ── Step 2: "What do you want?" ──
  const goal = await step2WhatDoYouWant();

  // ── Step 3: "Let's go!" ──
  const commands = buildCommandSequence(cwd, { projectType, goal });

  await step3LetsGo(commands);

  // ── Offer to run first command ──
  const firstCmd: CommandStep | undefined = commands[0];
  if (firstCmd) {
    console.log("");
    const runNow = await confirmOrExit(
      `Run "${firstCmd.command}" now?`
    );
    if (runNow) {
      console.log(pc.blue(`\n→ Running: ${firstCmd.command}\n`));
      // The first command is always safe (install, status, or review-pr).
      // We execute via dynamic import — no destructive commands are ever first.
      await executeFirstCommand(cwd, firstCmd.action);
    }
  }

  console.log(pc.green("\n✅ Quickstart complete!\n"));

  if (goal === "build-feature") {
    console.log(pc.bold("Next steps:"));
    console.log(pc.dim(`  devflow feature new "my-feature"`));
    console.log(pc.dim("  → Creates a workspace with requirements, design, actions, and test plan."));
    console.log(pc.dim("  devflow next"));
    console.log(pc.dim("  → Shows what to do after each step."));
  }

  console.log(pc.dim("For help: devflow --help | For health: devflow doctor\n"));
}

// ─────────────────────────────────────────────
// Step 1
// ─────────────────────────────────────────────

interface ProjectDetection {
  hasPackageJson: boolean;
  hasTsconfig: boolean;
  hasGit: boolean;
  hasDevflow: boolean;
  language: string;
}

async function detectProjectState(cwd: string): Promise<ProjectDetection> {
  const [hasPackageJson, hasTsconfig, hasDevflow, stack] = await Promise.all([
    fileExists(path.join(cwd, "package.json")),
    fileExists(path.join(cwd, "tsconfig.json")),
    fileExists(path.join(cwd, ".devflow", "config.json")),
    detectStackProfile(cwd),
  ]);

  const hasGit = await fileExists(path.join(cwd, ".git"));

  return {
    hasPackageJson,
    hasTsconfig,
    hasGit,
    hasDevflow,
    language: stack.language,
  };
}

async function step1WhatDoYouHave(
  info: ProjectDetection,
): Promise<"new" | "existing"> {
  console.log(pc.bold(`\n  [1/3] What do you have?\n`));

  // Auto-detect and pre-select
  const isExisting = info.hasPackageJson || info.hasTsconfig || info.hasGit;

  if (isExisting) {
    const lang = info.language !== "unknown" ? info.language : "code";
    console.log(pc.dim(`  Detected: existing ${lang} project`));
    if (info.hasDevflow) {
      console.log(pc.dim(`  Detected: Devflow already initialized`));
    }

    const result = await selectOption(
      "Confirm your project type:",
      [
        { value: "existing", label: "Existing project", hint: "You have code already" },
        { value: "new", label: "New project", hint: "Starting fresh" },
      ],
    );

    return result === "new" ? "new" : "existing";
  }

  console.log(pc.dim("  No existing project detected."));
  const result = await selectOption(
    "What are you working with?",
    [
      { value: "new", label: "New project", hint: "Starting from scratch" },
      { value: "existing", label: "Existing project", hint: "Already have code" },
    ],
  );

  return result === "new" ? "new" : "existing";
}

// ─────────────────────────────────────────────
// Step 2
// ─────────────────────────────────────────────

async function step2WhatDoYouWant(): Promise<QuickstartState["goal"]> {
  console.log(pc.bold(`\n  [2/3] What do you want?\n`));

  const result = await selectOption(
    "Choose your goal:",
    [
      {
        value: "build-feature",
        label: "Build a feature",
        hint: "Create new functionality with Devflow governance",
      },
      {
        value: "understand-codebase",
        label: "Understand existing codebase",
        hint: "Discover project structure, dependencies, and health",
      },
      {
        value: "review-code",
        label: "Review code changes",
        hint: "Audit AI-generated code, generate PR risk report",
      },
    ],
  );

  return (result ?? "build-feature") as QuickstartState["goal"];
}

// ─────────────────────────────────────────────
// Step 3
// ─────────────────────────────────────────────

interface CommandStep {
  command: string;
  description: string;
  action: string; // key for executeFirstCommand
}

function buildCommandSequence(
  cwd: string,
  state: { projectType: "new" | "existing"; goal: QuickstartState["goal"] },
): CommandStep[] {
  const { projectType, goal } = state;

  // Build-feature scenarios
  if (goal === "build-feature") {
    if (projectType === "new") {
      return [
        {
          command: "devflow install",
          description: "Initialize Devflow in your project — guided setup",
          action: "install",
        },
        {
          command: `devflow feature new "my-first-feature"`,
          description: "Create a feature workspace with requirements template",
          action: "none",
        },
        {
          command: "devflow next",
          description: "See the recommended next action for your feature",
          action: "none",
        },
      ];
    }

    // Existing project
    const installOrStatus = hasDevflowDir(cwd)
      ? {
          command: "devflow status",
          description: "Check current project state and Devflow health",
          action: "status",
        }
      : {
          command: "devflow install",
          description: "Initialize Devflow for this project — no config will be overwritten",
          action: "install",
        };

    return [
      installOrStatus,
      {
        command: `devflow feature new "my-feature"`,
        description: "Create a feature workspace with requirements template",
        action: "none",
      },
      {
        command: "devflow next",
        description: "See the recommended next action for your feature",
        action: "none",
      },
    ];
  }

  // Understand-codebase scenario
  if (goal === "understand-codebase") {
    return [
      {
        command: "devflow discover",
        description: "Map project structure, tech stack, test baseline, and change zones",
        action: "discover",
      },
      {
        command: "devflow status",
        description: "Check current project state and Devflow health",
        action: "status",
      },
      {
        command: "devflow doctor",
        description: "Diagnose and fix common configuration issues",
        action: "doctor",
      },
    ];
  }

  // Review-code scenario
  return [
    {
      command: "devflow review-pr",
      description: "Generate a PR risk report from your uncommitted changes",
      action: "review-pr",
    },
    {
      command: "devflow audit",
      description: "Audit changes for AI-generated code risks",
      action: "audit",
    },
  ];
}

function hasDevflowDir(cwd: string): boolean {
  // Quick synchronous check using node:fs
  const fs = require("node:fs");
  try {
    return fs.existsSync(path.join(cwd, ".devflow", "config.json"));
  } catch {
    return false;
  }
}

async function step3LetsGo(commands: CommandStep[]): Promise<void> {
  console.log(pc.bold(`\n  [3/3] Let's go!\n`));
  console.log(pc.dim("  Here are the commands you need to run, in order:\n"));

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]!;
    const num = `${i + 1}.`;
    console.log(`  ${pc.cyan(num)} ${pc.bold(cmd.command)}`);
    console.log(`      ${pc.dim(cmd.description)}`);
    if (i < commands.length - 1) {
      console.log(`      ${pc.dim("↓")}`);
    }
    console.log("");
  }
}

// ─────────────────────────────────────────────
// First-command execution
// ─────────────────────────────────────────────

async function executeFirstCommand(
  cwd: string,
  action: string,
): Promise<void> {
  switch (action) {
    case "install": {
      const { installCommand } = await import("./install.js");
      await installCommand(cwd, { nonInteractive: true });
      break;
    }
    case "status": {
      const { statusCommand } = await import("./status.js");
      await statusCommand(cwd, { json: false, verbose: false });
      break;
    }
    case "discover": {
      const { discoverCommand } = await import("./discover.js");
      await discoverCommand(cwd);
      break;
    }
    case "doctor": {
      const { doctorCommand } = await import("./doctor.js");
      await doctorCommand(cwd, { fix: false, dryRun: false });
      break;
    }
    case "review-pr": {
      const { reviewPrCommand } = await import("../cli/review-pr.js");
      await reviewPrCommand(cwd, {
        base: "main",
        json: false,
      });
      break;
    }
    case "audit": {
      const { auditCommand } = await import("../cli/audit.js");
      // Minimal options — audit works without feature setup
      const { execSync } = await import("node:child_process");
      const changedFiles = execSync(
        "git diff --name-only HEAD",
        { encoding: "utf-8", cwd },
      ).trim();
      if (!changedFiles) {
        console.log(pc.yellow("  No staged or working-tree changes to audit."));
        console.log(pc.dim("  Run `devflow audit --staged` after git add.\n"));
        return;
      }
      await auditCommand(cwd, {
        staged: false,
        workingTree: true,
        base: "main",
        format: "markdown",
        riskTolerance: undefined,
        output: undefined,
      });
      break;
    }
    default:
      console.log(pc.dim("  (no auto-execution available for this command)"));
  }
}

// ─────────────────────────────────────────────
// Non-interactive fallback
// ─────────────────────────────────────────────

async function showTextGuide(cwd: string): Promise<void> {
  console.log(pc.yellow("  Non-interactive mode — showing text guide.\n"));

  const info = await detectProjectState(cwd);
  const typeLabel = info.hasPackageJson || info.hasTsconfig || info.hasGit
    ? "existing"
    : "new";

  console.log(pc.bold("Detected project type:"), typeLabel);
  console.log(pc.bold("Language:"), info.language !== "unknown" ? info.language : "not detected");
  console.log(pc.bold("Devflow:"), info.hasDevflow ? "initialized" : "not initialized");
  console.log("");

  if (typeLabel === "new") {
    console.log(pc.bold("Recommended commands:"));
    console.log(`  1. ${pc.cyan("devflow install")}`);
    console.log(`     ${pc.dim("Initialize Devflow — guided first-run setup")}`);
    console.log(`  2. ${pc.cyan(`devflow feature new "my-feature"`)}`);
    console.log(`     ${pc.dim("Create your first feature workspace")}`);
    console.log(`  3. ${pc.cyan("devflow next")}`);
    console.log(`     ${pc.dim("See recommended next action")}`);
  } else if (info.hasDevflow) {
    console.log(pc.bold("Recommended commands:"));
    console.log(`  1. ${pc.cyan("devflow status")}`);
    console.log(`     ${pc.dim("Check current project state")}`);
    console.log(`  2. ${pc.cyan(`devflow feature new "my-feature"`)}`);
    console.log(`     ${pc.dim("Create a feature workspace")}`);
    console.log(`  3. ${pc.cyan("devflow next")}`);
    console.log(`     ${pc.dim("See recommended next action")}`);
  } else {
    console.log(pc.bold("Recommended commands:"));
    console.log(`  1. ${pc.cyan("devflow install")}`);
    console.log(`     ${pc.dim("Initialize Devflow for this project")}`);
    console.log(`  2. ${pc.cyan(`devflow feature new "my-feature"`)}`);
    console.log(`     ${pc.dim("Create your first feature workspace")}`);
    console.log(`  3. ${pc.cyan("devflow next")}`);
    console.log(`     ${pc.dim("See recommended next action")}`);
  }

  console.log("");
  console.log(pc.dim("Run `devflow --help` to see all available commands."));
  console.log(pc.dim("Run `devflow quickstart` in an interactive terminal for the guided wizard.\n"));
}
