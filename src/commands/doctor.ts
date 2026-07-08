import path from "node:path";
import { execSync } from "node:child_process";
import { ArtifactManager } from "../artifacts/manager.js";
import { inspectProject } from "../project/inspector.js";
import { detectState } from "../engine/state-detector.js";
import { computeRecommendation } from "../engine/next-action.js";
import { generateCockpit } from "../cockpit/generator.js";
import { fileExists, ensureDir } from "../utils/fs.js";
import { getVersion } from "../kernel/utils/version.js";
import { renderRemediation } from "../errors/remediation.js";
import type { Remediation } from "../errors/remediation.js";
import pc from "picocolors";

interface DoctorCheck {
  id: number;
  name: string;
  status: "PASS" | "FIXED" | "FAIL" | "MANUAL" | "INFO";
  message: string;
  remediation?: Remediation;
}

export async function doctorCommand(
  cwd: string,
  options: { fix?: boolean; dryRun?: boolean }
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const checks: DoctorCheck[] = [];

  console.log(pc.bold("\nDevflow Doctor — Guided Rescue\n"));
  console.log(pc.dim("═".repeat(55)));
  console.log(pc.dim("Diagnosing project and environment...\n"));

  if (options.dryRun) {
    console.log(pc.yellow("  Dry run mode — no changes will be applied.\n"));
  }

  const canFix = options.fix && !options.dryRun;

  // ── 1. Node version ──
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.replace("v", "").split(".")[0] || "0", 10);
  if (nodeMajor >= 18) {
    checks.push({ id: 1, name: "Node.js version", status: "PASS", message: `${nodeVersion} (>= 18)` });
  } else {
    checks.push({
      id: 1, name: "Node.js version", status: "FAIL",
      message: `${nodeVersion} — Devflow requires Node.js >= 18`,
      remediation: {
        title: "Node.js too old",
        whyMatters: "Devflow uses modern JavaScript APIs (ESNext) that require Node 18+.",
        impact: "Commands may crash with syntax errors or missing API errors.",
        suggestedFix: "Install Node.js 18+ via nvm: nvm install 18 && nvm use 18",
        minimalExample: "nvm install 18.17.0",
        severity: "blocking",
        copyableCommand: "nvm install 18 && nvm use 18",
      },
    });
  }

  // ── 2. Git available + configured ──
  try {
    execSync("git --version", { cwd: rootPath, encoding: "utf-8" });
    const userName = execSync("git config user.name", { cwd: rootPath, encoding: "utf-8" }).trim();
    checks.push({ id: 2, name: "Git configured", status: "PASS", message: `user.name = "${userName}"` });
  } catch {
    checks.push({
      id: 2, name: "Git configured", status: "FAIL",
      message: "Git not available or user not configured",
      remediation: {
        title: "Git missing or unconfigured",
        whyMatters: "Devflow uses Git for branching, evidence tracking, and commit SHA in audit logs.",
        impact: "Feature branches, gatekeep audit trail, and rollback won't work.",
        suggestedFix: "Install Git and configure: git config --global user.name and user.email",
        minimalExample: "git config --global user.name \"Your Name\"",
        severity: "advisory",
        copyableCommand: "git config --global user.name \"Your Name\"",
      },
    });
  }

  // ── 3. File permissions ──
  const devflowDir = path.join(rootPath, ".devflow");
  if (await fileExists(devflowDir)) {
    checks.push({ id: 3, name: ".devflow/ readable", status: "PASS", message: "Directory accessible" });
  } else {
    checks.push({ id: 3, name: ".devflow/ readable", status: "INFO", message: "Not yet initialized — expected before first use" });
  }

  // ── 4. .devflow/ + _devflow/ presence ──
  if (await fileExists(devflowDir)) {
    checks.push({ id: 4, name: "Devflow directories", status: "PASS", message: ".devflow/ and _devflow/ exist" });
  } else if (canFix) {
    await ensureDir(devflowDir);
    await ensureDir(path.join(devflowDir, "decisions"));
    await ensureDir(path.join(devflowDir, "audits"));
    await ensureDir(path.join(devflowDir, "context"));
    const manager = new ArtifactManager(rootPath);
    await manager.scaffoldAll();
    checks.push({ id: 4, name: "Devflow directories", status: "FIXED", message: "Created .devflow/ and _devflow/" });
  } else {
    checks.push({
      id: 4, name: "Devflow directories", status: "FAIL",
      message: ".devflow/ missing — run devflow install",
      remediation: {
        title: "Devflow not initialized",
        whyMatters: "All Devflow state, checks, and audits live in .devflow/. Without it, nothing works.",
        impact: "No commands except init and doctor will function.",
        suggestedFix: "Run `devflow install` to scaffold the project.",
        minimalExample: "devflow install",
        severity: "blocking",
        copyableCommand: "devflow install",
      },
    });
  }

  // ── 5. state.json consistency ──
  const stateFile = path.join(devflowDir, "state.json");
  if (await fileExists(stateFile)) {
    const manager = new ArtifactManager(rootPath);
    const state = await manager.readState();
    if (state?.currentState) {
      // Cross-reference with filesystem
      const activeId = state.activeFeatureId;
      if (activeId) {
        const featureDir = path.join(rootPath, "_devflow", "features", activeId);
        if (await fileExists(featureDir)) {
          checks.push({ id: 5, name: "state.json consistency", status: "PASS", message: `state=${state.currentState}, active feature dir present` });
        } else {
          checks.push({
            id: 5, name: "state.json consistency", status: "FAIL",
            message: `state.json references ${activeId} but directory missing`,
            remediation: {
              title: "state.json out of sync",
              whyMatters: "Devflow's state machine drives all recommendations; stale state means wrong advice.",
              impact: "`devflow next` and `devflow status` will show incorrect diagnostics.",
              suggestedFix: "Run `devflow update-cockpit` or `devflow doctor --fix` to regenerate state.",
              minimalExample: "devflow update-cockpit",
              severity: "blocking",
              copyableCommand: "devflow update-cockpit",
            },
          });
        }
      } else {
        checks.push({ id: 5, name: "state.json consistency", status: "PASS", message: `state=${state.currentState}, no active feature` });
      }
    } else if (canFix) {
      const inspection = await inspectProject(rootPath);
      const stateResult = await detectState(inspection);
      await manager.writeState({
        currentState: stateResult.currentState,
        previousState: null,
        confidence: stateResult.confidence,
        lastUpdated: new Date().toISOString(),
        activeFeatureId: inspection.activeFeature?.id ?? null,
        blockers: stateResult.blockers,
      });
      checks.push({ id: 5, name: "state.json consistency", status: "FIXED", message: `Regenerated → ${stateResult.currentState}` });
    } else {
      checks.push({
        id: 5, name: "state.json consistency", status: "FAIL",
        message: "state.json invalid or corrupt — run --fix",
      });
    }
  } else {
    checks.push({ id: 5, name: "state.json consistency", status: "INFO", message: "Not yet initialized" });
  }

  // ── 6. Current branch ──
  try {
    const branch = execSync("git branch --show-current", { cwd: rootPath, encoding: "utf-8" }).trim();
    if (branch === "main" || branch === "master") {
      checks.push({
        id: 6, name: "Current branch", status: "INFO",
        message: `${branch} — working on default branch is allowed but risky for feature work`,
        remediation: {
          title: "On default branch",
          whyMatters: "Working directly on main/master bypasses the feature branch workflow and makes rollback harder.",
          impact: "Cannot easily revert feature work without reverting all commits.",
          suggestedFix: "Create a feature branch: git checkout -b feature/my-feature",
          minimalExample: "git checkout -b feature/001-cancel-subscription",
          severity: "advisory",
          copyableCommand: "git checkout -b feature/my-feature",
        },
      });
    } else {
      checks.push({ id: 6, name: "Current branch", status: "PASS", message: branch });
    }
  } catch {
    checks.push({ id: 6, name: "Current branch", status: "INFO", message: "Cannot detect (git may not be initialized)" });
  }

  // ── 7. package.json scripts ──
  const pkgPath = path.join(rootPath, "package.json");
  if (await fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(await (await import("node:fs/promises")).readFile(pkgPath, "utf-8"));
      const scripts = Object.keys(pkg.scripts || {});
      const hasTest = scripts.some((s: string) => s === "test" || s.startsWith("test:"));
      const hasBuild = scripts.some((s: string) => s === "build" || s.startsWith("build:"));
      const msgs: string[] = [];
      if (!hasTest) msgs.push("no test script");
      if (!hasBuild) msgs.push("no build script");
      if (msgs.length > 0) {
        checks.push({
          id: 7, name: "package.json scripts", status: "INFO",
          message: `${msgs.join(", ")} — consider adding them`,
        });
      } else {
        checks.push({ id: 7, name: "package.json scripts", status: "PASS", message: "test and build scripts present" });
      }
    } catch {
      checks.push({ id: 7, name: "package.json scripts", status: "INFO", message: "Cannot parse package.json" });
    }
  } else {
    checks.push({ id: 7, name: "package.json scripts", status: "INFO", message: "No package.json (non-Node project?)" });
  }

  // ── 8. CI config ──
  const hasGhActions = await fileExists(path.join(rootPath, ".github", "workflows"));
  const hasGitlabCi = await fileExists(path.join(rootPath, ".gitlab-ci.yml"));
  if (hasGhActions || hasGitlabCi) {
    checks.push({
      id: 8, name: "CI configuration", status: "PASS",
      message: hasGhActions ? "GitHub Actions detected" : "GitLab CI detected",
    });
  } else {
    checks.push({
      id: 8, name: "CI configuration", status: "INFO",
      message: "No CI detected — recommended for strict/release modes",
      remediation: {
        title: "CI not configured",
        whyMatters: "In strict/release mode, CI green is a blocking requirement for approval.",
        impact: "Gatekeep in strict/release mode will block without CI verification.",
        suggestedFix: "Set up GitHub Actions or GitLab CI with test/typecheck/lint jobs.",
        minimalExample: ".github/workflows/test.yml with vitest run + tsc + eslint",
        severity: "advisory",
      },
    });
  }

  // ── 9. Artifact state consistency ──
  const manager = new ArtifactManager(rootPath);
  const activeFeature = await manager.readActiveFeature();
  if (activeFeature) {
    const featurePath = path.join(rootPath, "_devflow", "features", activeFeature.featureId);
    if (await fileExists(featurePath)) {
      const artifacts = {
        "requirements.md": await fileExists(path.join(featurePath, "requirements.md")),
        "roadmap.md": await fileExists(path.join(featurePath, "roadmap.md")),
        "actions.md": await fileExists(path.join(featurePath, "actions.md")),
        "test-plan.md": await fileExists(path.join(featurePath, "test-plan.md")),
        "implementation-log.jsonl": await fileExists(path.join(featurePath, "implementation-log.jsonl")),
      };
      const present = Object.entries(artifacts).filter(([, exists]) => exists).length;
      const total = Object.keys(artifacts).length;
      const missing = Object.entries(artifacts).filter(([, exists]) => !exists).map(([name]) => name);
      if (present === total) {
        checks.push({ id: 9, name: "Artifact consistency", status: "PASS", message: `${present}/${total} artifacts present` });
      } else {
        checks.push({
          id: 9, name: "Artifact consistency", status: "INFO",
          message: `${present}/${total} artifacts present — missing: ${missing.join(", ")}`,
        });
      }
    } else {
      checks.push({
        id: 9, name: "Artifact consistency", status: "FAIL",
        message: `Active feature ${activeFeature.featureId} directory missing`,
      });
    }
  } else {
    checks.push({ id: 9, name: "Artifact consistency", status: "PASS", message: "No active feature" });
  }

  // ── 10. Git remote ──
  try {
    const remotes = execSync("git remote -v", { cwd: rootPath, encoding: "utf-8" }).trim();
    if (remotes) {
      checks.push({ id: 10, name: "Git remote", status: "PASS", message: "Remote configured" });
    } else {
      checks.push({
        id: 10, name: "Git remote", status: "INFO",
        message: "No git remote — push and CI integration won't work",
      });
    }
  } catch {
    checks.push({ id: 10, name: "Git remote", status: "INFO", message: "Not a git repository or no remote" });
  }

  // ── 11. DEVFLOW.md staleness ──
  const devflowMdPath = path.join(rootPath, "DEVFLOW.md");
  if (await fileExists(devflowMdPath)) {
    try {
      const { stat } = await import("node:fs/promises");
      const devflowStat = await stat(devflowMdPath);
      if (await fileExists(stateFile)) {
        const stateStat = await stat(stateFile);
        const diffMs = Math.abs(devflowStat.mtimeMs - stateStat.mtimeMs);
        if (diffMs < 60_000) {
          checks.push({ id: 11, name: "DEVFLOW.md freshness", status: "PASS", message: "In sync with state.json" });
        } else {
          checks.push({
            id: 11, name: "DEVFLOW.md freshness", status: canFix ? "FIXED" : "INFO",
            message: canFix ? "Regenerated" : "Stale — run devflow update-cockpit",
            remediation: {
              title: "DEVFLOW.md is stale",
              whyMatters: "Agents read DEVFLOW.md for context before coding. Stale context leads to wrong assumptions.",
              impact: "Claude/Cursor may generate code based on outdated state.",
              suggestedFix: "Run `devflow update-cockpit` to regenerate.",
              minimalExample: "devflow update-cockpit",
              severity: "advisory",
              copyableCommand: "devflow update-cockpit",
            },
          });
          if (canFix) {
            const inspection = await inspectProject(rootPath);
            const stateResult = await detectState(inspection);
            const recommendation = computeRecommendation(stateResult, inspection);
            const cockpit = generateCockpit(stateResult, recommendation, inspection);
            await manager.safeWrite(devflowMdPath, cockpit, "DEVFLOW.md");
          }
        }
      } else {
        checks.push({ id: 11, name: "DEVFLOW.md freshness", status: "INFO", message: "Cannot verify (no state.json)" });
      }
    } catch {
      checks.push({ id: 11, name: "DEVFLOW.md freshness", status: "INFO", message: "Cannot read file stats" });
    }
  } else if (canFix) {
    const inspection = await inspectProject(rootPath);
    const stateResult = await detectState(inspection);
    const recommendation = computeRecommendation(stateResult, inspection);
    const cockpit = generateCockpit(stateResult, recommendation, inspection);
    await manager.safeWrite(devflowMdPath, cockpit, "DEVFLOW.md");
    checks.push({ id: 11, name: "DEVFLOW.md freshness", status: "FIXED", message: "Created DEVFLOW.md" });
  } else {
    checks.push({
      id: 11, name: "DEVFLOW.md freshness", status: "INFO",
      message: "DEVFLOW.md missing — run devflow update-cockpit",
    });
  }

  // ── 12. Constitution config ──
  const constitutionPath = path.join(rootPath, ".devflow", "constitution.md");
  if (await fileExists(constitutionPath)) {
    checks.push({ id: 12, name: "Constitution config", status: "PASS", message: "constitution.md present" });
  } else {
    checks.push({
      id: 12, name: "Constitution config", status: "INFO",
      message: "No custom constitution — Devflow uses built-in 12-rule constitution (C1-C12)",
    });
  }

  // ── 13. CI references .devflow (gitignored) ──
  {
    const ciPath = path.join(rootPath, ".github", "workflows", "ci.yml");
    const gitignorePath = path.join(rootPath, ".gitignore");
    let devflowIgnored = false;
    let ciRefsDevflow = false;

    if (await fileExists(gitignorePath)) {
      try {
        const { readFile } = await import("node:fs/promises");
        const gitignoreContent = await readFile(gitignorePath, "utf-8");
        devflowIgnored = /^\.devflow\/?\s*$/m.test(gitignoreContent);
      } catch { /* ignore */ }
    }

    if (await fileExists(ciPath)) {
      try {
        const { readFile } = await import("node:fs/promises");
        const ciContent = await readFile(ciPath, "utf-8");
        ciRefsDevflow = ciContent.includes(".devflow/");
      } catch { /* ignore */ }
    }

    if (devflowIgnored && ciRefsDevflow) {
      checks.push({
        id: 13, name: "CI .devflow/ references", status: "FAIL",
        message: "CI workflow references .devflow/ but it is gitignored — CI won't have these files",
        remediation: {
          title: "CI references unversioned files",
          whyMatters: "CI runs on a clean checkout. Files in .gitignore are not available to CI jobs.",
          impact: "CI steps referencing .devflow/ will fail with 'file not found' errors.",
          suggestedFix: "Move CI config references to versioned paths (e.g., src/kernel/artifacts/tool-configs/) or generate them in CI before use.",
          minimalExample: "Reference src/kernel/artifacts/tool-configs/eslintrc.constitution.json instead of .devflow/eslintrc.constitution.json",
          severity: "blocking",
        },
      });
    } else if (devflowIgnored && !ciRefsDevflow) {
      checks.push({ id: 13, name: "CI .devflow/ references", status: "PASS", message: "CI does not reference gitignored .devflow/ paths" });
    } else {
      checks.push({ id: 13, name: "CI .devflow/ references", status: "INFO", message: "CI not detected or .devflow/ not gitignored" });
    }
  }

  // ── 14. CLI version — record only; sync check only for Devflow's own repo ──
  {
    const cliVersion = getVersion();
    let pkgName = "";
    let pkgVersion = "unknown";
    if (await fileExists(pkgPath)) {
      try {
        const { readFile } = await import("node:fs/promises");
        const pkgRaw = await readFile(pkgPath, "utf-8");
        const pkg = JSON.parse(pkgRaw);
        pkgName = pkg.name || "";
        pkgVersion = pkg.version || "unknown";
      } catch { /* ignore */ }
    }

    // Only compare versions when running inside Devflow's own repository
    if (pkgName === "@tjsasakinpm/devflow") {
      if (cliVersion === pkgVersion) {
        checks.push({ id: 14, name: "CLI version sync", status: "PASS", message: `CLI ${cliVersion} matches package.json ${pkgVersion}` });
      } else {
        checks.push({
          id: 14, name: "CLI version sync", status: "FAIL",
          message: `CLI reports ${cliVersion} but package.json is ${pkgVersion}`,
          remediation: {
            title: "Version mismatch",
            whyMatters: "Audit logs record the CLI version. If it doesn't match package.json, evidence is unreliable.",
            impact: "Gatekeep and audit logs may report incorrect version, breaking traceability.",
            suggestedFix: "Ensure getVersion() reads from the correct package.json and rebuild.",
            minimalExample: "npm run build",
            severity: "blocking",
          },
        });
      }
    } else {
      // External project: just record CLI version, don't compare
      checks.push({ id: 14, name: "CLI version", status: "INFO", message: `Devflow CLI ${cliVersion} (project: ${pkgName || path.basename(rootPath)} ${pkgVersion})` });
    }
  }

  // ── 15. CI tools in devDependencies ──
  {
    const ciPath = path.join(rootPath, ".github", "workflows", "ci.yml");
    if (await fileExists(ciPath) && await fileExists(pkgPath)) {
      try {
        const { readFile } = await import("node:fs/promises");
        const ciContent = await readFile(ciPath, "utf-8");
        const pkgRaw = await readFile(pkgPath, "utf-8");
        const pkg = JSON.parse(pkgRaw);
        const devDeps = Object.keys(pkg.devDependencies || {});
        const deps = Object.keys(pkg.dependencies || {});

        // Extract npx tool names from CI steps
        const npxMatches = ciContent.matchAll(/npx\s+(\S+)/g);
        const ciTools = new Set<string>();
        for (const m of npxMatches) {
          const tool = (m[1] ?? "").split(" ")[0] ?? "";
          if (tool) ciTools.add(tool);
        }

        const missingTools: string[] = [];
        for (const tool of ciTools) {
          // Skip tools that are always available (tsc, vitest when in devDeps)
          const pkgName = tool.startsWith("@") ? tool.split("/").slice(0, 2).join("/") : tool;
          if (!devDeps.includes(pkgName) && !deps.includes(pkgName) && tool !== "echo" && tool !== "node") {
            missingTools.push(tool);
          }
        }

        if (missingTools.length > 0) {
          checks.push({
            id: 15, name: "CI tool availability", status: "FAIL",
            message: `CI uses tools not in devDependencies: ${missingTools.join(", ")}`,
            remediation: {
              title: "CI tools missing from package.json",
              whyMatters: "npm ci installs only what's in package.json. Missing tools cause CI failures.",
              impact: `CI steps using ${missingTools.join(", ")} will fail unless these tools are installed separately.`,
              suggestedFix: `Add missing tools to devDependencies: npm install --save-dev ${missingTools.join(" ")}`,
              minimalExample: `npm install --save-dev ${missingTools.join(" ")}`,
              severity: "blocking",
            },
          });
        } else {
          checks.push({ id: 15, name: "CI tool availability", status: "PASS", message: "All CI tools are in devDependencies" });
        }
      } catch {
        checks.push({ id: 15, name: "CI tool availability", status: "INFO", message: "Cannot parse CI config or package.json" });
      }
    } else {
      checks.push({ id: 15, name: "CI tool availability", status: "INFO", message: "No CI workflow or package.json to check" });
    }
  }

  // ── 16. .devflow gitignored but project uses Devflow (self-check) ──
  {
    const gitignorePath = path.join(rootPath, ".gitignore");
    let devflowIgnored = false;
    if (await fileExists(gitignorePath)) {
      try {
        const { readFile } = await import("node:fs/promises");
        const gitignoreContent = await readFile(gitignorePath, "utf-8");
        devflowIgnored = /^\.devflow\/?\s*$/m.test(gitignoreContent);
      } catch { /* ignore */ }
    }

    const isDevflowProject = await fileExists(path.join(rootPath, ".devflow", "config.json"));

    if (devflowIgnored && isDevflowProject) {
      checks.push({
        id: 16, name: ".devflow/ gitignore awareness", status: "INFO",
        message: ".devflow/ is gitignored (expected) — local state, not versioned. CI must not depend on it.",
      });
    } else if (!devflowIgnored && isDevflowProject) {
      checks.push({
        id: 16, name: ".devflow/ gitignore awareness", status: "INFO",
        message: ".devflow/ is NOT gitignored — consider adding it to .gitignore (local state only)",
        remediation: {
          title: ".devflow/ should be gitignored",
          whyMatters: ".devflow/ contains local project state that varies per machine. Versioning it causes conflicts.",
          impact: "Different developers may have conflicting state.json, config.json, or audit files.",
          suggestedFix: "Add .devflow/ to .gitignore",
          minimalExample: "echo '.devflow/' >> .gitignore",
          severity: "advisory",
        },
      });
    } else {
      checks.push({ id: 16, name: ".devflow/ gitignore awareness", status: "INFO", message: "Devflow not initialized in this project" });
    }
  }

  // ── Print results ──
  console.log(pc.bold("Diagnostic Results:\n"));

  const copyableFixes: string[] = [];

  for (const check of checks) {
    const icon =
      check.status === "PASS" ? pc.green("✅")
      : check.status === "FIXED" ? pc.blue("🔧")
      : check.status === "FAIL" ? pc.red("❌")
      : check.status === "MANUAL" ? pc.yellow("⚠️ ")
      : pc.dim("ℹ️ ");

    console.log(` ${icon} ${String(check.id).padStart(2, " ")}. ${pc.bold(check.name)}`);
    console.log(`     ${pc.dim(check.message)}`);

    if (check.remediation) {
      console.log(renderRemediation(check.remediation));
      if (check.remediation.copyableCommand && check.status !== "PASS" && check.status !== "FIXED") {
        copyableFixes.push(check.remediation.copyableCommand);
      }
    }
  }

  // ── Summary ──
  const failed = checks.filter((c) => c.status === "FAIL").length;
  const manual = checks.filter((c) => c.status === "MANUAL").length;
  const fixed = checks.filter((c) => c.status === "FIXED").length;
  const info = checks.filter((c) => c.status === "INFO").length;
  const passed = checks.filter((c) => c.status === "PASS").length;

  console.log(pc.dim("═".repeat(55)));
  console.log(pc.bold("\nSummary:"));
  console.log(`  ${pc.green(`✅ ${passed} passed`)}, ${pc.blue(`🔧 ${fixed} fixed`)}, ${pc.red(`❌ ${failed} blocking`)}, ${pc.yellow(`⚠️ ${manual} manual`)}, ${pc.dim(`ℹ️ ${info} info`)}\n`);

  if (copyableFixes.length > 0) {
    console.log(pc.bold("Recommended fix sequence:"));
    copyableFixes.forEach((cmd, i) => {
      console.log(`  ${pc.cyan(`${i + 1}.`)} ${pc.bold(cmd)}`);
    });
    console.log();
  }

  if (!options.fix && (failed > 0 || manual > 0)) {
    console.log(pc.dim("Run with --fix to auto-correct safe failures.\n"));
  }

  if (failed === 0) {
    console.log(pc.bold("Next step:"));
    console.log(pc.dim("  Run `devflow next` to see the recommended action.\n"));
  }
}
