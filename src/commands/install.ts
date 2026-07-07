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
    console.log(`  ${pc.yellow("⚠")} Devflow already initialized in this directory.\n`);
    console.log(pc.dim("Run devflow status to see current state."));
    console.log(pc.dim("Run devflow doctor to verify health.\n"));
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
  console.log(pc.green("\n✅ Devflow installed successfully!\n"));
  console.log(pc.bold("What's next:\n"));

  const isBrownfield = stack.language !== "unknown";
  if (isBrownfield) {
    console.log(pc.bold("  Brownfield Project (existing code detected)"));
    console.log(pc.dim("  1. Discover the codebase:"));
    console.log(pc.cyan("     devflow discover"));
    console.log(pc.dim("  2. Read the discovery reports in _devflow/discovery/"));
    console.log(pc.dim("  3. Create your first feature:"));
    console.log(pc.cyan("     devflow feature new \"your-feature-name\""));
    console.log(pc.dim("  4. Follow the guidance:"));
    console.log(pc.cyan("     devflow next"));
  } else {
    console.log(pc.bold("  Greenfield Project (new or minimal code)"));
    console.log(pc.dim("  1. Create your first feature:"));
    console.log(pc.cyan("     devflow feature new \"your-feature-name\""));
    console.log(pc.dim("  2. Fill in the requirements interactively"));
    console.log(pc.dim("  3. Follow the guidance:"));
    console.log(pc.cyan("     devflow next"));
  }

  console.log();
  console.log(pc.bold("  With AI Agent (Claude Code, Cursor, etc.)"));
  console.log(pc.dim("  1. Tell your agent to read DEVFLOW.md first"));
  console.log(pc.dim("  2. Agent must check 'Current Instruction for Agents' section"));
  console.log(pc.dim("  3. Agent must NOT write code before feature-coding-ready state"));
  console.log(pc.dim("  4. Use the implementation prompt when ready:"));
  console.log(pc.cyan("     devflow feature prompt <id> --copy"));

  console.log();
  console.log(pc.dim("For help: devflow --help"));
  console.log(pc.dim("For health: devflow doctor\n"));
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
