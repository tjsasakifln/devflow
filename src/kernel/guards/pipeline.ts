import { execSync } from "node:child_process";
import path from "node:path";
import type { FeatureInfo } from "../types/project.js";
import type { GuardCheck, GuardResult } from "../types/guards.js";
import { safeReadFile } from "../utils/fs.js";
import {
  validateRequirements,
  validateRoadmap,
} from "../validators/structural.js";
import { runConstitutionCheck } from "../constitution/checker.js";
import { loadConstitution } from "../constitution/loader.js";
import { ConfigManager } from "../config/index.js";
import { detectStackProfile, type StackProfile } from "../detection/stack.js";

export interface PipelineContext {
  feature: FeatureInfo;
  rootPath: string;
  featureDir: string;
}

function makeCheck(
  checkId: string,
  description: string,
  passed: boolean,
  reason: string,
  gateNumber: number,
  blocking: boolean,
  remediation: string,
): GuardCheck {
  return { checkId, description, passed, reason, blocking, gateNumber, remediation };
}

export async function checkPipelineReadiness(
  ctx: PipelineContext
): Promise<GuardResult> {
  const checks: GuardCheck[] = [];
  const { feature, rootPath, featureDir } = ctx;

  // Load config for deterministic gate settings
  const configMgr = new ConfigManager(rootPath);
  const config = await configMgr.load();
  const detGates = config.deterministicGates;

  // ── Gate 1: Requirements exist ──
  checks.push(makeCheck(
    "has-requirements",
    "Feature has requirements.md",
    feature.hasRequirements,
    feature.hasRequirements
      ? "Found requirements.md"
      : "Missing requirements.md — run `devflow feature new` or write requirements first",
    1,
    true,
    "Run `devflow feature new <name>` to create feature workspace, or create requirements.md manually",
  ));

  // ── Gate 2: Requirements complete (all sections filled) ──
  if (feature.hasRequirements) {
    const reqPath = path.join(featureDir, "requirements.md");
    const reqMd = await safeReadFile(reqPath);
    if (reqMd) {
      const validation = validateRequirements(reqMd);
      checks.push(makeCheck(
        "requirements-complete",
        "All required sections present and filled",
        validation.valid,
        validation.valid
          ? "All required sections complete"
          : `Incomplete sections: ${[...validation.missingSections, ...validation.emptySections].join(", ")}`,
        2,
        true,
        "Fill all missing sections in requirements.md. Run `devflow status` for details.",
      ));
    }
  } else {
    checks.push(makeCheck(
      "requirements-complete",
      "All required sections present and filled",
      false,
      "Cannot validate — requirements.md missing",
      2,
      true,
      "Create requirements.md first",
    ));
  }

  // ── Gate 3: No doubts remain ──
  checks.push(makeCheck(
    "no-doubts",
    "No [DOUBT] markers in requirements",
    !feature.requirementsDoubts,
    feature.requirementsDoubts
      ? "Resolve [DOUBT] markers before proceeding. Run `devflow clarify`."
      : "No doubts found — requirements are clear",
    3,
    true,
    "Run `devflow clarify` to resolve [DOUBT] markers interactively",
  ));

  // ── Gate 4: Quality audit exists ──
  checks.push(makeCheck(
    "has-quality-audit",
    "Feature has quality-audit.md",
    feature.hasQualityAudit,
    feature.hasQualityAudit
      ? "Found quality-audit.md"
      : "Missing quality-audit.md — run quality audit to validate requirements",
    4,
    true,
    "Run quality audit: generate quality-audit.md with requirements validation results",
  ));

  // ── Gate 5: Roadmap exists ──
  checks.push(makeCheck(
    "has-roadmap",
    "Feature has roadmap.md",
    feature.hasRoadmap,
    feature.hasRoadmap
      ? "Found roadmap.md"
      : "Missing roadmap.md — create architectural roadmap before coding",
    5,
    true,
    "Create roadmap.md with architecture decisions, layers, patterns, and interfaces",
  ));

  // ── Gate 6: Roadmap complete ──
  if (feature.hasRoadmap) {
    const roadmapPath = path.join(featureDir, "roadmap.md");
    const roadmapMd = await safeReadFile(roadmapPath);
    if (roadmapMd) {
      const validation = validateRoadmap(roadmapMd);
      checks.push(makeCheck(
        "roadmap-complete",
        "All required roadmap sections present",
        validation.valid,
        validation.valid
          ? "All required sections present"
          : `Incomplete: ${[...validation.missingSections, ...validation.emptySections].join(", ")}`,
        6,
        true,
        "Fill all missing sections in roadmap.md",
      ));
    }
  }

  // ── Gate 7: Test plan exists ──
  const hasTestPlan = feature.hasTestPlan || false;
  checks.push(makeCheck(
    "has-test-plan",
    "Feature has test-plan.md",
    hasTestPlan,
    hasTestPlan
      ? "Found test-plan.md"
      : "Missing test-plan.md — define tests before coding. Spec-Driven Development requires test-first.",
    7,
    true,
    "Create test-plan.md with test strategy, unit tests, integration tests, edge cases, and coverage targets",
  ));

  // ── Gate 8: Actions exist with atomic format ──
  checks.push(makeCheck(
    "has-actions",
    "Feature has actions.md with atomic tasks",
    feature.hasActions,
    feature.hasActions
      ? `Actions file found (${Math.round(feature.actionsCompletionRatio * 100)}% complete)`
      : "Missing actions.md — decompose roadmap into atomic, verifiable actions",
    8,
    true,
    "Create actions.md with T001-format atomic tasks, each with target, layer, contract, test, and evidence",
  ));

  // ── Gate 9: Legacy impact documented (brownfield) ──
  checks.push(makeCheck(
    "has-legacy-impact",
    "Legacy impact documented",
    feature.hasLegacyImpact,
    feature.hasLegacyImpact
      ? "Found legacy-impact.md"
      : "Missing legacy-impact.md — document affected existing code and regression risks",
    9,
    true,
    "Create legacy-impact.md with affected modules, impact types, and severity assessment",
  ));

  // ── Gate 10: Regression watch exists ──
  checks.push(makeCheck(
    "has-regression-watch",
    "Regression watch checklist exists",
    feature.hasRegressionWatch,
    feature.hasRegressionWatch
      ? "Found regression-watch.md"
      : "Missing regression-watch.md — define areas to monitor for regressions",
    10,
    true,
    "Create regression-watch.md with watch items, stable IDs, and check types",
  ));

  // ── Gate 11: Constitution check (deterministic) ──
  const constitution = await loadConstitution(rootPath);
  if (constitution.rules.length > 0 && config.constitution?.blockingGates) {
    try {
      const constReport = await runConstitutionCheck(rootPath);
      const blockingViolations = constReport.results.filter(
        (r) => r.severity === "error" && !r.passed
      );
      checks.push(makeCheck(
        "constitution-check",
        "Code respects engineering constitution",
        blockingViolations.length === 0,
        blockingViolations.length === 0
          ? `All ${constReport.summary.total} constitution rules pass`
          : `Constitution violations: ${blockingViolations.map((v) => v.ruleId).join(", ")}`,
        11,
        true,
        `Fix constitution violations: ${blockingViolations.map((v) => v.ruleId).join(", ")}. Check .devflow/constitution.md for rule details.`,
      ));
    } catch {
      checks.push(makeCheck(
        "constitution-check",
        "Code respects engineering constitution",
        false,
        "Constitution check failed — tools not available. Install: dependency-cruiser, madge, eslint.",
        11,
        true,
        "Install required tools: npm install --save-dev dependency-cruiser madge eslint",
      ));
    }
  } else {
    checks.push(makeCheck(
      "constitution-check",
      "Code respects engineering constitution",
      true,
      "Constitution not yet configured — run `devflow install` to enable",
      11,
      false,
      "Run `devflow install` to configure constitution checks",
    ));
  }

  // ── Stack-adaptive tool detection (shared by gates 12 & 13) ──
  const stack: StackProfile = await detectStackProfile(rootPath);

  // Read package.json scripts for overrides
  let pkgScripts: Record<string, string> = {};
  try {
    const pkgRaw = await safeReadFile(path.join(rootPath, "package.json"));
    if (pkgRaw) {
      const pkg = JSON.parse(pkgRaw);
      pkgScripts = pkg.scripts ?? {};
    }
  } catch {
    // No package.json or invalid JSON
  }

  const pm = stack.packageManager ?? "npm";
  const pmRun = pm === "yarn" ? "yarn" : pm === "pnpm" ? "pnpm" : "npm run";

  // ── Gate 12: Typecheck (stack-adaptive) ──
  if (detGates.typecheck) {
    const typeCheckCmd = pkgScripts.typecheck
      ? `${pmRun} typecheck`
      : stack.typeCheckCommand;

    if (typeCheckCmd) {
      try {
        execSync(typeCheckCmd, {
          cwd: rootPath,
          encoding: "utf-8",
          timeout: 60000,
          env: { ...process.env, CI: "true" },
        });
        checks.push(makeCheck(
          "typecheck-passing",
          `Type checking passes (${typeCheckCmd})`,
          true,
          `Type checking successful — no errors (${stack.language})`,
          12,
          stack.language !== "javascript",
          `Run \`${typeCheckCmd}\` to see detailed errors`,
        ));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message.slice(0, 300) : String(err);
        checks.push(makeCheck(
          "typecheck-passing",
          `Type checking passes (${typeCheckCmd})`,
          false,
          `Type errors found:\n${errMsg}`,
          12,
          stack.language !== "javascript",
          `Fix type errors: run \`${typeCheckCmd}\` and resolve all reported issues`,
        ));
      }
    } else if (stack.language === "javascript") {
      checks.push(makeCheck(
        "typecheck-passing",
        "Type checking (JavaScript project — optional)",
        true,
        "JavaScript project — type checking not required. Consider TypeScript or JSDoc.",
        12,
        false,
        "Add TypeScript to the project for type safety: npm install --save-dev typescript",
      ));
    } else if (stack.language === "go" || stack.language === "rust") {
      checks.push(makeCheck(
        "typecheck-passing",
        `Type checking (${stack.language} — built into compiler)`,
        true,
        `${stack.language} compiler handles type checking natively.`,
        12,
        false,
        `Run ${stack.testCommand ?? "build"} to verify compilation.`,
      ));
    } else {
      checks.push(makeCheck(
        "typecheck-passing",
        `Type checking (${stack.language} — not configured)`,
        true,
        `⚠️  No type checker configured for ${stack.language}. Add a "typecheck" script to package.json or configure deterministicGates.`,
        12,
        false,
        'Add "typecheck" script to package.json (e.g., "tsc --noEmit") or configure typeCheckCommand in .devflow/config.json',
      ));
    }
  } else {
    checks.push(makeCheck(
      "typecheck-passing",
      "Type checking (gate disabled in config)",
      true,
      "Typecheck gate disabled in config",
      12,
      false,
      "Enable typecheck gate: deterministicGates.typecheck = true in .devflow/config.json",
    ));
  }

  // ── Gate 13: Lint (stack-adaptive) ──
  if (detGates.lint) {
    const lintCmd = pkgScripts.lint
      ? `${pmRun} lint`
      : stack.lintCommand;

    if (lintCmd) {
      try {
        execSync(lintCmd, {
          cwd: rootPath,
          encoding: "utf-8",
          timeout: 60000,
          env: { ...process.env, CI: "true" },
        });
        checks.push(makeCheck(
          "lint-passing",
          `Lint passes (${lintCmd})`,
          true,
          `All lint rules pass — no violations (${stack.linter ?? stack.language})`,
          13,
          true,
          `Run \`${lintCmd}\` to see violations`,
        ));
      } catch (err) {
        const errMsg = err instanceof Error ? (err.message).slice(0, 300) : String(err);
        checks.push(makeCheck(
          "lint-passing",
          `Lint passes (${lintCmd})`,
          false,
          `Lint violations found:\n${errMsg}`,
          13,
          true,
          `Fix lint violations: run \`${lintCmd}\` and resolve remaining issues`,
        ));
      }
    } else {
      checks.push(makeCheck(
        "lint-passing",
        `Lint (${stack.language} — not configured)`,
        true,
        `⚠️  No linter configured for ${stack.language}. Add a "lint" script to package.json or configure deterministicGates.`,
        13,
        false,
        'Add "lint" script to package.json (e.g., "eslint src/") or configure lintCommand in .devflow/config.json',
      ));
    }
  } else {
    checks.push(makeCheck(
      "lint-passing",
      "Lint (gate disabled in config)",
      true,
      "Lint gate disabled in config",
      13,
      false,
      "Enable lint gate: deterministicGates.lint = true in .devflow/config.json",
    ));
  }

  // ── Gate 14: Loop validation ──
  {
    const actionsCheck = checks.find((c) => c.checkId === "has-actions");
    if (actionsCheck?.passed && feature.hasActions) {
      try {
        const actionsPath = path.join(featureDir, "actions.md");
        const actionsMd = await safeReadFile(actionsPath);
        if (actionsMd) {
          const { scanActionsForLoops, validateLoopsInFeature } = await import("../validators/loop.js");
          const loopsResult = validateLoopsInFeature(actionsMd);
          const loops = scanActionsForLoops(actionsMd);
          if (loops.length > 0) {
            checks.push(makeCheck(
              "loop-validation",
              `Agentic loops validated (${loops.length} found)`,
              loopsResult.valid,
              loopsResult.valid
                ? `All ${loops.length} loop(s) have explicit goal, stopCondition, maxIterations, and externalCheck`
                : loopsResult.errors.join("; "),
              14,
              true,
              "Fix loop specs in actions.md: each loop needs goal, stopCondition, maxIterations, externalCheck, and evidenceLog",
            ));
          } else {
            checks.push(makeCheck(
              "loop-validation",
              "Agentic loops validated (none found)",
              true,
              "No agentic loops detected in actions.md",
              14,
              true,
              "N/A — no loops to validate",
            ));
          }
        }
      } catch {
        checks.push(makeCheck(
          "loop-validation",
          "Agentic loops validated",
          true,
          "Loop validation skipped — could not read actions.md",
          14,
          false,
          "N/A",
        ));
      }
    }
  }

  // ── Gate 15: Heuristic semantic quality check ──
  if (feature.hasRequirements) {
    try {
      const reqPath = path.join(featureDir, "requirements.md");
      const reqMd = await safeReadFile(reqPath);
      if (reqMd) {
        const { validateRequirementsSemantic } = await import("../validators/semantic.js");
        const semanticResult = validateRequirementsSemantic(reqMd);
        checks.push(makeCheck(
          "semantic-quality",
          "Heuristic semantic quality check (artifacts have real content, not filler)",
          semanticResult.valid,
          semanticResult.valid
            ? `Requirements heuristic quality score: ${semanticResult.score}/100`
            : `Heuristic quality gaps: ${semanticResult.failures.map((f) => f.issue).join("; ")}`,
          15,
          true,
          `Replace generic placeholder content with specific details. Heuristic score: ${semanticResult.score}/100.`,
        ));
      }
    } catch {
      checks.push(makeCheck(
        "semantic-quality",
        "Heuristic semantic quality check (artifacts have real content, not filler)",
        true,
        "Heuristic semantic validation skipped — could not load validator",
        15,
        false,
        "N/A",
      ));
    }
  }

  // ── Gate 16: Acceptance criteria coverage ──
  if (hasTestPlan) {
    try {
      const tpPath = path.join(featureDir, "test-plan.md");
      const tpMd = await safeReadFile(tpPath);
      if (tpMd) {
        const { validateTestPlanSemantic } = await import("../validators/semantic.js");
        const acResult = validateTestPlanSemantic(tpMd);
        checks.push(makeCheck(
          "acceptance-criteria",
          "Test plan has concrete acceptance criteria (>=3 Gherkin, error cases)",
          acResult.valid,
          acResult.valid
            ? `Acceptance criteria coverage score: ${acResult.score}/100`
            : `Acceptance criteria gaps: ${acResult.failures.map((f) => f.issue).join("; ")}`,
          16,
          true,
          `Add concrete test cases with Given/When/Then. Minimum 3 Gherkin scenarios including error paths. Score: ${acResult.score}/100.`,
        ));
      }
    } catch {
      checks.push(makeCheck(
        "acceptance-criteria",
        "Test plan has concrete acceptance criteria",
        true,
        "Acceptance criteria check skipped — could not load validator",
        16,
        false,
        "N/A",
      ));
    }
  }

  // ── Gate 17: OO quality metrics (config-controlled) ──
  if (detGates.ooMetrics) {
    try {
      const { validateOOQuality } = await import("../validators/oo.js");
      const ooResult = validateOOQuality(rootPath);
      checks.push(makeCheck(
        "oo-quality",
        "OO design quality (coupling, cohesion, complexity)",
        ooResult.pass,
        ooResult.pass
          ? `OO quality OK: ${ooResult.summary}`
          : `OO violations: ${ooResult.violations.map((v) => v.description).join("; ")}`,
        17,
        true,
        `Refactor to improve OO design: ${ooResult.violations.map((v) => v.description).join(". ")}`,
      ));
    } catch {
      checks.push(makeCheck(
        "oo-quality",
        "OO design quality metrics",
        true,
        "OO quality gate skipped — tools unavailable",
        17,
        false,
        "Enable ooMetrics in config or install dependency-cruiser, madge, eslint",
      ));
    }
  }

  // ── Gate 18: Implementer-approver separation ──
  if (config.implementerApproverSeparation?.enabled) {
    try {
      const logPath = path.join(featureDir, "implementation-log.jsonl");
      const logRaw = await safeReadFile(logPath);
      if (logRaw) {
        const actors = new Set<string>();
        for (const line of logRaw.trim().split("\n")) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.actor) actors.add(entry.actor);
          } catch { /* skip malformed lines */ }
        }
        const hasMultipleActors = actors.size > 1;
        checks.push(makeCheck(
          "implementer-separation",
          "Implementer and approver are different actors",
          hasMultipleActors,
          hasMultipleActors
            ? `${actors.size} distinct actors in implementation log`
            : "One actor in implementation log — implementer and approver must differ",
          18,
          true,
          "Have a different actor run `devflow gatekeep` to approve. Implementers cannot approve their own code.",
        ));
      } else {
        checks.push(makeCheck(
          "implementer-separation",
          "Implementer and approver are different actors",
          true,
          "No implementation log yet — check deferred to feature-complete",
          18,
          true,
          "Ensure gatekeeper is different from implementer",
        ));
      }
    } catch {
      checks.push(makeCheck(
        "implementer-separation",
        "Implementer and approver are different actors",
        true,
        "Implementer separation check skipped",
        18,
        false,
        "Ensure different actors for implementation and approval",
      ));
    }
  }

  // ── Gate 19: CI status verification ──
  if (config.ciIntegration?.enabled) {
    try {
      const { verifyCIStatus } = await import("../ci/verifier.js");
      const ciStatus = await verifyCIStatus(rootPath, config);
      const ciPassed = ciStatus.conclusion === "success";
      checks.push(makeCheck(
        "ci-status",
        `Remote CI verification (${ciStatus.workflow})`,
        ciPassed,
        ciPassed
          ? `CI workflow ${ciStatus.workflow} passed on branch ${ciStatus.branch}`
          : ciStatus.conclusion
            ? `CI workflow ${ciStatus.workflow} status: ${ciStatus.conclusion}`
            : "CI verification unavailable — gh CLI not found or no runs",
        19,
        true,
        ciPassed
          ? "CI passed"
          : `Fix CI failures: check ${ciStatus.htmlUrl || "CI workflow"} for details`,
      ));
    } catch {
      checks.push(makeCheck(
        "ci-status",
        "Remote CI verification",
        true,
        "CI verification skipped — gh CLI not available or misconfigured",
        19,
        false,
        "Install GitHub CLI: https://cli.github.com/",
      ));
    }
  }

  const failed = checks.filter((c) => !c.passed);
  const blockingFailed = failed.filter((c) => c.blocking).length;
  const advisoryFailed = failed.filter((c) => !c.blocking).length;

  return {
    canProceed: blockingFailed === 0,
    checks,
    refusalMessage:
      failed.length > 0 ? buildRefusalMessage(failed) : null,
    requiredActions: failed.map((c) => c.remediation),
    blockingFailed,
    advisoryFailed,
  };
}

function buildRefusalMessage(failedChecks: GuardCheck[]): string {
  const lines = [
    "## ⛔ Coding Blocked — Pre-requisites Not Met",
    "",
    "Devflow requires the following before coding can begin:",
    "",
    ...failedChecks.map((c, i) => `${i + 1}. **${c.checkId}**: ${c.reason}`),
    "",
    "### Next Steps",
    "- Run `devflow next` to see the recommended next action",
    "- Run `devflow status` to see the full project state",
    "- Run `devflow doctor` if the state seems incorrect",
    "",
    "### Why This Matters",
    "IA sem processo gera velocidade frágil. Software de verdade exige:",
    "→ requisitos claros → arquitetura explícita → testes verificáveis",
    "→ versionamento seguro → manutenção planejada → critérios objetivos de avanço",
  ];

  return lines.join("\n");
}

// Pre-action git guard: verifies branch safety and worktree cleanliness before coding
export function checkPreActionGitGuard(cwd: string): GuardResult {
  const checks: GuardCheck[] = [];

  // Check git status
  try {
    const branch = execSync("git branch --show-current", {
      cwd,
      encoding: "utf-8",
    }).trim();

    const notMain = branch !== "main" && branch !== "master";
    checks.push({
      checkId: "not-on-main",
      description: "Not on main branch",
      passed: notMain,
      reason:
        branch === "main" || branch === "master"
          ? "⛔ Direct coding on main is forbidden. Use a feature branch."
          : `On feature branch: ${branch}`,
      blocking: true,
      gateNumber: 0,
      remediation: "Create a feature branch: `git checkout -b feature/<id>`",
    });

    const status = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8",
    }).trim();

    const clean = status.length === 0;
    checks.push({
      checkId: "clean-worktree",
      description: "Working directory is clean",
      passed: clean,
      reason:
        status.length === 0
          ? "Working directory clean"
          : "⛔ Uncommitted changes exist. Commit or stash before coding actions.",
      blocking: true,
      gateNumber: 0,
      remediation: "Commit or stash changes: `git stash` or `git commit -am '...'`",
    });
  } catch {
    checks.push({
      checkId: "git-available",
      description: "Git is available",
      passed: false,
      reason: "Git not available — cannot verify branch safety",
      blocking: true,
      gateNumber: 0,
      remediation: "Initialize git repository: `git init`",
    });
  }

  const failed = checks.filter((c) => !c.passed);
  const blockingFailed = failed.filter((c) => c.blocking).length;
  const advisoryFailed = failed.filter((c) => !c.blocking).length;

  return {
    canProceed: blockingFailed === 0,
    checks,
    refusalMessage:
      failed.length > 0
        ? `## ⛔ Pre-Action Blocked\n\n${failed.map((c) => `- **${c.checkId}**: ${c.reason}`).join("\n")}`
        : null,
    requiredActions: failed.map((c) => c.remediation || c.reason),
    blockingFailed,
    advisoryFailed,
  };
}
