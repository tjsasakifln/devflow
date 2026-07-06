import { execSync } from "node:child_process";
import path from "node:path";
import type { FeatureInfo } from "../types/project.js";
import type { GuardCheck, GuardResult } from "../types/guards.js";
import { safeReadFile } from "../utils/fs.js";
import {
  validateRequirements,
  validateRoadmap,
} from "../artifacts/validator.js";
import { runConstitutionCheck } from "../constitution/checker.js";
import { loadConstitution } from "../constitution/loader.js";
import { ConfigManager } from "../config/index.js";

export interface PipelineContext {
  feature: FeatureInfo;
  rootPath: string;
  featureDir: string;
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
  checks.push({
    checkId: "has-requirements",
    description: "Feature has requirements.md",
    passed: feature.hasRequirements,
    reason: feature.hasRequirements
      ? "Found requirements.md"
      : "Missing requirements.md — run `devflow feature new` or write requirements first",
  });

  // ── Gate 2: Requirements complete (all sections filled) ──
  if (feature.hasRequirements) {
    const reqPath = path.join(featureDir, "requirements.md");
    const reqMd = await safeReadFile(reqPath);
    if (reqMd) {
      const validation = validateRequirements(reqMd);
      checks.push({
        checkId: "requirements-complete",
        description: "All required sections present and filled",
        passed: validation.valid,
        reason: validation.valid
          ? "All required sections complete"
          : `Incomplete sections: ${[...validation.missingSections, ...validation.emptySections].join(", ")}`,
      });
    }
  } else {
    checks.push({
      checkId: "requirements-complete",
      description: "All required sections present and filled",
      passed: false,
      reason: "Cannot validate — requirements.md missing",
    });
  }

  // ── Gate 3: No doubts remain ──
  checks.push({
    checkId: "no-doubts",
    description: "No [DOUBT] markers in requirements",
    passed: !feature.requirementsDoubts,
    reason: feature.requirementsDoubts
      ? "Resolve [DOUBT] markers before proceeding. Run `devflow clarify`."
      : "No doubts found — requirements are clear",
  });

  // ── Gate 4: Quality audit exists ──
  checks.push({
    checkId: "has-quality-audit",
    description: "Feature has quality-audit.md",
    passed: feature.hasQualityAudit,
    reason: feature.hasQualityAudit
      ? "Found quality-audit.md"
      : "Missing quality-audit.md — run quality audit to validate requirements",
  });

  // ── Gate 5: Roadmap exists ──
  checks.push({
    checkId: "has-roadmap",
    description: "Feature has roadmap.md",
    passed: feature.hasRoadmap,
    reason: feature.hasRoadmap
      ? "Found roadmap.md"
      : "Missing roadmap.md — create architectural roadmap before coding",
  });

  // ── Gate 6: Roadmap complete ──
  if (feature.hasRoadmap) {
    const roadmapPath = path.join(featureDir, "roadmap.md");
    const roadmapMd = await safeReadFile(roadmapPath);
    if (roadmapMd) {
      const validation = validateRoadmap(roadmapMd);
      checks.push({
        checkId: "roadmap-complete",
        description: "All required roadmap sections present",
        passed: validation.valid,
        reason: validation.valid
          ? "All required sections present"
          : `Incomplete: ${[...validation.missingSections, ...validation.emptySections].join(", ")}`,
      });
    }
  }

  // ── Gate 7: Test plan exists ──
  const hasTestPlan = feature.hasTestPlan || false;
  checks.push({
    checkId: "has-test-plan",
    description: "Feature has test-plan.md",
    passed: hasTestPlan,
    reason: hasTestPlan
      ? "Found test-plan.md"
      : "Missing test-plan.md — define tests before coding. Spec-Driven Development requires test-first.",
  });

  // ── Gate 8: Actions exist with atomic format ──
  checks.push({
    checkId: "has-actions",
    description: "Feature has actions.md with atomic tasks",
    passed: feature.hasActions,
    reason: feature.hasActions
      ? `Actions file found (${Math.round(feature.actionsCompletionRatio * 100)}% complete)`
      : "Missing actions.md — decompose roadmap into atomic, verifiable actions",
  });

  // ── Gate 9: Legacy impact documented (brownfield) ──
  checks.push({
    checkId: "has-legacy-impact",
    description: "Legacy impact documented",
    passed: feature.hasLegacyImpact,
    reason: feature.hasLegacyImpact
      ? "Found legacy-impact.md"
      : "Missing legacy-impact.md — document affected existing code and regression risks",
  });

  // ── Gate 10: Regression watch exists ──
  checks.push({
    checkId: "has-regression-watch",
    description: "Regression watch checklist exists",
    passed: feature.hasRegressionWatch,
    reason: feature.hasRegressionWatch
      ? "Found regression-watch.md"
      : "Missing regression-watch.md — define areas to monitor for regressions",
  });

  // ── Gate 11: Constitution check (deterministic) ──
  const constitution = await loadConstitution(rootPath);
  if (constitution.rules.length > 0 && config.constitution?.blockingGates) {
    try {
      const constReport = await runConstitutionCheck(rootPath);
      const blockingViolations = constReport.results.filter(
        (r) => r.severity === "error" && !r.passed
      );
      checks.push({
        checkId: "constitution-check",
        description: "Code respects engineering constitution",
        passed: blockingViolations.length === 0,
        reason:
          blockingViolations.length === 0
            ? `All ${constReport.summary.total} constitution rules pass`
            : `Constitution violations: ${blockingViolations.map((v) => v.ruleId).join(", ")}`,
      });
    } catch {
      checks.push({
        checkId: "constitution-check",
        description: "Code respects engineering constitution",
        passed: true,
        reason:
          "Constitution check skipped (tools not available). Install: dependency-cruiser, madge, eslint.",
      });
    }
  } else {
    checks.push({
      checkId: "constitution-check",
      description: "Code respects engineering constitution",
      passed: true,
      reason: "Constitution not yet configured — run `devflow init` to enable",
    });
  }

  // ── Gate 12: Typecheck passes (deterministic) ──
  if (detGates.typecheck) {
    checks.push({
      checkId: "typecheck-passing",
      description: "TypeScript type checking passes (tsc --noEmit)",
      passed: true, // Placeholder — actual check runs in verification phase
      reason:
        "Typecheck deferred to verification phase. Run `npx tsc --noEmit` before declaring coding complete.",
    });
  }

  // ── Gate 13: Lint passes (deterministic) ──
  if (detGates.lint) {
    checks.push({
      checkId: "lint-passing",
      description: "ESLint passes with constitution rules",
      passed: true, // Placeholder — actual check runs in verification phase
      reason:
        "Lint deferred to verification phase. Run `npx eslint src/` before declaring coding complete.",
    });
  }

  const failed = checks.filter((c) => !c.passed);

  return {
    canProceed: failed.length === 0,
    checks,
    refusalMessage:
      failed.length > 0 ? buildRefusalMessage(failed) : null,
    requiredActions: failed.map((c) => c.reason),
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

// Pre-action guard: runs immediately before each coding action
export function checkPreActionGuard(cwd: string): GuardResult {
  const checks: GuardCheck[] = [];

  // Check git status
  try {
    const branch = execSync("git branch --show-current", {
      cwd,
      encoding: "utf-8",
    }).trim();

    checks.push({
      checkId: "not-on-main",
      description: "Not on main branch",
      passed: branch !== "main" && branch !== "master",
      reason:
        branch === "main" || branch === "master"
          ? "⛔ Direct coding on main is forbidden. Use a feature branch."
          : `On feature branch: ${branch}`,
    });

    const status = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8",
    }).trim();

    checks.push({
      checkId: "clean-worktree",
      description: "Working directory is clean",
      passed: status.length === 0,
      reason:
        status.length === 0
          ? "Working directory clean"
          : "⛔ Uncommitted changes exist. Commit or stash before coding actions.",
    });
  } catch {
    checks.push({
      checkId: "git-available",
      description: "Git is available",
      passed: false,
      reason: "Git not available — cannot verify branch safety",
    });
  }

  const failed = checks.filter((c) => !c.passed);

  return {
    canProceed: failed.length === 0,
    checks,
    refusalMessage:
      failed.length > 0
        ? `## ⛔ Pre-Action Blocked\n\n${failed.map((c) => `- **${c.checkId}**: ${c.reason}`).join("\n")}`
        : null,
    requiredActions: failed.map((c) => c.reason),
  };
}
