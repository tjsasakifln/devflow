/**
 * Devflow Install Command
 *
 * User-friendly first-run experience. Wraps `init` with guided onboarding,
 * stack detection, environment checks, and contextual next-step guidance.
 *
 * `install` is for users; `init` is for scripts.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initCommand } from "./init.js";
import { updateCockpitCommand } from "./update-cockpit.js";
import { doctorCommand } from "./doctor.js";
import { detectStackProfile } from "../kernel/detection/stack.js";
import { fileExists } from "../kernel/utils/fs.js";
import { resolveInvocationCommand } from "../kernel/utils/cli-resolver.js";
import pc from "picocolors";

export interface InstallOptions {
  yes?: boolean;
  mode?: string;
  agent?: "claude" | "cursor" | "none";
  reviewMode?: "independent" | "solo-hardened";
  nonInteractive?: boolean;
  dryRun?: boolean;
}

export async function installCommand(
  rootPath: string,
  options: InstallOptions = {},
): Promise<void> {
  const cwd = rootPath;

  console.log(pc.bold("\n🧩 Devflow Install\n"));
  console.log(pc.dim("Set up Devflow in your project — guided first-run experience.\n"));

  // ── Dry run ──
  if (options.dryRun) {
    console.log(pc.yellow("DRY RUN — no files will be written.\n"));

    // Detect and report stack
    const stack = await detectStackProfile(cwd);
    console.log(pc.bold("Stack Detection:"));
    console.log(`  Language:       ${stack.language}`);
    console.log(`  Package Manager: ${stack.packageManager ?? "none"}`);
    console.log(`  Test Framework:  ${stack.testFramework ?? "not detected"}`);
    console.log(`  Linter:          ${stack.linter ?? "not detected"}`);
    console.log(`  Type Checker:    ${stack.typeChecker ?? "not detected"}`);
    console.log(`  CI:              ${stack.hasCI ? stack.ciProvider : "none"}`);
    console.log(`  Docker:          ${stack.hasDocker ? "yes" : "no"}`);
    console.log();

    // Environment checks
    console.log(pc.bold("Environment Checks:"));
    try {
      const nodeVersion = process.version;
      console.log(`  Node.js: ${pc.green("✓")} ${nodeVersion}`);
    } catch {
      console.log(`  Node.js: ${pc.red("✗")} not found`);
    }

    try {
      const gitUser = execSync("git config user.name", { encoding: "utf-8", timeout: 5000 }).trim();
      console.log(`  Git user: ${pc.green("✓")} ${gitUser}`);
    } catch {
      console.log(`  Git user: ${pc.yellow("⚠")} not configured`);
    }

    const alreadyInit = await fileExists(`${cwd}/.devflow/config.json`);
    if (alreadyInit) {
      console.log(`  Devflow:  ${pc.yellow("⚠")} already initialized`);
    } else {
      console.log(`  Devflow:  ${pc.green("✓")} ready to initialize`);
    }
    console.log();

    console.log(pc.bold("What will be created:"));
    console.log("  .devflow/           — configuration, state, audits, decisions");
    console.log("  _devflow/           — features, discovery, specs");
    console.log("  DEVFLOW.md          — project cockpit (auto-generated)");
    console.log("  CLAUDE.md           — Devflow section for Claude Code integration");
    console.log();

    console.log(pc.dim("Run without --dry-run to apply.\n"));
    return;
  }

  // ── Environment checks ──
  console.log(pc.blue("→") + " Checking environment...\n");

  // Node.js
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.replace("v", "").split(".")[0] ?? "0", 10);
  if (major < 18) {
    console.log(pc.red(`  Node.js ${nodeVersion} — version >= 18 required.`));
    console.log(pc.yellow("  Install Node.js >= 18: https://nodejs.org\n"));
    return;
  }
  console.log(`  ${pc.green("✓")} Node.js ${nodeVersion}`);

  // Git
  try {
    const gitUser = execSync("git config user.name", { encoding: "utf-8", timeout: 5000 }).trim();
    console.log(`  ${pc.green("✓")} Git configured (${gitUser})`);
  } catch {
    console.log(`  ${pc.yellow("⚠")} Git user not configured. Some features require Git.`);
    console.log(pc.dim("    Run: git config --global user.name \"Your Name\""));
    console.log(pc.dim("    Run: git config --global user.email \"you@example.com\""));
  }

  // Devflow already?
  const alreadyInit = await fileExists(`${cwd}/.devflow/config.json`);
  if (alreadyInit) {
    const resolved = await resolveInvocationCommand(cwd);
    const hasPackageJson = await fileExists(`${cwd}/package.json`);
    console.log(`  ${pc.yellow("⚠")} Devflow already initialized in this directory.\n`);
    if (resolved.mode === "none") {
      console.log(pc.yellow("  Devflow is already initialized in this directory, but the CLI is not installed persistently."));
      if (hasPackageJson) {
        console.log(pc.dim(`  Use \`${resolved.command} status\` now, or run \`npm install --save-dev @tjsasakinpm/devflow\` to enable \`npx devflow status\` / local scripts.\n`));
      } else {
        console.log(pc.dim(`  Use \`${resolved.command} status\` now, or install globally: \`npm install -g @tjsasakinpm/devflow\`.\n`));
      }
    } else {
      console.log(pc.dim(`Run ${resolved.command} status to see current state.`));
      console.log(pc.dim(`Run ${resolved.command} doctor to verify health.\n`));
    }
    return;
  }

  console.log();

  // ── Stack detection ──
  const stack = await detectStackProfile(cwd);
  console.log(pc.blue("→") + ` Stack detected: ${pc.bold(stack.language)}`);

  if (stack.language === "unknown") {
    console.log(pc.yellow("  Could not identify the project stack."));
    console.log(pc.dim("  Devflow will work in diagnostic mode. Configure tools in .devflow/config.json.\n"));
  } else {
    if (stack.testFramework) console.log(`  Test:     ${stack.testFramework}`);
    if (stack.linter) console.log(`  Lint:     ${stack.linter}`);
    if (stack.typeChecker) console.log(`  Type:     ${stack.typeChecker}`);
  }
  console.log();

  // ── Initialize ──
  console.log(pc.blue("→") + " Initializing Devflow...\n");
  await initCommand(cwd);

  // ── Configure review mode if specified ──
  if (options.reviewMode === "solo-hardened") {
    try {
      const { ConfigManager } = await import("../kernel/config/index.js");
      const mgr = new ConfigManager(cwd);
      const config = await mgr.load();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config as any).reviewMode = "solo-hardened";
      await mgr.save(config);
      console.log(pc.yellow("  Review mode: solo-hardened (self-approval with compensating evidence)"));
    } catch { /* ignore */ }
  }

  // ── Run doctor ──
  console.log(pc.blue("\n→") + " Running health check...\n");
  await doctorCommand(cwd, { fix: false, dryRun: false });

  // ── Regenerate cockpit ──
  await updateCockpitCommand(cwd);

  // ── Git hooks (opt-in) ──
  await installGitHooks(cwd, options);

  // ── Onboarding ──
  console.log(pc.green("\n✅ Devflow installed. AI code governance active.\n"));

  // Determine persona
  const reviewMode = options.reviewMode ?? "independent";
  const execMode = options.mode ?? "local";

  if (reviewMode === "solo-hardened") {
    console.log(pc.bold("🧑‍💻 Solo Builder Setup"));
    console.log(pc.dim("  Working alone? Devflow becomes your second pair of eyes."));
    console.log(pc.dim("  Self-approval OK. Adversarial review compensates for missing reviewer."));
  } else if (execMode === "strict" || execMode === "release") {
    console.log(pc.bold("🏢 Strict/Release Setup"));
    console.log(pc.dim("  CI required. All gates blocking. Unknown actors blocked."));
    console.log(pc.dim("  Full audit trail. Implementer ≠ approver enforced."));
  } else {
    console.log(pc.bold("👥 Team Setup"));
    console.log(pc.dim("  Implementer ≠ approver enforced (Constitution C12)."));
    console.log(pc.dim("  Independent review required before merge."));
  }

  console.log();
  console.log(pc.bold("Problem it solves:"));
  console.log(pc.dim("  AI agents (Claude Code, Cursor, Copilot) ship code without"));
  console.log(pc.dim("  requirements, tests, or review. Devflow enforces evidence before merge."));
  console.log();
  const resolvedNext = await resolveInvocationCommand(cwd);
  console.log(pc.bold("Next steps:"));
  console.log(pc.cyan(`  ${resolvedNext.command} feature new "your-feature"`));
  console.log(pc.dim("  → Creates workspace, asks what problem you're solving."));
  console.log();
  console.log(pc.cyan(`  ${resolvedNext.command} next`));
  console.log(pc.dim("  → Shows what to do after each step."));
  console.log();
  console.log(pc.cyan(`  ${resolvedNext.command} review-pr`));
  console.log(pc.dim("  → Generates a risk report you can paste in any PR."));
  console.log();
  console.log(pc.dim(`For help: ${resolvedNext.command} --help | For health: ${resolvedNext.command} doctor\n`));
}

/**
 * Install git hooks (opt-in). Copies hook templates to .git/hooks/
 * and sets hooksEnabled: true in Devflow config.
 */
async function installGitHooks(
  _cwd: string,
  options: InstallOptions,
): Promise<void> {
  // Skip in dry-run or non-interactive mode (user didn't explicitly opt in)
  if (options.dryRun || options.nonInteractive) return;

  // Locate hook templates relative to this source file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const templatesDir = path.resolve(__dirname, "..", "..", "templates", "hooks");
  const gitDir = path.join(_cwd, ".git");

  if (!fs.existsSync(gitDir)) {
    console.log(pc.dim("\n→ Git repository not found — skipping hook installation.\n"));
    return;
  }

  if (!fs.existsSync(templatesDir)) {
    // Templates not available (e.g., running from dist/ without templates/)
    console.log(pc.dim("\n→ Hook templates not found — skipping hook installation.\n"));
    console.log(pc.dim("  Templates are included with the npm package. Reinstall if needed.\n"));
    return;
  }

  const hooksDir = path.join(gitDir, "hooks");
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  // Check if hooks already installed
  const preCommitPath = path.join(hooksDir, "pre-commit");
  const prePushPath = path.join(hooksDir, "pre-push");
  const alreadyInstalled = fs.existsSync(preCommitPath) || fs.existsSync(prePushPath);

  if (alreadyInstalled && options.yes) {
    console.log(pc.dim("\nGit hooks already installed.\n"));
    return;
  }

  // In non-interactive mode with --yes, auto-install
  const shouldInstall = options.yes || alreadyInstalled;

  if (!shouldInstall) {
    console.log(pc.yellow("\n→ Git hooks (optional) — enforce Devflow gates automatically:\n"));
    console.log(pc.dim("  pre-commit: Block commits to main/master, block when CANNOT CODE"));
    console.log(pc.dim("  pre-push:   Warn if DoD checks not run before pushing feature branch\n"));
    console.log(pc.dim("  To install later, run: npx @tjsasakinpm/devflow install\n"));
    console.log(pc.dim("  Hooks can be bypassed with: git commit --no-verify / git push --no-verify\n"));
    return;
  }

  try {
    const preCommitSrc = path.join(templatesDir, "pre-commit");
    const prePushSrc = path.join(templatesDir, "pre-push");

    if (fs.existsSync(preCommitSrc)) {
      fs.copyFileSync(preCommitSrc, preCommitPath);
      fs.chmodSync(preCommitPath, 0o755);
      console.log(pc.green(`  ✓ pre-commit hook installed`));
    }

    if (fs.existsSync(prePushSrc)) {
      fs.copyFileSync(prePushSrc, prePushPath);
      fs.chmodSync(prePushPath, 0o755);
      console.log(pc.green(`  ✓ pre-push hook installed`));
    }

    // Update config
    try {
      const { ConfigManager } = await import("../kernel/config/index.js");
      const mgr = new ConfigManager(_cwd);
      const config = await mgr.load();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config as any).hooksEnabled = true;
      await mgr.save(config);
    } catch { /* config update is best-effort */ }

    console.log(pc.green("\n✅ Git hooks installed. Devflow gates will run automatically.\n"));
    console.log(pc.dim("   Hooks are optional and can be removed: rm .git/hooks/pre-commit .git/hooks/pre-push"));
    console.log(pc.dim("   Bypass when needed: git commit --no-verify / git push --no-verify\n"));
  } catch (err) {
    console.log(pc.yellow(`\n⚠️  Could not install git hooks: ${err instanceof Error ? err.message : err}\n`));
  }
}
