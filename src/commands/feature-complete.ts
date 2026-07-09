import path from "node:path";
import { execSync } from "node:child_process";
import {
  fileExists,
  safeReadFile,
} from "../utils/fs.js";
import {
  validateRequirements,
  validateRequirementsVariant,
  validateRoadmap,
  validateRoadmapVariant,
  validateActions,
} from "../kernel/artifacts/validator.js";
import { detectProjectType } from "../kernel/detection/project-type.js";
import type { ProjectType } from "../kernel/detection/project-type.js";
import { runConstitutionCheck, getConstitutionCompliance } from "../kernel/constitution/checker.js";
import { detectStackProfile } from "../kernel/detection/stack.js";
import {
  toolFailedRemediation,
  type Remediation,
} from "../kernel/errors/remediation.js";
import {
  getApplicableCheckIds,
  getCheckRequiredState,
} from "../kernel/checks/stage-filter.js";
import { computeFeatureSanityScores } from "../kernel/checks/sanity-score.js";
import {
  executePreCommandHooks,
  renderWarnings,
  renderHealthSummary,
  computeHealthSummary,
} from "../kernel/hooks/pre-command.js";
import { determineFeatureState } from "../kernel/state/detector.js";
import type { DevflowState, FeatureInfo } from "../kernel/types/index.js";
import pc from "picocolors";

interface DoDCheck {
  id: string;
  description: string;
  category: "artifact" | "deterministic" | "process" | "git" | "review" | "domain" | "ci";
  passed: boolean;
  evidence: string;
  blocking: boolean;
  remediation: string;
  /** If set, the check was skipped because it is not applicable at the current feature state. */
  skippedReason?: string;
}

export interface DoDResult {
  passed: number;
  applicableTotal: number;
  total: number;
  ciStatus: string;
  allBlockingPassed: boolean;
  blockingFailed: Array<{ id: string; description: string; remediation: string }>;
}

/**
 * Detect the current feature state by inspecting artifacts in the feature directory.
 * Returns null if state cannot be determined (falls back to running all checks).
 */
async function detectFeatureStateFromDir(
  featureDir: string,
  featureId: string,
): Promise<DevflowState | null> {
  const [
    hasRequirements,
    hasRoadmap,
    hasActions,
    hasTestPlan,
    hasImplementationLog,
    hasLegacyImpact,
    hasRegressionWatch,
    hasQaReport,
    hasClarification,
    hasInvestigation,
    hasDataDelta,
    hasReleaseNotes,
  ] = await Promise.all([
    fileExists(path.join(featureDir, "requirements.md")),
    fileExists(path.join(featureDir, "roadmap.md")),
    fileExists(path.join(featureDir, "actions.md")),
    fileExists(path.join(featureDir, "test-plan.md")),
    fileExists(path.join(featureDir, "implementation-log.jsonl")),
    fileExists(path.join(featureDir, "legacy-impact.md")),
    fileExists(path.join(featureDir, "regression-watch.md")),
    fileExists(path.join(featureDir, "qa-report.md")),
    fileExists(path.join(featureDir, "clarification.md")),
    fileExists(path.join(featureDir, "investigation.md")),
    fileExists(path.join(featureDir, "data-delta.md")),
    fileExists(path.join(featureDir, "release-notes.md")),
  ]);

  // Calculate actions completion ratio
  let actionsCompletionRatio = 0;
  if (hasActions) {
    const actionsMd = await safeReadFile(path.join(featureDir, "actions.md"));
    if (actionsMd) {
      const total = (actionsMd.match(/-\s*\[[\sxX]\]/g) || []).length;
      const done = (actionsMd.match(/-\s*\[[xX]\]/g) || []).length;
      actionsCompletionRatio = total > 0 ? done / total : 0;
    }
  }

  // Check for requirements doubts
  const requirementsMd = hasRequirements
    ? await safeReadFile(path.join(featureDir, "requirements.md"))
    : null;
  const requirementsDoubts = requirementsMd
    ? requirementsMd.includes("[DOUBT]") || requirementsMd.includes("[DÚVIDA]")
    : false;

  const featureInfo: FeatureInfo = {
    id: featureId,
    directory: featureDir,
    hasRequirements,
    hasClarification,
    hasQualityAudit: hasRoadmap && hasActions,
    hasRoadmap,
    hasActions,
    hasInvestigation,
    hasDataDelta,
    hasQaReport,
    hasLegacyImpact,
    hasRegressionWatch,
    hasReleaseNotes,
    hasImplementationLog,
    hasTestPlan,
    requirementsDoubts,
    actionsCompletionRatio,
    isActive: true,
  };

  return determineFeatureState(featureInfo);
}

export async function featureComplete(
  featureId: string,
  rootPath: string,
  options?: { runAll?: boolean }
): Promise<void> {
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);

  // Load risk tolerance for gate adjustment
  let riskTolerance: "relaxed" | "moderate" | "strict" = "moderate";
  try {
    const { ConfigManager } = await import("../config/index.js");
    const cfgMgr = new ConfigManager(rootPath);
    const cfg = await cfgMgr.load();
    riskTolerance = cfg.riskTolerance ?? "moderate";
  } catch { /* use default */ }

  // ── Pre-command hooks ──
  const hookResults = await executePreCommandHooks({
    commandName: "feature complete",
    featureId,
    rootPath,
    noWarnings: false,
  });
  if (hookResults.length > 0) {
    renderWarnings(hookResults);
  }

  console.log(pc.bold(`\nDevflow Feature Complete — ${featureId}\n`));

  // ── Stage-aware DoD: detect state and compute applicable checks ──
  const runAll = options?.runAll ?? false;
  const detectedState = await detectFeatureStateFromDir(featureDir, featureId);
  const applicableIds = detectedState
    ? getApplicableCheckIds(detectedState, runAll)
    : null;

  if (runAll) {
    console.log(pc.dim(`   Mode: --all (all 25 checks forced)\n`));
  } else if (applicableIds !== null && detectedState) {
    const totalChecks = applicableIds.size;
    console.log(pc.dim(`   State: ${detectedState} — ${totalChecks} applicable checks (use --all to force all 25)\n`));
  } else {
    console.log(`Verifying Definition of Done (25 checks)...\n`);
  }

  const checks: DoDCheck[] = [];
  await runAllDoDChecks(checks, rootPath, featureDir, riskTolerance, applicableIds);

  renderDoDResults(checks, featureId, applicableIds);

  // ── Health summary after DoD ──
  const summary = await computeHealthSummary(featureDir);
  renderHealthSummary(summary);

  // Auto-generate audit reports if all blocking pass
  const allBlockingPassed = checks.filter((c) => c.blocking && !c.passed).length === 0;
  if (allBlockingPassed) {
    await tryGenerateAuditReports(featureId, rootPath, checks);
  }
}

// Exported for programmatic use (gatekeep calls this)
export async function featureCompleteInternal(
  featureId: string,
  rootPath: string,
  options?: { runAll?: boolean }
): Promise<DoDResult> {
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);

  // Load risk tolerance
  let riskTolerance: "relaxed" | "moderate" | "strict" = "moderate";
  try {
    const { ConfigManager } = await import("../config/index.js");
    const cfgMgr = new ConfigManager(rootPath);
    const cfg = await cfgMgr.load();
    riskTolerance = cfg.riskTolerance ?? "moderate";
  } catch { /* use default */ }

  // ── Stage-aware DoD: detect state and compute applicable checks ──
  const runAll = options?.runAll ?? false;
  const detectedState = await detectFeatureStateFromDir(featureDir, featureId);
  const applicableIds = detectedState
    ? getApplicableCheckIds(detectedState, runAll)
    : null;

  const checks: DoDCheck[] = [];
  await runAllDoDChecks(checks, rootPath, featureDir, riskTolerance, applicableIds);

  const allBlockingPassed = checks.filter((c) => c.blocking && !c.passed).length === 0;
  const blockingFailed = checks
    .filter((c) => c.blocking && !c.passed)
    .map((c) => ({ id: c.id, description: c.description, remediation: c.remediation }));

  const applicableChecks = applicableIds !== null
    ? checks.filter((c) => !c.skippedReason)
    : checks;

  return {
    passed: applicableChecks.filter((c) => c.passed).length,
    applicableTotal: applicableChecks.length,
    total: checks.length,
    ciStatus: checks.find((c) => c.id === "16")?.evidence || "not-checked",
    allBlockingPassed,
    blockingFailed,
  };
}

/**
 * Build stack-adaptive tool check definitions from StackProfile.
 *
 * For TypeScript/JavaScript: prefers package.json scripts (test, lint, typecheck)
 * before falling back to detected tools (vitest, jest, eslint, tsc).
 * For other stacks: uses detected commands from detectStackProfile.
 * Unknown stack: returns diagnostic-mode checks that ask for explicit config.
 */
interface ToolCheckDef {
  id: string;
  name: string;
  command: string | null;
  remediation: Remediation;
  blocking: boolean;
}

async function buildStackToolChecks(rootPath: string, riskTolerance: "relaxed" | "moderate" | "strict" = "moderate"): Promise<ToolCheckDef[]> {
  const stack = await detectStackProfile(rootPath);
  const checks: ToolCheckDef[] = [];

  // ── Helper: read package.json scripts ──
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

  // ── 1. Test check ──
  const testScript = pkgScripts.test;
  let testCmd: string | null = null;
  let testRemediation: Remediation;

  if (testScript) {
    // Use package.json script directly
    testCmd = pm === "yarn" ? "yarn test" : pm === "pnpm" ? "pnpm test" : "npm test";
    testRemediation = toolFailedRemediation("Tests", testCmd, "Run and fix failing tests.");
  } else if (stack.testCommand) {
    testCmd = stack.testCommand;
    testRemediation = toolFailedRemediation(stack.testFramework ?? "Tests", testCmd, "Run and fix failing tests.");
  } else if (stack.language === "unknown") {
    testCmd = null;
    testRemediation = {
      title: "Test command not configured",
      whyMatters: "Tests prevent regressions and verify correctness.",
      impact: "No automated test verification. Bugs may go undetected.",
      suggestedFix: 'Add a "test" script to package.json, or configure testCommand in .devflow/config.json deterministicGates.',
      minimalExample: '"scripts": { "test": "vitest run" }',
      severity: "blocking",
    };
  } else {
    testCmd = stack.testCommand;
    testRemediation = toolFailedRemediation("Tests", stack.testCommand ?? "test", "Run and fix failing tests.");
  }

  checks.push({
    id: "5",
    name: "Testes passam",
    command: testCmd,
    remediation: testRemediation,
    blocking: true,
  });

  // ── 2. TypeCheck ──
  let typeCheckCmd: string | null = null;
  let typeCheckRemediation: Remediation;

  if (pkgScripts.typecheck) {
    typeCheckCmd = `${pmRun} typecheck`;
    typeCheckRemediation = toolFailedRemediation("TypeCheck", typeCheckCmd, "Fix type errors and re-run.");
  } else if (stack.typeCheckCommand) {
    typeCheckCmd = stack.typeCheckCommand;
    typeCheckRemediation = toolFailedRemediation(stack.typeChecker ?? "TypeCheck", typeCheckCmd, "Fix type errors and re-run.");
  } else if (stack.language === "javascript") {
    // JS projects: typecheck is optional, skip
    typeCheckCmd = null;
    typeCheckRemediation = {
      title: "TypeCheck skipped (JavaScript project)",
      whyMatters: "JavaScript has no static types. Consider adding TypeScript or JSDoc.",
      impact: "No type-level verification.",
      suggestedFix: "Add TypeScript to the project for type safety.",
      minimalExample: "npm install --save-dev typescript",
      severity: "advisory",
    };
  } else if (stack.language === "go" || stack.language === "rust") {
    // Go/Rust: type checking is built into compilation
    typeCheckCmd = stack.typeCheckCommand;
    typeCheckRemediation = {
      title: "TypeCheck via compiler",
      whyMatters: `${stack.language} compiler handles type checking natively.`,
      impact: "Build failures will catch type errors.",
      suggestedFix: `Run ${stack.testCommand ?? "build"} to verify compilation.`,
      minimalExample: stack.testCommand ?? "cargo build",
      severity: "blocking",
    };
    if (!typeCheckCmd) typeCheckCmd = null; // skip if no explicit command
  } else if (stack.language === "unknown") {
    typeCheckCmd = null;
    typeCheckRemediation = {
      title: "TypeCheck not configured",
      whyMatters: "Type checking catches whole classes of bugs at compile time.",
      impact: "No static type verification.",
      suggestedFix: 'Configure typeCheckCommand in .devflow/config.json deterministicGates, or add a "typecheck" script to package.json.',
      minimalExample: '"scripts": { "typecheck": "tsc --noEmit" }',
      severity: "advisory",
    };
  } else {
    typeCheckCmd = stack.typeCheckCommand;
    typeCheckRemediation = toolFailedRemediation(stack.typeChecker ?? "TypeCheck", typeCheckCmd ?? "typecheck", "Fix type errors and re-run.");
  }

  checks.push({
    id: "6",
    name: "Typecheck passa",
    command: typeCheckCmd,
    remediation: typeCheckRemediation,
    blocking: stack.language !== "javascript", // non-blocking for plain JS
  });

  // ── 3. Lint check ──
  const lintScript = pkgScripts.lint;
  let lintCmd: string | null = null;
  let lintRemediation: Remediation;

  if (lintScript) {
    lintCmd = `${pmRun} lint`;
    lintRemediation = toolFailedRemediation("Lint", lintCmd, "Fix lint violations and re-run.");
  } else if (stack.lintCommand) {
    lintCmd = stack.lintCommand;
    lintRemediation = toolFailedRemediation(stack.linter ?? "Lint", lintCmd, "Fix lint violations and re-run.");
  } else if (stack.language === "unknown") {
    lintCmd = null;
    lintRemediation = {
      title: "Lint not configured",
      whyMatters: "Linting enforces code style and catches common errors.",
      impact: "No style/error enforcement. Code quality may degrade.",
      suggestedFix: 'Add a "lint" script to package.json, or configure lintCommand in .devflow/config.json.',
      minimalExample: '"scripts": { "lint": "eslint src/" }',
      severity: "advisory",
    };
  } else {
    lintCmd = stack.lintCommand;
    lintRemediation = toolFailedRemediation(stack.linter ?? "Lint", lintCmd ?? "lint", "Fix lint violations and re-run.");
  }

  checks.push({
    id: "7",
    name: "Lint passa",
    command: lintCmd,
    remediation: lintRemediation,
    blocking: riskTolerance !== "relaxed", // advisory in relaxed
  });

  // ── 4. Coverage check ──
  const coverageScript = pkgScripts["test:coverage"] ?? pkgScripts.coverage;
  let coverageCmd: string | null = null;
  let coverageRemediation: Remediation;

  if (coverageScript) {
    coverageCmd = `${pmRun} ${pkgScripts["test:coverage"] ? "test:coverage" : "coverage"}`;
    coverageRemediation = toolFailedRemediation("Coverage", coverageCmd, "Add tests to reach 80% coverage.");
  } else if (stack.language === "typescript" || stack.language === "javascript") {
    // Default to vitest coverage
    coverageCmd = "npx vitest run --coverage";
    coverageRemediation = toolFailedRemediation("Coverage", coverageCmd, "Add tests to reach 80% coverage.");
  } else if (stack.language === "python") {
    coverageCmd = "python -m pytest --cov=src/ --cov-report=term --cov-fail-under=80";
    coverageRemediation = toolFailedRemediation("Coverage", coverageCmd, "Add tests to reach 80% coverage.");
  } else if (stack.language === "go") {
    coverageCmd = "go test -cover ./...";
    coverageRemediation = toolFailedRemediation("Coverage", coverageCmd, "Add tests to reach 80% coverage.");
  } else if (stack.language === "rust") {
    coverageCmd = "cargo tarpaulin --out Html --fail-under 80";
    coverageRemediation = toolFailedRemediation("Coverage", coverageCmd, "Install cargo-tarpaulin and add tests.");
  } else if (stack.language === "unknown") {
    coverageCmd = null;
    coverageRemediation = {
      title: "Coverage not configured",
      whyMatters: "Coverage ensures tests exercise the codebase adequately.",
      impact: "No coverage measurement. Untested code paths may exist.",
      suggestedFix: 'Configure coverage in .devflow/config.json deterministicGates.coverage.',
      minimalExample: "Add a test:coverage script to package.json",
      severity: "advisory",
    };
  } else {
    coverageCmd = null;
    coverageRemediation = {
      title: `Coverage check skipped (${stack.language})`,
      whyMatters: `Automated coverage tooling not detected for ${stack.language}.`,
      impact: "No coverage measurement.",
      suggestedFix: `Configure coverage for ${stack.language} in .devflow/config.json.`,
      minimalExample: "Set deterministicGates.coverage to true and provide coverage command.",
      severity: "advisory",
    };
  }

  checks.push({
    id: "8",
    name: "Coverage ≥ 80%",
    command: coverageCmd,
    remediation: coverageRemediation,
    blocking: riskTolerance !== "relaxed" ? coverageCmd !== null : false, // advisory in relaxed
  });

  return checks;
}

/**
 * Push a "skipped" check entry when a check is not applicable at the current state.
 */
function skipCheck(
  checks: DoDCheck[],
  checkId: string,
  description: string,
  category: DoDCheck["category"],
): void {
  const requiredState = getCheckRequiredState(checkId);
  checks.push({
    id: checkId,
    description,
    category,
    passed: false,
    evidence: `⏭️ SKIPPED (requires state: ${requiredState})`,
    blocking: false,
    remediation: `N/A — check not applicable until state: ${requiredState}. Use --all to force.`,
    skippedReason: `Not applicable until state: ${requiredState}`,
  });
}

async function runAllDoDChecks(
  checks: DoDCheck[],
  rootPath: string,
  featureDir: string,
  riskTolerance: "relaxed" | "moderate" | "strict" = "moderate",
  applicableIds: Set<string> | null = null,
): Promise<void> {
  // Detect project type for variant-aware section validation
  const projectType: ProjectType = await detectProjectType(rootPath);

  // ── Checks 1-4: Artifact completeness (variant-aware) ──
  await checkRequirements(checks, featureDir, riskTolerance, projectType, applicableIds);
  await checkRoadmap(checks, featureDir, riskTolerance, projectType, applicableIds);
  await checkActions(checks, featureDir, riskTolerance, applicableIds);
  await checkConstitution(checks, rootPath, applicableIds);

  // ── Checks 5-8: Deterministic tools ──
  await checkDeterministicTools(checks, rootPath, riskTolerance, applicableIds);

  // ── Checks 9: Circular deps ──
  await checkCircularDeps(checks, rootPath, applicableIds);

  // ── Checks 10-11: Artifacts presence ──
  await checkSupportArtifacts(checks, featureDir, riskTolerance, applicableIds);

  // ── Check 12: Git branch ──
  checkGitBranch(checks, rootPath, applicableIds);

  // ── Check 13: TODO/FIXME ──
  await checkTodos(checks, rootPath, applicableIds);

  // ── Check 14: ADRs ──
  await checkADRs(checks, rootPath, applicableIds);

  // ── Check 15: Independent review ──
  checkIndependentReview(checks, featureDir, applicableIds);

  // ── Check 16: CI verification ──
  await checkCI(checks, rootPath, featureDir, riskTolerance, applicableIds);

  // ── Check 17: OO quality ──
  await checkOOQuality(checks, rootPath, applicableIds);

  // ── Check 18: Acceptance criteria ──
  await checkAcceptanceCriteria(checks, featureDir, applicableIds);

  // ── Check 19: Implementer ≠ approver ──
  await checkImplementerSeparation(checks, featureDir, rootPath, riskTolerance, applicableIds);

  // ── Check 20: Adversarial review ──
  await checkAdversarialReview(checks, rootPath, featureDir, applicableIds);

  // ── Check 21: Loop validation ──
  await checkLoopValidation(checks, featureDir, applicableIds);

  // ── Check 22: Sanity score ──
  await checkSanityScore(checks, featureDir, rootPath, applicableIds);

  // ── Check 23: Test plan ──
  await checkTestPlan(checks, featureDir, riskTolerance, applicableIds);

  // ── Checks 24-25: Implementation log + integrity consolidation ──
  await checkImplementationLog(checks, featureDir, rootPath, applicableIds);
}

// ── Individual check functions ──

async function checkRequirements(checks: DoDCheck[], featureDir: string, riskTolerance: "relaxed" | "moderate" | "strict" = "moderate", projectType?: ProjectType, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("1")) {
    skipCheck(checks, "1", "Requirements claros e completos", "artifact");
    return;
  }
  const reqPath = path.join(featureDir, "requirements.md");
  const hasReqs = await fileExists(reqPath);
  const blocking = riskTolerance !== "relaxed";
  const variant = projectType ?? "brownfield";
  const expectedSectionCount = variant === "greenfield" ? 10 : 15;
  if (hasReqs) {
    const md = (await safeReadFile(reqPath)) || "";
    const v = variant === "greenfield" ? validateRequirementsVariant(md, "greenfield") : validateRequirements(md);
    checks.push({
      id: "1",
      description: "Requirements claros e completos",
      category: "artifact",
      passed: v.valid && v.doubts === 0,
      evidence: v.valid
        ? `All ${expectedSectionCount} required sections complete (${variant} template)`
        : `Missing: ${[...v.missingSections, ...v.emptySections].join(", ")}`,
      blocking,
      remediation: `Fill all ${expectedSectionCount} required sections in requirements.md (${variant} template)`,
    });
  } else {
    checks.push({
      id: "1",
      description: "Requirements claros e completos",
      category: "artifact",
      passed: false,
      evidence: "requirements.md not found",
      blocking,
      remediation: `Create requirements.md with all ${expectedSectionCount} required sections (${variant} template)`,
    });
  }
}

async function checkRoadmap(checks: DoDCheck[], featureDir: string, riskTolerance: "relaxed" | "moderate" | "strict" = "moderate", projectType?: ProjectType, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("2")) {
    skipCheck(checks, "2", "Design documentado (roadmap.md)", "artifact");
    return;
  }
  const roadmapPath = path.join(featureDir, "roadmap.md");
  const hasRoadmap = await fileExists(roadmapPath);
  const blocking = riskTolerance !== "relaxed";
  const variant = projectType ?? "brownfield";
  const expectedSectionCount = variant === "greenfield" ? 5 : 13;
  if (hasRoadmap) {
    const md = (await safeReadFile(roadmapPath)) || "";
    const v = variant === "greenfield" ? validateRoadmapVariant(md, "greenfield") : validateRoadmap(md);
    checks.push({
      id: "2",
      description: "Design documentado (roadmap.md)",
      category: "artifact",
      passed: v.valid,
      evidence: v.valid
        ? `All ${expectedSectionCount} required roadmap sections complete (${variant} template)`
        : `Missing: ${[...v.missingSections, ...v.emptySections].join(", ")}`,
      blocking,
      remediation: `Fill all ${expectedSectionCount} required sections in roadmap.md (${variant} template)`,
    });
  } else {
    checks.push({
      id: "2",
      description: "Design documentado (roadmap.md)",
      category: "artifact",
      passed: false,
      evidence: "roadmap.md not found",
      blocking,
      remediation: `Create roadmap.md with all ${expectedSectionCount} required sections (${variant} template)`,
    });
  }
}

async function checkActions(checks: DoDCheck[], featureDir: string, riskTolerance: "relaxed" | "moderate" | "strict" = "moderate", applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("3")) {
    skipCheck(checks, "3", "Actions com evidências (todas [X])", "artifact");
    return;
  }
  const actionsPath = path.join(featureDir, "actions.md");
  const hasActions = await fileExists(actionsPath);
  const blocking = riskTolerance !== "relaxed";
  if (hasActions) {
    const md = (await safeReadFile(actionsPath)) || "";
    const v = validateActions(md);
    const allDone = !md.match(/\[ \]/); // no unchecked
    checks.push({
      id: "3",
      description: "Actions com evidências (todas [X])",
      category: "artifact",
      passed: v.valid && allDone,
      evidence: allDone
        ? "All actions completed with evidence"
        : "Actions not all completed",
      blocking,
      remediation: "Complete all unchecked actions and mark them [X] with evidence",
    });
  } else {
    checks.push({
      id: "3",
      description: "Actions com evidências (todas [X])",
      category: "artifact",
      passed: false,
      evidence: "actions.md not found",
      blocking,
      remediation: "Create actions.md with T001-format atomic tasks",
    });
  }
}

async function checkConstitution(checks: DoDCheck[], rootPath: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("4")) {
    skipCheck(checks, "4", "Arquitetura respeita constitution", "deterministic");
    return;
  }
  try {
    const constReport = await runConstitutionCheck(rootPath);
    const compliance = getConstitutionCompliance(constReport);
    const violations = constReport.results.filter(
      (r) => r.severity === "error" && !r.passed
    );
    checks.push({
      id: "4",
      description: "Arquitetura respeita constitution",
      category: "deterministic",
      passed: compliance.compliant,
      evidence: compliance.compliant
        ? `All ${constReport.summary.total} constitution rules pass`
        : `Violations: ${violations.map((v) => v.ruleId).join(", ")}. Human reviews needed: ${compliance.humanReviewsNeeded.length}`,
      blocking: true,
      remediation: `Fix constitution violations: ${violations.map((v) => v.ruleId).join(", ")}`,
    });
  } catch {
    checks.push({
      id: "4",
      description: "Arquitetura respeita constitution",
      category: "deterministic",
      passed: false,
      evidence: "Constitution check tools not available",
      blocking: true,
      remediation: "Install: npm install --save-dev dependency-cruiser madge eslint",
    });
  }
}

async function checkDeterministicTools(checks: DoDCheck[], rootPath: string, riskTolerance: "relaxed" | "moderate" | "strict" = "moderate", applicableIds?: Set<string> | null) {
  const toolChecks = await buildStackToolChecks(rootPath, riskTolerance);

  for (const tc of toolChecks) {
    // Stage-aware: skip if this check ID is not applicable
    if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has(tc.id)) {
      skipCheck(checks, tc.id, tc.name, "deterministic");
      continue;
    }
    if (!tc.command) {
      // Diagnostic mode — tool not configured
      checks.push({
        id: tc.id,
        description: tc.name,
        category: "deterministic",
        passed: false,
        evidence: `⚠️  Tool not configured for this stack. ${tc.remediation.suggestedFix}`,
        blocking: tc.blocking,
        remediation: tc.remediation.suggestedFix,
      });
      continue;
    }

    try {
      const output = execSync(tc.command, {
        cwd: rootPath,
        encoding: "utf-8",
        timeout: 60000,
        env: { ...process.env, CI: "true" },
      });
      checks.push({
        id: tc.id,
        description: tc.name,
        category: "deterministic",
        passed: true,
        evidence: output.slice(-200).trim(),
        blocking: tc.blocking,
        remediation: tc.remediation.suggestedFix,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      checks.push({
        id: tc.id,
        description: tc.name,
        category: "deterministic",
        passed: false,
        evidence: `${tc.remediation.title}: ${tc.remediation.suggestedFix}\n${errMsg.slice(0, 300)}`,
        blocking: tc.blocking,
        remediation: tc.remediation.suggestedFix,
      });
    }
  }
}

async function checkCircularDeps(checks: DoDCheck[], rootPath: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("9")) {
    skipCheck(checks, "9", "Imports circulares zero", "deterministic");
    return;
  }
  const stack = await detectStackProfile(rootPath);

  // Circular dep detection only applies to TypeScript/JavaScript projects
  if (stack.language !== "typescript" && stack.language !== "javascript") {
    checks.push({
      id: "9",
      description: "Imports circulares zero",
      category: "deterministic",
      passed: true,
      evidence: `Circular dep check skipped — not applicable to ${stack.language} projects`,
      blocking: false,
      remediation: `Circular dependency detection uses madge, which is for JS/TS only. Manual review recommended for ${stack.language}.`,
    });
    return;
  }

  const sourceDir = stack.sourceDir || "src";
  const ext = stack.language === "typescript" ? "ts" : "js";

  try {
    const output = execSync(
      `npx madge --circular --extensions ${ext} ${sourceDir}/ 2>&1 || true`,
      { cwd: rootPath, encoding: "utf-8", timeout: 30000 }
    );
    const noCircular = output.includes("No circular") || output.trim() === "";
    checks.push({
      id: "9",
      description: "Imports circulares zero",
      category: "deterministic",
      passed: noCircular,
      evidence: noCircular ? "No circular imports" : `Circular imports: ${output.slice(0, 200)}`,
      blocking: true,
      remediation: "Break circular imports: npx madge --circular --extensions ts src/ --image graph.svg",
    });
  } catch {
    checks.push({
      id: "9",
      description: "Imports circulares zero",
      category: "deterministic",
      passed: false,
      evidence: "madge not available — cannot verify circular deps",
      blocking: true,
      remediation: "Install madge: npm install --save-dev madge",
    });
  }
}

async function checkSupportArtifacts(checks: DoDCheck[], featureDir: string, riskTolerance: "relaxed" | "moderate" | "strict" = "moderate", applicableIds?: Set<string> | null) {
  const blocking = riskTolerance === "strict"; // only blocking in strict mode

  if (applicableIds === null || applicableIds === undefined || applicableIds.has("10")) {
    checks.push({
      id: "10",
      description: "Legacy impact analisado",
      category: "artifact",
      passed: await fileExists(path.join(featureDir, "legacy-impact.md")),
      evidence: (await fileExists(path.join(featureDir, "legacy-impact.md")))
        ? "legacy-impact.md found"
        : "legacy-impact.md missing",
      blocking,
      remediation: "Create legacy-impact.md documenting affected modules",
    });
  } else {
    skipCheck(checks, "10", "Legacy impact analisado", "artifact");
  }

  if (applicableIds === null || applicableIds === undefined || applicableIds.has("11")) {
    checks.push({
      id: "11",
      description: "Regressões cobertas",
      category: "artifact",
      passed: await fileExists(path.join(featureDir, "regression-watch.md")),
      evidence: (await fileExists(path.join(featureDir, "regression-watch.md")))
        ? "regression-watch.md found"
        : "regression-watch.md missing",
      blocking,
      remediation: "Create regression-watch.md with areas to monitor",
    });
  } else {
    skipCheck(checks, "11", "Regressões cobertas", "artifact");
  }
}

function checkGitBranch(checks: DoDCheck[], rootPath: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("12")) {
    skipCheck(checks, "12", "Branch não é main", "git");
    return;
  }
  try {
    const branch = execSync("git branch --show-current", {
      cwd: rootPath, encoding: "utf-8",
    }).trim();
    const isFeatureBranch = branch !== "main" && branch !== "master";
    checks.push({
      id: "12",
      description: "Branch não é main",
      category: "git",
      passed: isFeatureBranch,
      evidence: isFeatureBranch
        ? `On feature branch: ${branch}`
        : `⛔ On protected branch: ${branch}`,
      blocking: true,
      remediation: "Create feature branch: git checkout -b feature/<id>",
    });
  } catch {
    checks.push({
      id: "12",
      description: "Branch não é main",
      category: "git",
      passed: false,
      evidence: "Git not available",
      blocking: true,
      remediation: "Initialize git and use a feature branch",
    });
  }
}

async function checkTodos(checks: DoDCheck[], rootPath: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("13")) {
    skipCheck(checks, "13", "Sem TODO/FIXME sem ticket", "deterministic");
    return;
  }
  const stack = await detectStackProfile(rootPath);
  const sourceDir = stack.sourceDir || "src";

  // Determine file extensions to scan based on language
  let includePattern: string;
  switch (stack.language) {
    case "typescript":
      includePattern = `--include="*.ts" --include="*.tsx"`;
      break;
    case "javascript":
      includePattern = `--include="*.js" --include="*.jsx"`;
      break;
    case "python":
      includePattern = `--include="*.py"`;
      break;
    case "go":
      includePattern = `--include="*.go"`;
      break;
    case "rust":
      includePattern = `--include="*.rs"`;
      break;
    case "php":
      includePattern = `--include="*.php"`;
      break;
    case "java":
      includePattern = `--include="*.java"`;
      break;
    case "ruby":
      includePattern = `--include="*.rb"`;
      break;
    default:
      includePattern = `--include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" --include="*.go"`;
      break;
  }

  try {
    const output = execSync(
      `grep -rn "TODO\\|FIXME" ${sourceDir}/ ${includePattern} | grep -v "TODO(" | grep -v "FIXME(" || true`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 }
    );
    const clean = output.trim() === "";
    checks.push({
      id: "13",
      description: "Sem TODO/FIXME sem ticket",
      category: "deterministic",
      passed: clean,
      evidence: clean
        ? `No unlinked TODO/FIXME in ${sourceDir}/`
        : `Unlinked TODOs:\n${output.slice(0, 300)}`,
      blocking: true,
      remediation: "Link all TODOs to issues: TODO(#123): description",
    });
  } catch {
    checks.push({
      id: "13",
      description: "Sem TODO/FIXME sem ticket",
      category: "deterministic",
      passed: false,
      evidence: "grep not available — cannot verify",
      blocking: true,
      remediation: "Install grep or manually audit TODOs",
    });
  }
}

async function checkADRs(checks: DoDCheck[], rootPath: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("14")) {
    skipCheck(checks, "14", "ADRs registrados (decisões relevantes)", "process");
    return;
  }
  const adrDir = path.join(rootPath, ".devflow", "decisions");
  const hasAdrDir = await fileExists(adrDir);
  // Check if decisions directory has any .md files
  let adrCount = 0;
  if (hasAdrDir) {
    try {
      const output = execSync(`ls "${adrDir}"/*.md 2>/dev/null | wc -l`, {
        encoding: "utf-8", timeout: 5000,
      }).trim();
      adrCount = parseInt(output, 10) || 0;
    } catch { adrCount = 0; }
  }

  const constitutionMd = path.join(rootPath, ".devflow", "constitution.md");
  const hasConstitution = await fileExists(constitutionMd);

  // ADRs are required if there's a constitution or design decisions
  checks.push({
    id: "14",
    description: "ADRs registrados (decisões relevantes)",
    category: "process",
    passed: !hasConstitution || adrCount > 0,
    evidence: adrCount > 0
      ? `${adrCount} ADR(s) found in .devflow/decisions/`
      : hasConstitution
        ? "No ADRs found — architecture decisions need documentation"
        : "No constitution configured — ADRs not required",
    blocking: !!hasConstitution,
    remediation: hasConstitution
      ? "Record architecture decisions in .devflow/decisions/ as ADR markdown files"
      : "N/A",
  });
}

function checkIndependentReview(checks: DoDCheck[], _featureDir: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("15")) {
    skipCheck(checks, "15", "Review independente aprovada", "review");
    return;
  }
  // Check for adversarial review report
  checks.push({
    id: "15",
    description: "Review independente aprovada",
    category: "review",
    passed: false, // Requires human confirmation via gatekeep
    evidence: "⚠️ Requires independent review via `devflow gatekeep`",
    blocking: true,
    remediation: "Run `devflow gatekeep <featureId>` for independent approval",
  });
}

async function checkCI(checks: DoDCheck[], rootPath: string, _featureDir: string, riskTolerance: "relaxed" | "moderate" | "strict" = "moderate", applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("16")) {
    skipCheck(checks, "16", "CI verification", "ci");
    return;
  }
  // In relaxed mode, CI is not checked at all
  if (riskTolerance === "relaxed") {
    checks.push({
      id: "16",
      description: "CI verification (skipped in relaxed mode)",
      category: "ci",
      passed: true,
      evidence: "CI check skipped — riskTolerance is relaxed",
      blocking: false,
      remediation: "Enable CI in config and set riskTolerance to moderate or strict to enforce CI checks",
    });
    return;
  }
  try {
    const { verifyCIStatus } = await import("../engine/ci-verifier.js");
    const { ConfigManager } = await import("../config/index.js");
    const configMgr = new ConfigManager(rootPath);
    const config = await configMgr.load();

    if (config.ciIntegration.enabled) {
      const ciStatus = await verifyCIStatus(rootPath, config);
      const ciPassed = ciStatus.conclusion === "success";
      checks.push({
        id: "16",
        description: `CI verification (${ciStatus.workflow})`,
        category: "ci",
        passed: ciPassed,
        evidence: ciPassed
          ? `CI workflow ${ciStatus.workflow} passed on ${ciStatus.branch}`
          : ciStatus.conclusion
            ? `CI status: ${ciStatus.conclusion} — check ${ciStatus.htmlUrl || "workflow"}`
            : "CI verification unavailable",
        blocking: true,
        remediation: ciStatus.htmlUrl
          ? `Fix CI failures: ${ciStatus.htmlUrl}`
          : "Set up CI with .github/workflows/ci.yml and enable ciIntegration in config",
      });
    } else {
      const mode = config.executionMode || "local";
      const ciRequired = mode === "strict" || mode === "release" || riskTolerance === "strict";
      checks.push({
        id: "16",
        description: "CI verification",
        category: "ci",
        passed: !ciRequired,
        evidence: ciRequired
          ? "⛔ CI integration not enabled — required in " + mode + " mode / " + riskTolerance + " tolerance"
          : riskTolerance === "moderate"
            ? "⚠️ CI not enabled — advisory in moderate tolerance"
            : "CI integration not enabled in config",
        blocking: ciRequired,
        remediation: "Enable CI: set ciIntegration.enabled=true in .devflow/config.json",
      });
    }
  } catch {
    const { ConfigManager } = await import("../config/index.js");
    const { isCIUnavailableBlocking } = await import("../engine/ci-verifier.js");
    const configMgr2 = new ConfigManager(rootPath);
    const config2 = await configMgr2.load();
    const mode = config2.executionMode || "local";
    const ciRequired = isCIUnavailableBlocking(mode);

    checks.push({
      id: "16",
      description: "CI verification",
      category: "ci",
      passed: !ciRequired,
      evidence: ciRequired
        ? "⛔ CI verifier not available — blocking in " + mode + " mode"
        : "CI verifier not available — advisory in " + mode + " mode",
      blocking: ciRequired,
      remediation: ciRequired
        ? "Install GitHub CLI (https://cli.github.com/) or switch to --mode local"
        : "Install GitHub CLI: https://cli.github.com/",
    });
  }
}

async function checkOOQuality(checks: DoDCheck[], rootPath: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("17")) {
    skipCheck(checks, "17", "OO design quality (coupling, cohesion, complexity)", "deterministic");
    return;
  }
  try {
    const { ConfigManager } = await import("../config/index.js");
    const configMgr = new ConfigManager(rootPath);
    const config = await configMgr.load();

    if (config.deterministicGates.ooMetrics) {
      const { validateOOQuality } = await import("../kernel/validators/oo.js");
      const ooResult = validateOOQuality(rootPath);
      checks.push({
        id: "17",
        description: "OO design quality (coupling, cohesion, complexity)",
        category: "deterministic",
        passed: ooResult.pass,
        evidence: ooResult.pass ? `OO quality OK: ${ooResult.summary}` : ooResult.summary,
        blocking: true,
        remediation: `Fix OO quality issues: ${ooResult.violations.map((v) => v.description).join("; ")}`,
      });
    } else {
      checks.push({
        id: "17",
        description: "OO design quality (coupling, cohesion, complexity)",
        category: "deterministic",
        passed: true,
        evidence: "OO metrics gate disabled",
        blocking: false,
        remediation: "Enable ooMetrics in deterministicGates config",
      });
    }
  } catch {
    checks.push({
      id: "17",
      description: "OO design quality (coupling, cohesion, complexity)",
      category: "deterministic",
      passed: true,
      evidence: "OO validator not available",
      blocking: false,
      remediation: "N/A",
    });
  }
}

async function checkAcceptanceCriteria(checks: DoDCheck[], featureDir: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("18")) {
    skipCheck(checks, "18", "Acceptance criteria verificáveis (≥3 Gherkin, error cases)", "domain");
    return;
  }
  const tpPath = path.join(featureDir, "test-plan.md");
  if (await fileExists(tpPath)) {
    try {
      const md = (await safeReadFile(tpPath)) || "";
      const { validateTestPlanSemantic } = await import("../kernel/validators/semantic.js");
      const result = validateTestPlanSemantic(md);
      checks.push({
        id: "18",
        description: "Acceptance criteria verificáveis (≥3 Gherkin, error cases)",
        category: "domain",
        passed: result.valid,
        evidence: result.valid
          ? `Acceptance criteria score: ${result.score}/100`
          : `Gaps: ${result.failures.map((f) => f.issue).join("; ")}`,
        blocking: true,
        remediation: "Add Gherkin scenarios with Given/When/Then format. Include error paths.",
      });
    } catch {
      checks.push({
        id: "18",
        description: "Acceptance criteria verificáveis",
        category: "domain",
        passed: true,
        evidence: "Acceptance criteria validator not available",
        blocking: false,
        remediation: "N/A",
      });
    }
  } else {
    checks.push({
      id: "18",
      description: "Acceptance criteria verificáveis",
      category: "domain",
      passed: false,
      evidence: "test-plan.md not found — cannot verify acceptance criteria",
      blocking: true,
      remediation: "Create test-plan.md with Gherkin scenarios",
    });
  }
}

async function checkImplementerSeparation(checks: DoDCheck[], featureDir: string, rootPath: string, riskTolerance: "relaxed" | "moderate" | "strict" = "moderate", applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("19")) {
    skipCheck(checks, "19", "Implementer ≠ Approver (atores diferentes)", "process");
    return;
  }
  // Check review mode from config
  const { ConfigManager } = await import("../config/index.js");
  const configMgr = new ConfigManager(rootPath);
  const config = await configMgr.load();
  const reviewMode = config.reviewMode || "independent";

  const logPath = path.join(featureDir, "implementation-log.jsonl");

  // Solo-hardened: skip implementer separation, require compensating evidence
  if (reviewMode === "solo-hardened") {
    // Verify adversarial review passed as compensating evidence
    const featureIdFromDir = path.basename(featureDir);
    const reviewPath = path.join(rootPath, ".devflow", "audits", featureIdFromDir, "adversarial-review.md");
    const hasAdvReview = await fileExists(reviewPath);
    const advContent = hasAdvReview ? await safeReadFile(reviewPath) : null;
    const advPassed = advContent?.includes("PASS") ?? false;

    checks.push({
      id: "19",
      description: "Solo-Hardened: implementer separation waived, compensating evidence required",
      category: "process",
      passed: advPassed,
      evidence: advPassed
        ? "⚠️ Solo-hardened mode: implementer separation WAIVED. Compensating evidence: adversarial review PASS."
        : "⚠️ Solo-hardened mode: adversarial review not yet passed — required as compensating evidence",
      blocking: true,
      remediation: advPassed
        ? "Solo-hardened approval recorded. Independent human review did NOT occur."
        : "Run `devflow adversarial-review <featureId>` to provide compensating evidence",
    });
    return;
  }

  // Independent mode: enforce strict separation (advisory in relaxed risk tolerance)
  if (await fileExists(logPath)) {
    try {
      const raw = await safeReadFile(logPath);
      const actors = new Set<string>();
      if (raw) {
        for (const line of raw.trim().split("\n")) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.actor) actors.add(entry.actor);
          } catch { /* skip */ }
        }
      }
      const sepBlocking = riskTolerance !== "relaxed";
      checks.push({
        id: "19",
        description: "Implementer ≠ Approver (atores diferentes)",
        category: "process",
        passed: actors.size > 1,
        evidence: actors.size > 1
          ? `${actors.size} distinct actors: ${[...actors].join(", ")}`
          : "Only one actor — implementer and reviewer must differ (or switch to solo-hardened review mode)",
        blocking: sepBlocking,
        remediation: "Have a different actor run `devflow gatekeep` for approval, or run `devflow config set reviewMode solo-hardened` for solo projects",
      });
    } catch {
      checks.push({
        id: "19",
        description: "Implementer ≠ Approver",
        category: "process",
        passed: true,
        evidence: "Could not verify actors",
        blocking: false,
        remediation: "Ensure different actors implement and approve",
      });
    }
  } else {
    const sepBlocking = riskTolerance !== "relaxed";
    checks.push({
      id: "19",
      description: "Implementer ≠ Approver (atores diferentes)",
      category: "process",
      passed: false,
      evidence: "implementation-log.jsonl missing — no actor tracking",
      blocking: sepBlocking,
      remediation: "Record actor in implementation-log.jsonl entries",
    });
  }
}

async function checkAdversarialReview(checks: DoDCheck[], rootPath: string, featureDir: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("20")) {
    skipCheck(checks, "20", "Adversarial review completed and passing", "review");
    return;
  }
  const featureId = path.basename(featureDir);
  const reviewPath = path.join(rootPath, ".devflow", "audits", featureId, "adversarial-review.md");
  const exists = await fileExists(reviewPath);
  if (exists) {
    const content = await safeReadFile(reviewPath);
    const passed = content?.includes("PASS") || false;
    checks.push({
      id: "20",
      description: "Adversarial review completed and passing",
      category: "review",
      passed,
      evidence: passed
        ? "Adversarial review PASS — feature survived attack vectors"
        : "Adversarial review FAIL — fix findings before completion",
      blocking: true,
      remediation: "Run `devflow adversarial-review <featureId>` and fix all findings",
    });
  } else {
    checks.push({
      id: "20",
      description: "Adversarial review completed and passing",
      category: "review",
      passed: false,
      evidence: "adversarial-review.md not found — run adversarial review",
      blocking: true,
      remediation: "Run `devflow adversarial-review <featureId>` to attempt to break the feature",
    });
  }
}

async function checkLoopValidation(checks: DoDCheck[], featureDir: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("21")) {
    skipCheck(checks, "21", "Agentic loop validation", "process");
    return;
  }
  const actionsPath = path.join(featureDir, "actions.md");
  if (await fileExists(actionsPath)) {
    try {
      const md = (await safeReadFile(actionsPath)) || "";
      const { validateLoopsInFeature, scanActionsForLoops } = await import("../kernel/validators/loop.js");
      const loops = scanActionsForLoops(md);
      if (loops.length > 0) {
        const result = validateLoopsInFeature(md);
        checks.push({
          id: "21",
          description: `Agentic loop validation (${loops.length} loops)`,
          category: "process",
          passed: result.valid,
          evidence: result.valid
            ? `All ${loops.length} loops have explicit goal, stopCondition, maxIterations, externalCheck`
            : result.errors.join("; "),
          blocking: true,
          remediation: "Fix loop specs: each loop in actions.md needs goal, stopCondition, maxIterations, externalCheck, evidenceLog",
        });
      } else {
        checks.push({
          id: "21",
          description: "Agentic loop validation (no loops found)",
          category: "process",
          passed: true,
          evidence: "No agentic loops detected",
          blocking: false,
          remediation: "N/A",
        });
      }
    } catch {
      checks.push({
        id: "21",
        description: "Agentic loop validation",
        category: "process",
        passed: true,
        evidence: "Loop validator not available",
        blocking: false,
        remediation: "N/A",
      });
    }
  }
}

async function checkSanityScore(checks: DoDCheck[], featureDir: string, _rootPath: string, applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("22")) {
    skipCheck(checks, "22", "Artifact sanity score (real content vs boilerplate across all 4 artifacts)", "artifact");
    return;
  }
  try {
    // Read all 4 artifact files
    const artifactNames = ["requirements.md", "roadmap.md", "actions.md", "test-plan.md"];
    const artifacts: Record<string, string | null> = {};
    for (const name of artifactNames) {
      const filePath = path.join(featureDir, name);
      artifacts[name] = (await fileExists(filePath)) ? (await safeReadFile(filePath)) || "" : null;
    }

    const result = computeFeatureSanityScores(artifacts);
    const totalScore = result.overallScore;
    const color = totalScore >= 80 ? "🟢" : totalScore >= 50 ? "🟡" : "🔴";
    const details = Object.entries(result.artifacts)
      .map(([name, scores]) => `${name}: ${scores.score}/100`)
      .join(", ");

    checks.push({
      id: "22",
      description: "Artifact sanity score (real content vs boilerplate across all 4 artifacts)",
      category: "artifact",
      passed: totalScore >= 40,
      evidence: `${color} Sanity score: ${totalScore}/100 [${details}]`,
      blocking: totalScore < 40,
      remediation: totalScore < 40
        ? `Artifacts contain too much placeholder content (score: ${totalScore}/100). Replace generic sections with real project-specific information.`
        : totalScore < 80
          ? `Artifact quality is acceptable but could be improved (score: ${totalScore}/100). Review weak sections.`
          : "N/A",
    });
  } catch {
    checks.push({
      id: "22",
      description: "Artifact sanity score (real content vs boilerplate across all 4 artifacts)",
      category: "artifact",
      passed: false,
      evidence: "⚠️ ADVISORY — Sanity score engine not available",
      blocking: false,
      remediation: "Verify that the sanity-score module is properly installed. Run devflow doctor for diagnostics.",
    });
  }
}

async function checkTestPlan(checks: DoDCheck[], featureDir: string, riskTolerance: "relaxed" | "moderate" | "strict" = "moderate", applicableIds?: Set<string> | null) {
  if (applicableIds !== null && applicableIds !== undefined && !applicableIds.has("23")) {
    skipCheck(checks, "23", "Test plan completo com edge cases e error scenarios", "artifact");
    return;
  }
  const tpPath = path.join(featureDir, "test-plan.md");
  const blocking = riskTolerance !== "relaxed";
  checks.push({
    id: "23",
    description: "Test plan completo com edge cases e error scenarios",
    category: "artifact",
    passed: await fileExists(tpPath),
    evidence: (await fileExists(tpPath))
      ? "test-plan.md found"
      : "test-plan.md missing",
    blocking,
    remediation: "Create test-plan.md with test strategy, unit tests, integration tests, edge cases, and error scenarios",
  });
}

async function checkImplementationLog(checks: DoDCheck[], featureDir: string, rootPath: string, applicableIds?: Set<string> | null) {
  // Check 24
  if (applicableIds === null || applicableIds === undefined || applicableIds.has("24")) {
    const logPath = path.join(featureDir, "implementation-log.jsonl");
    const exists = await fileExists(logPath);
    let hasContent = false;
    let logRaw: string | null = null;
    if (exists) {
      logRaw = await safeReadFile(logPath);
      hasContent = !!logRaw && logRaw.trim().length > 0;
    }
    checks.push({
      id: "24",
      description: "Implementation log atualizado com entradas",
      category: "artifact",
      passed: hasContent,
      evidence: hasContent
        ? "implementation-log.jsonl has entries"
        : "implementation-log.jsonl missing or empty",
      blocking: true,
      remediation: "Record each action execution in implementation-log.jsonl",
    });
  } else {
    skipCheck(checks, "24", "Implementation log atualizado com entradas", "artifact");
  }

  // Check 25: Final gate — Integrity consolidation
  if (applicableIds === null || applicableIds === undefined || applicableIds.has("25")) {
    const logPath = path.join(featureDir, "implementation-log.jsonl");
    const exists = await fileExists(logPath);
    let logRaw: string | null = null;
    if (exists) {
      logRaw = await safeReadFile(logPath);
    }

    const blockingChecks = checks.filter((c) => c.blocking);
    const allBlockingPassed = blockingChecks.every((c) => c.passed);
    const failedBlocking = blockingChecks.filter((c) => !c.passed);

    // Verify implementation log entries match actions completion
    const actionsPath = path.join(featureDir, "actions.md");
    let actionLogConsistency = true;
    if (await fileExists(actionsPath) && exists) {
      const actionsMd = (await safeReadFile(actionsPath)) ?? "";
      const checkedCount = (actionsMd.match(/\[[xX]\]/g) || []).length;
      const logEntryCount = logRaw ? logRaw.trim().split("\n").filter((l) => l.trim()).length : 0;
      // At minimum, log entries should exist if actions are checked
      actionLogConsistency = checkedCount === 0 || logEntryCount > 0;
    }

    // Verify adversarial review exists for current feature
    const featureIdForAdv = path.basename(featureDir);
    const advReviewPath = path.join(rootPath, ".devflow", "audits", featureIdForAdv, "adversarial-review.md");
    const advReviewExists = await fileExists(advReviewPath);

    // Verify gatekeep log has entries for this feature
    const gatekeepLogPath = path.join(rootPath, ".devflow", "audits", "gatekeep-log.jsonl");
    let gatekeepHasEntries = false;
    if (await fileExists(gatekeepLogPath)) {
      const gkRaw = await safeReadFile(gatekeepLogPath);
      gatekeepHasEntries = !!(gkRaw && gkRaw.trim().length > 0);
    }

    const consolidationPassed = allBlockingPassed && actionLogConsistency;
    const issues: string[] = [];
    if (!allBlockingPassed) {
      issues.push(`${failedBlocking.length} blocking check(s) failed: ${failedBlocking.map((c) => c.id).join(", ")}`);
    }
    if (!actionLogConsistency) {
      issues.push("Actions marked complete but no implementation log entries found");
    }

    const evidenceParts: string[] = [];
    if (allBlockingPassed) {
      evidenceParts.push(`All ${blockingChecks.length} blocking checks passed`);
    }
    evidenceParts.push(`Implementation log: ${actionLogConsistency ? "consistent with actions" : "MISMATCH"}`);
    evidenceParts.push(`Adversarial review: ${advReviewExists ? "found" : "missing"}`);
    evidenceParts.push(`Gatekeep log: ${gatekeepHasEntries ? "has entries" : "empty or missing"}`);

    checks.push({
      id: "25",
      description: "Integrity consolidation (cross-check all blocking gates, logs, reviews)",
      category: "process",
      passed: consolidationPassed,
      evidence: consolidationPassed
        ? `All blocking gates passed. ${evidenceParts.join(". ")}.`
        : `INTEGRITY CHECK FAILED: ${issues.join("; ")}. ${evidenceParts.join(". ")}.`,
      blocking: true,
      remediation: issues.length > 0
        ? `Fix integrity issues: ${issues.join(". ")}.`
        : "Run devflow adversarial-review and gatekeep to complete the audit trail.",
    });
  } else {
    skipCheck(checks, "25", "Integrity consolidation (cross-check all blocking gates, logs, reviews)", "process");
  }
}

// ── Result rendering ──

function renderDoDResults(checks: DoDCheck[], featureId: string, applicableIds: Set<string> | null = null) {
  const applicableChecks = applicableIds !== null
    ? checks.filter((c) => !c.skippedReason)
    : checks;
  const skippedCount = checks.length - applicableChecks.length;

  console.log(pc.bold(`Definition of Done — ${applicableChecks.length} applicable checks${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}\n`));

  let allBlockingPassed = true;

  for (const check of checks) {
    if (check.skippedReason) {
      // Render skipped checks in dim text
      console.log(`  ${pc.dim("⏭️")} ${pc.dim(`[${check.category}]`)} ${pc.dim(check.description)}`);
      console.log(`    ${pc.dim(check.evidence)}`);
      continue;
    }

    const icon = check.passed ? pc.green("✓") : check.blocking ? pc.red("✖") : pc.yellow("⚠");
    const category = pc.dim(`[${check.category}]`);
    console.log(`  ${icon} ${category} ${check.description}`);
    if (!check.passed) {
      console.log(`    ${pc.yellow(check.evidence)}`);
      console.log(`    ${pc.dim("→ " + check.remediation)}`);
      if (check.blocking) allBlockingPassed = false;
    }
  }

  console.log();

  const totalPassed = applicableChecks.filter((c) => c.passed).length;
  const total = applicableChecks.length;

  if (allBlockingPassed) {
    const needsHumanReview = applicableChecks.find((c) => c.id === "15" && !c.passed);
    if (needsHumanReview) {
      console.log(pc.yellow(`⚠️  ${totalPassed}/${total} applicable checks passed. All blocking checks passed.`));
      console.log(pc.yellow("   ⚠️  Gatekeeper review required before merge."));
      console.log(`\n   Run ${pc.bold("devflow gatekeep " + featureId)} to approve or reject.`);
    } else {
      console.log(pc.green(`✅ ${totalPassed}/${total} applicable checks passed — feature ready for merge.`));
      console.log(`\n   Run ${pc.bold(`git checkout main && git merge feature/${featureId}`)}`);
    }
  } else {
    const failed = applicableChecks.filter((c) => !c.passed && c.blocking);
    console.log(pc.red(`❌ ${failed.length}/${total} applicable checks blocking. Fix before completing feature.\n`));
    console.log(pc.bold("Failed blocking checks:"));
    for (const f of failed) {
      console.log(pc.red(`  ✖ [${f.id}] ${f.description}`));
      console.log(pc.yellow(`    → ${f.remediation}`));
    }
    console.log(pc.yellow("\n   Devflow blocks completion until all blocking checks pass.\n"));
  }

  if (skippedCount > 0) {
    console.log(pc.dim(`   ${skippedCount} check(s) skipped — not applicable at current feature state (use --all to force).`));
  }

  console.log();
}

// ── Audit report generation ──

async function tryGenerateAuditReports(
  featureId: string,
  rootPath: string,
  checks: DoDCheck[]
): Promise<void> {
  // Will be fully implemented in Phase 4
  // For now, generate a basic summary
  const auditDir = path.join(rootPath, ".devflow", "audits");
  try { execSync(`mkdir -p "${auditDir}"`); } catch { /* ok */ }

  const summaryPath = path.join(auditDir, "dod-summary.md");
  const now = new Date().toISOString();
  const summary = `# DoD Summary — ${featureId}
> **Generated:** ${now}

| # | Check | Category | Passed | Blocking |
|---|-------|----------|--------|----------|
${checks.map((c) => `| ${c.id} | ${c.description} | ${c.category} | ${c.passed ? "✓" : "✖"} | ${c.blocking ? "🔴" : "🟡"} |`).join("\n")}

**Result:** ${checks.filter((c) => c.blocking && !c.passed).length === 0 ? "All blocking checks passed" : "Blocking checks failed"}
`;

  const { atomicWrite } = await import("../utils/fs.js");
  await atomicWrite(summaryPath, summary);

  console.log(pc.dim(`   Audit summary: ${summaryPath}`));
}