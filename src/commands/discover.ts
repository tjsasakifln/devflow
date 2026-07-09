/**
 * Brownfield Discovery Command
 *
 * Two modes:
 *   1. Classic mode (default) — generates 4 reports: system-map.md, risk-map.md,
 *      testing-baseline.md, change-zones.md
 *   2. Deep mode — 5-phase orchestrated workflow: scout → archaeologist →
 *      detective → architect → writer. Output in _devflow/discovery/.
 *
 * Use --phase=<name> to run a single phase from the deep workflow.
 * Use default mode (no flags) for the classic 4-report output.
 */

import path from "node:path";
import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import pc from "picocolors";
import { detectStackProfile } from "../kernel/detection/stack.js";
import type { StackProfile } from "../kernel/detection/stack.js";
import { scanFiles } from "../adapters/project/file-scanner.js";
import { fileExists, safeReadFile } from "../kernel/utils/fs.js";
import { runDiscovery, resolvePhaseName } from "../kernel/discovery/orchestrator.js";
import { CompletenessCritic } from "../kernel/orchestration/completeness-critic.js";
import type { AnalysisContext } from "../kernel/orchestration/completeness-critic.js";

export interface DiscoverOptions {
  phase?: string;
  quick?: boolean;
  full?: boolean;
}

export async function discoverCommand(rootPath: string, options?: DiscoverOptions): Promise<void> {
  const phase = options?.phase ? resolvePhaseName(options.phase) : undefined;
  const quickMode = options?.quick ?? false;

  // Handle --phase (single phase, backward-compatible with both old and new names)
  if (options?.phase && !phase) {
    console.log(pc.red(`Invalid phase: "${options.phase}"`));
    console.log(pc.dim(`Valid phase names (old / new):`));
    console.log(pc.dim(`  scout / scan        — Project Structure`));
    console.log(pc.dim(`  archaeologist / analyze — Code Analysis`));
    console.log(pc.dim(`  detective / deduce  — Business Logic`));
    console.log(pc.dim(`  architect / design  — Architecture Reconstruction`));
    console.log(pc.dim(`  writer / document   — Specification Generation`));
    console.log(pc.dim("Usage: devflow discover --phase=<name>"));
    return;
  }

  if (phase) {
    // Deep discovery with single phase (accepts both old and new names)
    console.log(pc.bold(`\nDevflow Discover — Phase: ${phase}\n`));
    await runDiscovery({ phase, rootPath });
    return;
  }

  // ── QUICK MODE ──
  if (quickMode) {
    await discoverQuick(rootPath);
    return;
  }

  // ── FULL MODE (default) ──
  await discoverFull(rootPath);
}

/**
 * Quick discovery — generates exactly 3 essential reports.
 */
async function discoverQuick(rootPath: string): Promise<void> {
  const discoveryDir = path.join(rootPath, "_devflow", "discovery");
  await mkdir(discoveryDir, { recursive: true });

  console.log(pc.bold("\nDevflow Discover — Quick Mode\n"));
  console.log(pc.dim("Generating 3 essential reports for a 10-minute codebase overview...\n"));

  const stack = await detectStackProfile(rootPath);
  const scanner = await scanFiles(rootPath);

  // ── 1. system-map.md ──
  console.log(pc.blue("→") + " Generating system-map.md...");
  const systemMap = await buildSystemMap(rootPath, stack, scanner);
  await writeFile(path.join(discoveryDir, "system-map.md"), systemMap, "utf-8");

  // ── 2. risk-map.md ──
  console.log(pc.blue("→") + " Generating risk-map.md...");
  const riskMap = await buildRiskMap(rootPath, stack, scanner);
  await writeFile(path.join(discoveryDir, "risk-map.md"), riskMap, "utf-8");

  // ── 3. change-zones.md ──
  console.log(pc.blue("→") + " Generating change-zones.md...");
  const changeZones = await buildChangeZones(rootPath, stack, scanner);
  await writeFile(path.join(discoveryDir, "change-zones.md"), changeZones, "utf-8");

  // ── Executive Summary ──
  const summary = await buildExecutiveSummary(rootPath, stack);
  await writeFile(path.join(discoveryDir, "executive-summary.md"), summary, "utf-8");

  console.log(pc.green("\n✅ Quick discovery complete!\n"));
  console.log(pc.bold("Reports generated in:"), discoveryDir);
  console.log(`  ${pc.dim("→")} system-map.md         — System structure & dependencies`);
  console.log(`  ${pc.dim("→")} risk-map.md           — Top technical risks`);
  console.log(`  ${pc.dim("→")} change-zones.md       — Change safety zones`);
  console.log(`  ${pc.dim("→")} executive-summary.md   — 1-page executive overview`);
  console.log();
  console.log(pc.dim("Next: devflow feature new <name> to start a brownfield feature."));
  console.log(pc.dim("      Use devflow discover --full for the complete 13-report pipeline.\n"));
}

/**
 * Full discovery — the complete 13-report pipeline.
 */
async function discoverFull(rootPath: string): Promise<void> {
  const discoveryDir = path.join(rootPath, "_devflow", "discovery");
  await mkdir(discoveryDir, { recursive: true });

  console.log(pc.bold("\nDevflow Discover — Brownfield Analysis\n"));
  console.log(pc.dim("Running 5-phase deep discovery workflow...\n"));

  // Run the full 5-phase orchestrated workflow
  await runDiscovery({ rootPath });

  // Also generate classic 4 reports for backward compatibility
  console.log(pc.dim("\nGenerating classic reports...\n"));

  const stack = await detectStackProfile(rootPath);
  const scanner = await scanFiles(rootPath);

  // ── 1. system-map.md ──
  console.log(pc.blue("→") + " Generating system-map.md...");
  const systemMap = await buildSystemMap(rootPath, stack, scanner);
  await writeFile(path.join(discoveryDir, "system-map.md"), systemMap, "utf-8");

  // ── 2. risk-map.md ──
  console.log(pc.blue("→") + " Generating risk-map.md...");
  const riskMap = await buildRiskMap(rootPath, stack, scanner);
  await writeFile(path.join(discoveryDir, "risk-map.md"), riskMap, "utf-8");

  // ── 3. testing-baseline.md ──
  console.log(pc.blue("→") + " Generating testing-baseline.md...");
  const testingBaseline = await buildTestingBaseline(rootPath, stack);
  await writeFile(path.join(discoveryDir, "testing-baseline.md"), testingBaseline, "utf-8");

  // ── 4. change-zones.md ──
  console.log(pc.blue("→") + " Generating change-zones.md...");
  const changeZones = await buildChangeZones(rootPath, stack, scanner);
  await writeFile(path.join(discoveryDir, "change-zones.md"), changeZones, "utf-8");

  console.log(pc.green("\n✅ Discovery complete!\n"));
  console.log(pc.bold("Reports generated in:"), discoveryDir);
  console.log(`  ${pc.dim("→")} scout-report.md           — project structure scan`);
  console.log(`  ${pc.dim("→")} archaeology-report.md     — code complexity analysis`);
  console.log(`  ${pc.dim("→")} detective-report.md       — business logic analysis`);
  console.log(`  ${pc.dim("→")} architecture-reconstruction.md — C4 diagrams, integrations`);
  console.log(`  ${pc.dim("→")} SCHEMA.md                 — database schema (if detected)`);
  console.log(`  ${pc.dim("→")} system-architecture.md    — consolidated system map`);
  console.log(`  ${pc.dim("→")} technical-debt.md         — tech debt assessment`);
  console.log(`  ${pc.dim("→")} TECHNICAL-DEBT-REPORT.md  — executive tech debt report`);
  console.log(`  ${pc.dim("→")} consolidated-spec.md      — executable specifications`);
  console.log(`  ${pc.dim("→")} system-map.md             — classic structure report`);
  console.log(`  ${pc.dim("→")} risk-map.md               — classic risk assessment`);
  console.log(`  ${pc.dim("→")} testing-baseline.md        — classic testing report`);
  console.log(`  ${pc.dim("→")} change-zones.md           — classic change safety zones`);
  console.log();

  // ── Run Completeness Critic after discovery ──
  try {
    const critic = new CompletenessCritic(rootPath, {
      maxIterations: 3,
      dryThreshold: 2,
      useSpawner: false,
    });

    const criticContext: AnalysisContext = {
      rootPath,
      analyzedDimensions: [],
      inspectedFiles: [],
    };

    const criticReport = await critic.fullCritique(criticContext);

    if (criticReport.hasGaps) {
      console.log(pc.bold("\nCOMPLETENESS CRITIC"));
      console.log(pc.dim("  Post-discovery gap analysis:\n"));

      const dimGaps = criticReport.byType["dimension_not_covered"];
      if (dimGaps.length > 0) {
        console.log(pc.yellow(`  ${dimGaps.length} dimension(s) not covered:`));
        for (const g of dimGaps.slice(0, 5)) {
          console.log(`    ${pc.dim("⚠")} ${g.description}`);
        }
        console.log();
      }

      const srcGaps = criticReport.byType["source_not_read"];
      if (srcGaps.length > 0) {
        console.log(pc.cyan(`  ${srcGaps.length} source gap(s):`));
        for (const g of srcGaps.slice(0, 5)) {
          console.log(`    ${pc.dim("→")} ${g.description}`);
        }
        if (srcGaps.length > 5) {
          console.log(`    ${pc.dim("→ ... and " + (srcGaps.length - 5) + " more")}`);
        }
        console.log();
      }

      console.log(pc.dim(`  (${criticReport.totalIterations} iteration(s), ${Math.round(criticReport.durationMs / 1000)}s)\n`));
    } else {
      console.log(pc.green("\nCOMPLETENESS CRITIC: No gaps found\n"));
    }
  } catch (err) {
    // Critic is best-effort after discovery
    const msg = err instanceof Error ? err.message : String(err);
    console.log(pc.dim(`\nCompleteness critic skipped: ${msg}\n`));
  }

  console.log(pc.dim("Next: devflow feature new <name> to start a brownfield feature."));
  console.log(pc.dim("      Use --phase=<name> to re-run individual phases.\n"));
}

// =============================================================================
// Classic Report Builders (kept for backward compatibility)
// =============================================================================

export { buildSystemMap, buildRiskMap, buildTestingBaseline, buildChangeZones };

async function buildSystemMap(
  rootPath: string,
  stack: StackProfile,
  _scanner: Awaited<ReturnType<typeof scanFiles>>,
): Promise<string> {
  const lines: string[] = [];

  lines.push("# System Map");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Stack: ${stack.language}${stack.packageManager ? ` (${stack.packageManager})` : ""}`);
  lines.push("");

  // Language & framework
  lines.push("## Stack Overview");
  lines.push("");
  lines.push(`- **Language:** ${stack.language}`);
  lines.push(`- **Package Manager:** ${stack.packageManager ?? "none detected"}`);
  lines.push(`- **Source Directory:** \`${stack.sourceDir}/\``);
  lines.push(`- **Test Directory:** \`${stack.testDir}/\``);
  if (stack.hasDocker) lines.push("- **Docker:** Dockerfile detected");
  if (stack.hasCI) lines.push(`- **CI:** ${stack.ciProvider ?? "detected"}`);
  lines.push("");

  // Entrypoints
  lines.push("## Entrypoints");
  lines.push("");

  const entrypoints = await detectEntrypoints(rootPath, stack);
  if (entrypoints.length > 0) {
    for (const ep of entrypoints) {
      lines.push(`- \`${ep}\``);
    }
  } else {
    lines.push("_No clear entrypoints detected._");
  }
  lines.push("");

  // Package scripts (if applicable)
  if (stack.language === "typescript" || stack.language === "javascript") {
    const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
    if (pkgRaw) {
      try {
        const pkg = JSON.parse(pkgRaw);
        if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
          lines.push("## Scripts (package.json)");
          lines.push("");
          for (const [name, script] of Object.entries(pkg.scripts)) {
            lines.push(`- **\`${name}\`:** \`${script}\``);
          }
          lines.push("");
        }
      } catch { /* invalid JSON */ }
    }
  }

  // Module structure
  lines.push("## Module Structure");
  lines.push("");

  const dirTree = await getDirectoryTree(rootPath, 3);
  lines.push("```");
  lines.push(dirTree);
  lines.push("```");
  lines.push("");

  // Dependencies (if package.json)
  if (stack.language === "typescript" || stack.language === "javascript") {
    const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
    if (pkgRaw) {
      try {
        const pkg = JSON.parse(pkgRaw);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (Object.keys(deps).length > 0) {
          lines.push("## External Dependencies");
          lines.push("");
          const depEntries = Object.entries(deps) as Array<[string, string]>;
          const critical = ["express", "react", "next", "vue", "angular", "django", "flask", "fastapi"];
          for (const [name, version] of depEntries.slice(0, 30)) {
            const marker = critical.some((c) => name.toLowerCase().includes(c)) ? " ⚠️" : "";
            lines.push(`- **${name}:** ${version}${marker}`);
          }
          if (depEntries.length > 30) {
            lines.push(`- _... and ${depEntries.length - 30} more_`);
          }
          lines.push("");
        }
      } catch { /* invalid JSON */ }
    }
  }

  // File count per language
  lines.push("## File Count by Extension");
  lines.push("");
  try {
    const extOutput = execSync(
      `find . -type f -not -path './node_modules/*' -not -path './.git/*' -not -path './dist/*' -not -path './_devflow/*' -not -path './.devflow/*' | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -15`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    lines.push("```");
    lines.push(extOutput.trim());
    lines.push("```");
  } catch {
    lines.push("_Could not compute file counts._");
  }
  lines.push("");

  // Conventions
  lines.push("## Conventions Observed");
  lines.push("");
  if (stack.language === "typescript") {
    lines.push("- TypeScript with strict mode (tsconfig.json detected)");
  }
  if (stack.formatter) {
    lines.push(`- Code formatting: ${stack.formatter}`);
  }
  if (stack.linter) {
    lines.push(`- Linting: ${stack.linter}`);
  }
  lines.push(`- Source in \`${stack.sourceDir}/\`, tests in \`${stack.testDir}/\``);
  if (stack.hasDocker) {
    lines.push("- Docker containerization");
  }
  if (stack.hasCI) {
    lines.push("- CI/CD pipeline configured");
  }
  lines.push("");

  return lines.join("\n");
}

async function buildRiskMap(
  rootPath: string,
  stack: StackProfile,
  _scanner: Awaited<ReturnType<typeof scanFiles>>,
): Promise<string> {
  const lines: string[] = [];

  lines.push("# Risk Map");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Large files
  lines.push("## Large Files (> 400 lines)");
  lines.push("");
  lines.push("Files exceeding 400 lines are harder to understand, test, and maintain.");
  lines.push("");
  const largeFiles = await findLargeFiles(rootPath);
  if (largeFiles.length > 0) {
    for (const f of largeFiles) {
      lines.push(`- \`${f.path}\` — ${f.lines} lines`);
    }
  } else {
    lines.push("_No files exceeding 400 lines detected._");
  }
  lines.push("");

  // TODO/FIXME audit
  lines.push("## TODO / FIXME Count");
  lines.push("");
  try {
    const sourceDir = stack.sourceDir || "src";
    const todoOutput = execSync(
      `grep -rn "TODO\\|FIXME" ${sourceDir}/ 2>/dev/null | grep -v "TODO(" | grep -v "FIXME(" | wc -l || echo 0`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    const count = parseInt(todoOutput.trim(), 10) || 0;
    if (count > 0) {
      lines.push(`⚠️ **${count}** unlinked TODO/FIXME markers found in \`${sourceDir}/\`.`);
      lines.push("");
      lines.push("These indicate incomplete work. Each should be linked to a ticket.");
      lines.push("");
      try {
        const samples = execSync(
          `grep -rn "TODO\\|FIXME" ${sourceDir}/ 2>/dev/null | grep -v "TODO(" | grep -v "FIXME(" | head -10`,
          { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
        );
        if (samples.trim()) {
          lines.push("```");
          lines.push(samples.trim());
          lines.push("```");
        }
      } catch { /* no samples */ }
    } else {
      lines.push("✅ No unlinked TODO/FIXME markers.");
    }
  } catch {
    lines.push("_Could not scan for TODO/FIXME._");
  }
  lines.push("");

  // Modules without tests
  lines.push("## Potentially Untested Modules");
  lines.push("");
  try {
    const sourceDir = stack.sourceDir || "src";
    const testDir = stack.testDir || "test";
    const sourceExt = stack.language === "typescript" ? "ts" :
      stack.language === "python" ? "py" :
      stack.language === "go" ? "go" :
      stack.language === "rust" ? "rs" : "ts";
    const testPattern = stack.language === "go" ? "_test.go" :
      stack.language === "rust" ? "_test.rs" :
      ".test.";

    const findOutput = execSync(
      `find ${sourceDir}/ -name "*.${sourceExt}" -type f 2>/dev/null | head -50`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    const sourceFiles = findOutput.trim().split("\n").filter(Boolean);

    const untested: string[] = [];
    for (const sf of sourceFiles.slice(0, 30)) {
      const basename = path.basename(sf, `.${sourceExt}`);
      const searchDir = path.dirname(sf).replace(sourceDir, testDir);
      try {
        const result = execSync(
          `find ${searchDir}/ -name "${basename}${testPattern}*" 2>/dev/null | head -1`,
          { cwd: rootPath, encoding: "utf-8", timeout: 5000 },
        );
        if (!result.trim()) {
          untested.push(sf);
        }
      } catch {
        untested.push(sf);
      }
    }

    if (untested.length > 0) {
      lines.push(`⚠️ ${untested.length} source files without a corresponding test file:`);
      lines.push("");
      for (const f of untested.slice(0, 15)) {
        lines.push(`- \`${f}\``);
      }
      if (untested.length > 15) {
        lines.push(`- _... and ${untested.length - 15} more_`);
      }
    } else {
      lines.push("✅ All scanned source files have corresponding test files.");
    }
  } catch {
    lines.push("_Could not analyze test coverage._");
  }
  lines.push("");

  // Critical dependencies
  lines.push("## Critical Dependencies");
  lines.push("");
  const criticalPatterns = [
    { name: "Database", patterns: ["pg", "mysql", "mongodb", "sqlite", "prisma", "typeorm", "sequelize", "knex"] },
    { name: "Authentication", patterns: ["auth", "jwt", "oauth", "passport", "bcrypt", "next-auth"] },
    { name: "Payment", patterns: ["stripe", "paypal", "payment", "billing", "checkout"] },
    { name: "File Storage", patterns: ["s3", "aws-sdk", "cloudinary", "multer", "upload"] },
    { name: "Email", patterns: ["nodemailer", "sendgrid", "mailgun", "smtp", "email"] },
  ];

  if (stack.language === "typescript" || stack.language === "javascript") {
    const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
    if (pkgRaw) {
      try {
        const pkg = JSON.parse(pkgRaw);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const depNames = Object.keys(allDeps);
        for (const critical of criticalPatterns) {
          const matches = depNames.filter((d) =>
            critical.patterns.some((p) => d.toLowerCase().includes(p)),
          );
          if (matches.length > 0) {
            lines.push(`### ${critical.name}`);
            for (const m of matches) {
              lines.push(`- \`${m}\` → version ${allDeps[m]}`);
            }
            lines.push("");
          }
        }
      } catch { /* invalid JSON */ }
    }
  }

  // Secrets / security scan
  lines.push("## Security Scan (Basic)");
  lines.push("");
  try {
    const sourceDir = stack.sourceDir || "src";
    const secretPatterns = "process\\.env\\.|API_KEY|SECRET|PASSWORD|TOKEN|eval\\(";
    const secretOutput = execSync(
      `grep -rn "${secretPatterns}" ${sourceDir}/ 2>/dev/null | grep -v "node_modules" | grep -v ".test." | head -15 || true`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    if (secretOutput.trim()) {
      const count = secretOutput.trim().split("\n").length;
      lines.push(`⚠️ **${count}** potential security-sensitive patterns found (env vars, secrets, eval):`);
      lines.push("");
      lines.push("```");
      lines.push(secretOutput.trim());
      lines.push("```");
      lines.push("");
      lines.push("Review these for hardcoded secrets or unsafe patterns.");
    } else {
      lines.push("✅ No obvious security-sensitive patterns detected.");
    }
  } catch {
    lines.push("_Could not run security scan._");
  }
  lines.push("");

  return lines.join("\n");
}

async function buildTestingBaseline(
  rootPath: string,
  stack: StackProfile,
): Promise<string> {
  const lines: string[] = [];

  lines.push("# Testing Baseline");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Stack: ${stack.language}`);
  lines.push("");

  // Test framework
  lines.push("## Test Framework");
  lines.push("");
  if (stack.testFramework) {
    lines.push(`- **Framework:** ${stack.testFramework}`);
    lines.push(`- **Command:** \`${stack.testCommand}\``);
  } else {
    lines.push("⚠️ No test framework detected.");
  }
  lines.push("");

  // Current test state
  lines.push("## Current Test State");
  lines.push("");
  if (stack.testCommand) {
    try {
      execSync(stack.testCommand, {
        cwd: rootPath,
        encoding: "utf-8",
        timeout: 30000,
        env: { ...process.env, CI: "true" },
      });
      lines.push("✅ Tests pass.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lines.push("❌ Tests **fail** or are not configured.");
      lines.push("");
      lines.push("```");
      lines.push(msg.slice(0, 500));
      lines.push("```");
    }
  } else {
    lines.push("⚠️ Cannot determine — no test command configured.");
  }
  lines.push("");

  // Lint
  lines.push("## Lint");
  lines.push("");
  if (stack.linter) {
    lines.push(`- **Tool:** ${stack.linter}`);
    lines.push(`- **Command:** \`${stack.lintCommand}\``);
    lines.push("");
    if (stack.lintCommand) {
      try {
        execSync(stack.lintCommand, {
          cwd: rootPath,
          encoding: "utf-8",
          timeout: 30000,
        });
        lines.push("✅ Lint passes.");
      } catch {
        lines.push("❌ Lint **fails** or has violations.");
      }
    }
  } else {
    lines.push("⚠️ No linter detected.");
  }
  lines.push("");

  // TypeCheck
  lines.push("## Type Checking");
  lines.push("");
  if (stack.typeChecker) {
    lines.push(`- **Tool:** ${stack.typeChecker}`);
    lines.push(`- **Command:** \`${stack.typeCheckCommand}\``);
    lines.push("");
    if (stack.typeCheckCommand) {
      try {
        execSync(stack.typeCheckCommand, {
          cwd: rootPath,
          encoding: "utf-8",
          timeout: 60000,
        });
        lines.push("✅ TypeCheck passes.");
      } catch {
        lines.push("❌ TypeCheck **fails** or has errors.");
      }
    }
  } else if (stack.language === "go" || stack.language === "rust") {
    lines.push("Type checking is built into the compiler (no separate tool needed).");
  } else {
    lines.push("⚠️ No type checker configured.");
  }
  lines.push("");

  // Coverage
  lines.push("## Coverage");
  lines.push("");
  lines.push("Coverage measurement requires manual setup. Recommended targets:");
  lines.push("- Lines: ≥ 80%");
  lines.push("- Branches: ≥ 80%");
  lines.push("- Functions: ≥ 80%");
  lines.push("");

  if (stack.language === "typescript" || stack.language === "javascript") {
    lines.push("**Setup:**");
    lines.push("```bash");
    lines.push("npm install --save-dev @vitest/coverage-v8");
    lines.push("npx vitest run --coverage");
    lines.push("```");
  } else if (stack.language === "python") {
    lines.push("**Setup:**");
    lines.push("```bash");
    lines.push("pip install pytest-cov");
    lines.push("python -m pytest --cov=src/ --cov-report=term");
    lines.push("```");
  }
  lines.push("");

  // CI
  lines.push("## CI Status");
  lines.push("");
  if (stack.hasCI) {
    lines.push(`CI provider detected: **${stack.ciProvider}**`);
    lines.push("");
    lines.push("CI configuration found. Verify that the CI pipeline includes:");
    lines.push("- [ ] Test execution");
    lines.push("- [ ] Lint check");
    lines.push("- [ ] Type check (if applicable)");
    lines.push("- [ ] Build verification");
  } else {
    lines.push("⚠️ No CI configuration detected.");
    lines.push("");
    lines.push("Consider adding CI (GitHub Actions, GitLab CI, etc.) for automated verification.");
  }
  lines.push("");

  return lines.join("\n");
}

async function buildChangeZones(
  rootPath: string,
  stack: StackProfile,
  _scanner: Awaited<ReturnType<typeof scanFiles>>,
): Promise<string> {
  const lines: string[] = [];

  lines.push("# Change Zones");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Zones classify areas of the codebase by how safe they are to modify.");
  lines.push("Use this when planning brownfield features to avoid breaking critical paths.");
  lines.push("");

  // Gather data for classification
  const largeFiles = await findLargeFiles(rootPath);
  const largeFilePaths = new Set(largeFiles.map((f) => f.path));

  // Get TODO/FIXME files
  const todoFiles = new Set<string>();
  try {
    const sourceDir = stack.sourceDir || "src";
    const todoOutput = execSync(
      `grep -rl "TODO\\|FIXME" ${sourceDir}/ 2>/dev/null | grep -v "node_modules" | head -30 || true`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    todoOutput.trim().split("\n").filter(Boolean).forEach((f) => todoFiles.add(f));
  } catch { /* ignore */ }

  // ── Safe Zone ──
  lines.push("## 🟢 Safe to Change");
  lines.push("");
  lines.push("These areas have tests, clear structure, and low risk of cascading breakage.");
  lines.push("");

  let safeCount = 0;
  try {
    const sourceDir = stack.sourceDir || "src";
    const testDir = stack.testDir || "test";
    const sourceExt = stack.language === "typescript" ? "ts" :
      stack.language === "python" ? "py" :
      stack.language === "go" ? "go" :
      stack.language === "rust" ? "rs" : "ts";
    const testPattern = stack.language === "go" ? "_test.go" :
      stack.language === "rust" ? "_test.rs" : ".test.";

    const findOutput = execSync(
      `find ${sourceDir}/ -name "*.${sourceExt}" -type f 2>/dev/null | head -60`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    const sourceFiles = findOutput.trim().split("\n").filter(Boolean);

    for (const sf of sourceFiles) {
      const basename = path.basename(sf, `.${sourceExt}`);
      const searchDir = path.dirname(sf).replace(sourceDir, testDir);
      try {
        const result = execSync(
          `find ${searchDir}/ -name "${basename}${testPattern}*" 2>/dev/null | head -1`,
          { cwd: rootPath, encoding: "utf-8", timeout: 5000 },
        );
        const hasTest = !!result.trim();
        const isLarge = largeFilePaths.has(sf);
        const hasTodo = todoFiles.has(sf);

        if (hasTest && !isLarge && !hasTodo) {
          lines.push(`- \`${sf}\` — tested, moderate size, no TODO markers`);
          safeCount++;
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  if (safeCount === 0) {
    lines.push("_No areas classified as safe. Increase test coverage to expand this zone._");
  }
  lines.push("");

  // ── Caution Zone ──
  lines.push("## 🟡 Change with Caution");
  lines.push("");
  lines.push("These areas have partial tests, moderate complexity, or some TODO markers.");
  lines.push("Changes here need extra review and regression testing.");
  lines.push("");

  let cautionCount = 0;
  try {
    const sourceDir = stack.sourceDir || "src";
    const testDir = stack.testDir || "test";
    const sourceExt = stack.language === "typescript" ? "ts" :
      stack.language === "python" ? "py" :
      stack.language === "go" ? "go" :
      stack.language === "rust" ? "rs" : "ts";
    const testPattern = stack.language === "go" ? "_test.go" :
      stack.language === "rust" ? "_test.rs" : ".test.";

    const findOutput = execSync(
      `find ${sourceDir}/ -name "*.${sourceExt}" -type f 2>/dev/null | head -60`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    const sourceFiles = findOutput.trim().split("\n").filter(Boolean);

    for (const sf of sourceFiles) {
      const basename = path.basename(sf, `.${sourceExt}`);
      const searchDir = path.dirname(sf).replace(sourceDir, testDir);
      try {
        const result = execSync(
          `find ${searchDir}/ -name "${basename}${testPattern}*" 2>/dev/null | head -1`,
          { cwd: rootPath, encoding: "utf-8", timeout: 5000 },
        );
        const hasTest = !!result.trim();
        const isLarge = largeFilePaths.has(sf);
        const hasTodo = todoFiles.has(sf);
        const isModerate = (hasTest && (isLarge || hasTodo)) || (!hasTest && !isLarge);

        if (isModerate && cautionCount < 15) {
          const reasons: string[] = [];
          if (!hasTest) reasons.push("no tests");
          if (isLarge) reasons.push("large file");
          if (hasTodo) reasons.push("TODO markers");
          lines.push(`- \`${sf}\` — ${reasons.join(", ")}`);
          cautionCount++;
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  if (cautionCount === 0) {
    lines.push("_No areas classified as caution. All files are either safe or no-touch._");
  }
  lines.push("");

  // ── No-Touch Zone ──
  lines.push("## 🔴 Do Not Touch Without ADR");
  lines.push("");
  lines.push("These areas are critical, complex, untested, or poorly understood.");
  lines.push("**Do not modify these without writing an ADR in `.devflow/decisions/`.**");
  lines.push("");

  let noTouchCount = 0;

  // Files that are large AND have TODOs AND no tests → no-touch
  try {
    const sourceDir = stack.sourceDir || "src";
    const testDir = stack.testDir || "test";
    const sourceExt = stack.language === "typescript" ? "ts" :
      stack.language === "python" ? "py" : "ts";
    const testPattern = ".test.";

    const findOutput = execSync(
      `find ${sourceDir}/ -name "*.${sourceExt}" -type f 2>/dev/null | head -50`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    const sourceFiles = findOutput.trim().split("\n").filter(Boolean);

    for (const sf of sourceFiles) {
      const basename = path.basename(sf, `.${sourceExt}`);
      const searchDir = path.dirname(sf).replace(sourceDir, testDir);
      let hasTest = false;
      try {
        const result = execSync(
          `find ${searchDir}/ -name "${basename}${testPattern}*" 2>/dev/null | head -1`,
          { cwd: rootPath, encoding: "utf-8", timeout: 5000 },
        );
        hasTest = !!result.trim();
      } catch { /* no test */ }

      const isLarge = largeFilePaths.has(sf);
      const hasTodo = todoFiles.has(sf);

      if (!hasTest && (isLarge || hasTodo)) {
        const reasons: string[] = [];
        if (!hasTest) reasons.push("no tests");
        if (isLarge) reasons.push(`large (${largeFiles.find((f) => f.path === sf)?.lines ?? "?"} lines)`);
        if (hasTodo) reasons.push("unresolved TODOs");
        lines.push(`- \`${sf}\` — ${reasons.join(", ")}`);
        noTouchCount++;
      }
    }
  } catch { /* skip */ }

  // Add critical infrastructure paths
  const criticalPaths = [
    ".devflow/",
    "src/database/",
    "src/auth/",
    "src/payment/",
  ];
  for (const cp of criticalPaths) {
    if (await fileExists(path.join(rootPath, cp))) {
      lines.push(`- \`${cp}\` — critical infrastructure`);
      noTouchCount++;
    }
  }

  if (noTouchCount === 0) {
    lines.push("_No areas classified as no-touch. This is uncommon — verify classification._");
  }
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Zone | Count | Rule |`);
  lines.push(`|------|-------|------|`);
  lines.push(`| 🟢 Safe | ${safeCount} | Standard process — spec → implement → test → review |`);
  lines.push(`| 🟡 Caution | ${cautionCount} | Extra review + regression testing required |`);
  lines.push(`| 🔴 No-Touch | ${noTouchCount} | ADR required before any modification |`);
  lines.push("");

  return lines.join("\n");
}

// ── Utility Functions ──

/**
 * Build a 1-page executive summary of the codebase for quick mode.
 */
async function buildExecutiveSummary(
  _rootPath: string,
  stack: StackProfile,
): Promise<string> {
  const lines: string[] = [];

  lines.push("# Executive Summary");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Stack: ${stack.language}${stack.packageManager ? ` (${stack.packageManager})` : ""}`);
  lines.push("");

  lines.push("## Overview");
  lines.push("");
  lines.push("This executive summary consolidates findings from the 3 quick-discovery reports:");
  lines.push("- **system-map.md** — project structure, entry points, dependencies, stack");
  lines.push("- **risk-map.md** — top technical risks (large files, TODOs, untested modules, security)");
  lines.push("- **change-zones.md** — modification safety zones (safe, caution, no-touch)");
  lines.push("");

  // Quick stats
  lines.push("## Quick Stats");
  lines.push("");
  lines.push(`- **Language:** ${stack.language}`);
  lines.push(`- **Package Manager:** ${stack.packageManager ?? "none detected"}`);
  lines.push(`- **Source Dir:** \`${stack.sourceDir}/\``);
  lines.push(`- **Test Dir:** \`${stack.testDir}/\``);
  if (stack.typeChecker) lines.push(`- **Type Checker:** ${stack.typeChecker}`);
  if (stack.linter) lines.push(`- **Linter:** ${stack.linter}`);
  if (stack.testFramework) lines.push(`- **Test Framework:** ${stack.testFramework}`);
  if (stack.formatter) lines.push(`- **Formatter:** ${stack.formatter}`);
  if (stack.hasDocker) lines.push("- **Docker:** Detected");
  if (stack.hasCI) lines.push(`- **CI:** ${stack.ciProvider ?? "Detected"}`);
  lines.push("");

  // Risk summary
  lines.push("## Key Findings");
  lines.push("");
  lines.push("Review the following reports for detailed analysis:");
  lines.push("");
  lines.push("1. **System Structure** — Review entry points, module layout, and dependency graph in system-map.md.");
  lines.push("2. **Risk Areas** — Identify large files, TODO debt, untested modules, and security concerns in risk-map.md.");
  lines.push("3. **Change Safety** — Understand which areas are safe to modify and which require ADRs in change-zones.md.");
  lines.push("");

  // Recommendations
  lines.push("## Recommended Next Steps");
  lines.push("");
  lines.push("1. Run \`devflow discover --full\` for the complete 13-report deep-dive");
  lines.push("2. Start with safe zones when planning your first feature");
  lines.push("3. Address risk-map findings before introducing new complexity");
  lines.push("4. Use \`devflow feature new <name>\` to begin work");
  lines.push("");

  return lines.join("\n");
}

async function detectEntrypoints(
  rootPath: string,
  stack: StackProfile,
): Promise<string[]> {
  const entrypoints: string[] = [];

  // package.json main
  if (stack.language === "typescript" || stack.language === "javascript") {
    const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
    if (pkgRaw) {
      try {
        const pkg = JSON.parse(pkgRaw);
        if (pkg.main) entrypoints.push(`package.json → main: ${pkg.main}`);
        if (pkg.bin) {
          const bins = typeof pkg.bin === "string" ? { [pkg.name ?? "cli"]: pkg.bin } : pkg.bin;
          for (const [name, bin] of Object.entries(bins)) {
            entrypoints.push(`package.json → bin.${name}: ${bin}`);
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Common entrypoint files
  const commonEntries = [
    "src/main.ts", "src/main.js", "src/index.ts", "src/index.js",
    "src/cli.ts", "src/cli.js", "src/app.ts", "src/app.js",
    "src/server.ts", "src/server.js",
    "main.py", "app.py", "manage.py", "wsgi.py",
    "main.go", "cmd/main.go",
    "src/main.rs", "src/lib.rs",
    "public/index.php",
  ];

  for (const entry of commonEntries) {
    if (await fileExists(path.join(rootPath, entry))) {
      if (!entrypoints.includes(entry)) {
        entrypoints.push(entry);
      }
    }
  }

  // Dockerfile as entrypoint
  if (stack.hasDocker) {
    entrypoints.push("Dockerfile");
  }

  return entrypoints;
}

async function getDirectoryTree(rootPath: string, depth: number): Promise<string> {
  try {
    const output = execSync(
      `find . -maxdepth ${depth} -not -path './node_modules/*' -not -path './.git/*' -not -path './dist/*' -not -path './_devflow/*' -not -path './.devflow/*' -not -path './_reversa*' -not -path './.claude/*' -not -path './.agents/*' | sort | head -80`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    return output.trim();
  } catch {
    return "_Could not generate directory tree._";
  }
}

async function findLargeFiles(rootPath: string): Promise<Array<{ path: string; lines: number }>> {
  try {
    const output = execSync(
      `find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.php" -o -name "*.java" | grep -v node_modules | grep -v '.test.' | grep -v dist/ | xargs wc -l 2>/dev/null | sort -rn | awk '$1 > 400' | head -20`,
      { cwd: rootPath, encoding: "utf-8", timeout: 15000 },
    );
    const results: Array<{ path: string; lines: number }> = [];
    const lines = output.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        const lineCount = parseInt(parts[0], 10);
        if (!isNaN(lineCount) && lineCount > 400) {
          results.push({ path: parts[1], lines: lineCount });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}
