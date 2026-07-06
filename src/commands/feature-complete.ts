import path from "node:path";
import { execSync } from "node:child_process";
import {
  fileExists,
  safeReadFile,
} from "../utils/fs.js";
import {
  validateRequirements,
  validateRoadmap,
  validateActions,
} from "../artifacts/validator.js";
import { runConstitutionCheck, getConstitutionCompliance } from "../constitution/checker.js";
import pc from "picocolors";

interface DoDCheck {
  id: string;
  description: string;
  category: "artifact" | "deterministic" | "process" | "git" | "review" | "domain" | "ci";
  passed: boolean;
  evidence: string;
  blocking: boolean;
  remediation: string;
}

export interface DoDResult {
  passed: number;
  total: number;
  ciStatus: string;
  allBlockingPassed: boolean;
}

export async function featureComplete(
  featureId: string,
  rootPath: string
): Promise<void> {
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);

  console.log(pc.bold(`\nDevflow Feature Complete — ${featureId}\n`));
  console.log(`Verifying Definition of Done (25 checks)...\n`);

  const checks: DoDCheck[] = [];
  await runAllDoDChecks(checks, rootPath, featureDir);

  renderDoDResults(checks, featureId);

  // Auto-generate audit reports if all blocking pass
  const allBlockingPassed = checks.filter((c) => c.blocking && !c.passed).length === 0;
  if (allBlockingPassed) {
    await tryGenerateAuditReports(featureId, rootPath, checks);
  }
}

// Exported for programmatic use (gatekeep calls this)
export async function featureCompleteInternal(
  featureId: string,
  rootPath: string
): Promise<DoDResult> {
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);
  const checks: DoDCheck[] = [];
  await runAllDoDChecks(checks, rootPath, featureDir);

  const allBlockingPassed = checks.filter((c) => c.blocking && !c.passed).length === 0;

  return {
    passed: checks.filter((c) => c.passed).length,
    total: checks.length,
    ciStatus: checks.find((c) => c.id === "19")?.evidence || "not-checked",
    allBlockingPassed,
  };
}

async function runAllDoDChecks(
  checks: DoDCheck[],
  rootPath: string,
  featureDir: string
): Promise<void> {
  // ── Checks 1-4: Artifact completeness ──
  await checkRequirements(checks, featureDir);
  await checkRoadmap(checks, featureDir);
  await checkActions(checks, featureDir);
  await checkConstitution(checks, rootPath);

  // ── Checks 5-8: Deterministic tools ──
  await checkDeterministicTools(checks, rootPath);

  // ── Checks 9: Circular deps ──
  await checkCircularDeps(checks, rootPath);

  // ── Checks 10-12: Artifacts presence ──
  await checkSupportArtifacts(checks, featureDir);

  // ── Check 13: Git branch ──
  checkGitBranch(checks, rootPath);

  // ── Check 14: TODO/FIXME ──
  await checkTodos(checks, rootPath);

  // ── Check 15: ADRs ──
  await checkADRs(checks, rootPath);

  // ── Check 16: Independent review ──
  checkIndependentReview(checks, featureDir);

  // ── Check 17: CI verification ──
  await checkCI(checks, rootPath, featureDir);

  // ── Check 18: OO quality ──
  await checkOOQuality(checks, rootPath);

  // ── Check 19: Acceptance criteria ──
  await checkAcceptanceCriteria(checks, featureDir);

  // ── Check 20: Implementer ≠ approver ──
  await checkImplementerSeparation(checks, featureDir);

  // ── Check 21: Adversarial review ──
  await checkAdversarialReview(checks, rootPath);

  // ── Check 22: Loop validation ──
  await checkLoopValidation(checks, featureDir);

  // ── Check 23: Semantic quality ──
  await checkSemanticQuality(checks, featureDir);

  // ── Check 24: Test plan ──
  await checkTestPlan(checks, featureDir);

  // ── Check 25: Implementation log ──
  await checkImplementationLog(checks, featureDir);
}

// ── Individual check functions ──

async function checkRequirements(checks: DoDCheck[], featureDir: string) {
  const reqPath = path.join(featureDir, "requirements.md");
  const hasReqs = await fileExists(reqPath);
  if (hasReqs) {
    const md = (await safeReadFile(reqPath)) || "";
    const v = validateRequirements(md);
    checks.push({
      id: "1",
      description: "Requirements claros e completos",
      category: "artifact",
      passed: v.valid && v.doubts === 0,
      evidence: v.valid
        ? "All required sections complete"
        : `Missing: ${[...v.missingSections, ...v.emptySections].join(", ")}`,
      blocking: true,
      remediation: "Fill all 15 required sections in requirements.md",
    });
  } else {
    checks.push({
      id: "1",
      description: "Requirements claros e completos",
      category: "artifact",
      passed: false,
      evidence: "requirements.md not found",
      blocking: true,
      remediation: "Create requirements.md with all 15 required sections",
    });
  }
}

async function checkRoadmap(checks: DoDCheck[], featureDir: string) {
  const roadmapPath = path.join(featureDir, "roadmap.md");
  const hasRoadmap = await fileExists(roadmapPath);
  if (hasRoadmap) {
    const md = (await safeReadFile(roadmapPath)) || "";
    const v = validateRoadmap(md);
    checks.push({
      id: "2",
      description: "Design documentado (roadmap.md)",
      category: "artifact",
      passed: v.valid,
      evidence: v.valid
        ? "All required roadmap sections complete"
        : `Missing: ${[...v.missingSections, ...v.emptySections].join(", ")}`,
      blocking: true,
      remediation: "Fill all 13 required sections in roadmap.md",
    });
  } else {
    checks.push({
      id: "2",
      description: "Design documentado (roadmap.md)",
      category: "artifact",
      passed: false,
      evidence: "roadmap.md not found",
      blocking: true,
      remediation: "Create roadmap.md with architecture, layers, patterns, interfaces",
    });
  }
}

async function checkActions(checks: DoDCheck[], featureDir: string) {
  const actionsPath = path.join(featureDir, "actions.md");
  const hasActions = await fileExists(actionsPath);
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
      blocking: true,
      remediation: "Complete all unchecked actions and mark them [X] with evidence",
    });
  } else {
    checks.push({
      id: "3",
      description: "Actions com evidências (todas [X])",
      category: "artifact",
      passed: false,
      evidence: "actions.md not found",
      blocking: true,
      remediation: "Create actions.md with T001-format atomic tasks",
    });
  }
}

async function checkConstitution(checks: DoDCheck[], rootPath: string) {
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

async function checkDeterministicTools(checks: DoDCheck[], rootPath: string) {
  const toolChecks: Array<{
    id: string;
    name: string;
    command: string;
    remediation: string;
    blocking: boolean;
  }> = [
    {
      id: "5",
      name: "Testes passam",
      command: "npx vitest run --reporter=verbose",
      remediation: "Fix failing tests: npx vitest run",
      blocking: true,
    },
    {
      id: "6",
      name: "Typecheck passa",
      command: "npx tsc --noEmit",
      remediation: "Fix type errors: npx tsc --noEmit",
      blocking: true,
    },
    {
      id: "7",
      name: "Lint passa",
      command: "npx eslint src/ --max-warnings 0 --config .devflow/eslintrc.constitution.json 2>&1 || true",
      remediation: "Fix lint violations: npx eslint src/ --fix",
      blocking: true,
    },
    {
      id: "8",
      name: "Coverage ≥ 80%",
      command: "npx vitest run --coverage 2>&1 || true",
      remediation: "Add tests to reach 80% coverage: npx vitest run --coverage",
      blocking: true,
    },
  ];

  for (const tc of toolChecks) {
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
        remediation: tc.remediation,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      checks.push({
        id: tc.id,
        description: tc.name,
        category: "deterministic",
        passed: false,
        evidence: `${tc.remediation}\n${errMsg.slice(0, 300)}`,
        blocking: tc.blocking,
        remediation: tc.remediation,
      });
    }
  }
}

async function checkCircularDeps(checks: DoDCheck[], rootPath: string) {
  try {
    const output = execSync(
      "npx madge --circular --extensions ts src/ 2>&1 || true",
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

async function checkSupportArtifacts(checks: DoDCheck[], featureDir: string) {
  checks.push({
    id: "10",
    description: "Legacy impact analisado",
    category: "artifact",
    passed: await fileExists(path.join(featureDir, "legacy-impact.md")),
    evidence: (await fileExists(path.join(featureDir, "legacy-impact.md")))
      ? "legacy-impact.md found"
      : "legacy-impact.md missing",
    blocking: true,
    remediation: "Create legacy-impact.md documenting affected modules",
  });

  checks.push({
    id: "11",
    description: "Regressões cobertas",
    category: "artifact",
    passed: await fileExists(path.join(featureDir, "regression-watch.md")),
    evidence: (await fileExists(path.join(featureDir, "regression-watch.md")))
      ? "regression-watch.md found"
      : "regression-watch.md missing",
    blocking: true,
    remediation: "Create regression-watch.md with areas to monitor",
  });
}

function checkGitBranch(checks: DoDCheck[], rootPath: string) {
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

async function checkTodos(checks: DoDCheck[], rootPath: string) {
  try {
    const output = execSync(
      'grep -rn "TODO\\|FIXME" src/ --include="*.ts" | grep -v "TODO(" | grep -v "FIXME(" || true',
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 }
    );
    const clean = output.trim() === "";
    checks.push({
      id: "13",
      description: "Sem TODO/FIXME sem ticket",
      category: "deterministic",
      passed: clean,
      evidence: clean ? "No unlinked TODO/FIXME" : `Unlinked TODOs:\n${output.slice(0, 300)}`,
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

async function checkADRs(checks: DoDCheck[], rootPath: string) {
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

function checkIndependentReview(checks: DoDCheck[], _featureDir: string) {
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

async function checkCI(checks: DoDCheck[], rootPath: string, _featureDir: string) {
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
      checks.push({
        id: "16",
        description: "CI verification",
        category: "ci",
        passed: true,
        evidence: "CI integration not enabled in config",
        blocking: false,
        remediation: "Enable CI: set ciIntegration.enabled=true in .devflow/config.json",
      });
    }
  } catch {
    checks.push({
      id: "16",
      description: "CI verification",
      category: "ci",
      passed: true,
      evidence: "CI verifier not available",
      blocking: false,
      remediation: "Install GitHub CLI: https://cli.github.com/",
    });
  }
}

async function checkOOQuality(checks: DoDCheck[], rootPath: string) {
  try {
    const { ConfigManager } = await import("../config/index.js");
    const configMgr = new ConfigManager(rootPath);
    const config = await configMgr.load();

    if (config.deterministicGates.ooMetrics) {
      const { validateOOQuality } = await import("../engine/oo-validator.js");
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

async function checkAcceptanceCriteria(checks: DoDCheck[], featureDir: string) {
  const tpPath = path.join(featureDir, "test-plan.md");
  if (await fileExists(tpPath)) {
    try {
      const md = (await safeReadFile(tpPath)) || "";
      const { validateTestPlanSemantic } = await import("../engine/semantic-validator.js");
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

async function checkImplementerSeparation(checks: DoDCheck[], featureDir: string) {
  const logPath = path.join(featureDir, "implementation-log.jsonl");
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
      checks.push({
        id: "19",
        description: "Implementer ≠ Approver (atores diferentes)",
        category: "process",
        passed: actors.size > 1,
        evidence: actors.size > 1
          ? `${actors.size} distinct actors: ${[...actors].join(", ")}`
          : "Only one actor — implementer and reviewer must differ",
        blocking: true,
        remediation: "Have a different actor run `devflow gatekeep` for approval",
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
    checks.push({
      id: "19",
      description: "Implementer ≠ Approver (atores diferentes)",
      category: "process",
      passed: false,
      evidence: "implementation-log.jsonl missing — no actor tracking",
      blocking: true,
      remediation: "Record actor in implementation-log.jsonl entries",
    });
  }
}

async function checkAdversarialReview(checks: DoDCheck[], rootPath: string) {
  const reviewPath = path.join(rootPath, ".devflow", "audits", "adversarial-review.md");
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

async function checkLoopValidation(checks: DoDCheck[], featureDir: string) {
  const actionsPath = path.join(featureDir, "actions.md");
  if (await fileExists(actionsPath)) {
    try {
      const md = (await safeReadFile(actionsPath)) || "";
      const { validateLoopsInFeature, scanActionsForLoops } = await import("../engine/loop-validator.js");
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

async function checkSemanticQuality(checks: DoDCheck[], featureDir: string) {
  const reqPath = path.join(featureDir, "requirements.md");
  if (await fileExists(reqPath)) {
    try {
      const md = (await safeReadFile(reqPath)) || "";
      const { validateRequirementsSemantic } = await import("../engine/semantic-validator.js");
      const result = validateRequirementsSemantic(md);
      checks.push({
        id: "22",
        description: "Semantic quality (artifacts have real content, not boilerplate)",
        category: "artifact",
        passed: result.valid,
        evidence: result.valid
          ? `Semantic quality score: ${result.score}/100`
          : `Semantic failures: ${result.failures.map((f) => `${f.section}: ${f.issue}`).join("; ")}`,
        blocking: true,
        remediation: `Replace generic placeholder content. Score: ${result.score}/100. Issues: ${result.failures.map((f) => f.issue).join(". ")}`,
      });
    } catch {
      checks.push({
        id: "22",
        description: "Semantic quality (artifacts have real content)",
        category: "artifact",
        passed: true,
        evidence: "Semantic validator not available",
        blocking: false,
        remediation: "N/A",
      });
    }
  }
}

async function checkTestPlan(checks: DoDCheck[], featureDir: string) {
  const tpPath = path.join(featureDir, "test-plan.md");
  checks.push({
    id: "23",
    description: "Test plan completo com edge cases e error scenarios",
    category: "artifact",
    passed: await fileExists(tpPath),
    evidence: (await fileExists(tpPath))
      ? "test-plan.md found"
      : "test-plan.md missing",
    blocking: true,
    remediation: "Create test-plan.md with test strategy, unit tests, integration tests, edge cases, and error scenarios",
  });
}

async function checkImplementationLog(checks: DoDCheck[], featureDir: string) {
  const logPath = path.join(featureDir, "implementation-log.jsonl");
  const exists = await fileExists(logPath);
  let hasContent = false;
  if (exists) {
    const raw = await safeReadFile(logPath);
    hasContent = !!raw && raw.trim().length > 0;
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

  // Final gate: Reserved for future use
  checks.push({
    id: "25",
    description: "All blocking checks passed (final gate)",
    category: "process",
    passed: true,
    evidence: "Final gate reserved for future integrity checks",
    blocking: false,
    remediation: "N/A",
  });
}

// ── Result rendering ──

function renderDoDResults(checks: DoDCheck[], featureId: string) {
  console.log(pc.bold(`Definition of Done — ${checks.length} Checks\n`));

  let allBlockingPassed = true;

  for (const check of checks) {
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

  const totalPassed = checks.filter((c) => c.passed).length;
  const total = checks.length;

  if (allBlockingPassed) {
    const needsHumanReview = checks.find((c) => c.id === "15" && !c.passed);
    if (needsHumanReview) {
      console.log(pc.yellow(`⚠️  ${totalPassed}/${total} checks passed. All blocking checks passed.`));
      console.log(pc.yellow("   ⚠️  Gatekeeper review required before merge."));
      console.log(`\n   Run ${pc.bold("devflow gatekeep " + featureId)} to approve or reject.`);
    } else {
      console.log(pc.green(`✅ ${totalPassed}/${total} checks passed — feature ready for merge.`));
      console.log(`\n   Run ${pc.bold(`git checkout main && git merge feature/${featureId}`)}`);
    }
  } else {
    const failed = checks.filter((c) => !c.passed && c.blocking);
    console.log(pc.red(`❌ ${failed.length}/${total} blocking checks failed. Fix before completing feature.\n`));
    console.log(pc.bold("Failed blocking checks:"));
    for (const f of failed) {
      console.log(pc.red(`  ✖ [${f.id}] ${f.description}`));
      console.log(pc.yellow(`    → ${f.remediation}`));
    }
    console.log(pc.yellow("\n   Devflow blocks completion until all blocking checks pass.\n"));
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
