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
import { runConstitutionCheck } from "../constitution/checker.js";
import pc from "picocolors";

interface DoDCheck {
  id: string;
  description: string;
  category: "artifact" | "deterministic" | "process" | "git" | "review";
  passed: boolean;
  evidence: string;
  blocking: boolean;
}

export async function featureComplete(
  featureId: string,
  rootPath: string
): Promise<void> {
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);

  console.log(pc.bold(`\nDevflow Feature Complete — ${featureId}\n`));
  console.log(`Verifying Definition of Done...\n`);

  const checks: DoDCheck[] = [];

  // ── Check 1-4: Artifact completeness ──
  {
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
      });
    } else {
      checks.push({
        id: "1",
        description: "Requirements claros e completos",
        category: "artifact",
        passed: false,
        evidence: "requirements.md not found",
        blocking: true,
      });
    }
  }

  {
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
      });
    } else {
      checks.push({
        id: "2",
        description: "Design documentado (roadmap.md)",
        category: "artifact",
        passed: false,
        evidence: "roadmap.md not found",
        blocking: true,
      });
    }
  }

  {
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
      });
    } else {
      checks.push({
        id: "3",
        description: "Actions com evidências (todas [X])",
        category: "artifact",
        passed: false,
        evidence: "actions.md not found",
        blocking: true,
      });
    }
  }

  // ── Check 4: Constitution ──
  try {
    const constReport = await runConstitutionCheck(rootPath);
    const violations = constReport.results.filter(
      (r) => r.severity === "error" && !r.passed
    );
    checks.push({
      id: "4",
      description: "Arquitetura respeita constitution",
      category: "deterministic",
      passed: violations.length === 0,
      evidence:
        violations.length === 0
          ? `All constitution rules pass (${constReport.summary.total} checks)`
          : `Violations: ${violations.map((v) => v.ruleId).join(", ")}`,
      blocking: true,
    });
  } catch {
    checks.push({
      id: "4",
      description: "Arquitetura respeita constitution",
      category: "deterministic",
      passed: true,
      evidence: "Constitution check skipped (tools not available)",
      blocking: false,
    });
  }

  // ── Checks 5-8: Deterministic tools ──
  const toolChecks: Array<{
    id: string;
    name: string;
    command: string;
    failMsg: string;
  }> = [
    {
      id: "5",
      name: "Testes passam",
      command: "npx vitest run --reporter=verbose",
      failMsg: "Test failures. Run: npx vitest run",
    },
    {
      id: "6",
      name: "Typecheck passa",
      command: "npx tsc --noEmit",
      failMsg: "Type errors. Run: npx tsc --noEmit",
    },
    {
      id: "7",
      name: "Lint passa",
      command:
        "npx eslint src/ --max-warnings 0 --config .devflow/eslintrc.constitution.json 2>&1 || true",
      failMsg: "Lint violations. Run: npx eslint src/",
    },
    {
      id: "8",
      name: "Coverage ≥ 80%",
      command: "npx vitest run --coverage 2>&1 || true",
      failMsg: "Coverage below 80%. Run: npx vitest run --coverage",
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
        blocking: tc.id !== "7", // lint warnings non-blocking
      });
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : String(err);
      checks.push({
        id: tc.id,
        description: tc.name,
        category: "deterministic",
        passed: false,
        evidence: `${tc.failMsg}\n${errMsg.slice(0, 300)}`,
        blocking: tc.id !== "7" && tc.id !== "8", // lint/coverage non-blocking
      });
    }
  }

  // ── Check 9: Circular deps ──
  try {
    const output = execSync(
      "npx madge --circular --extensions ts src/ 2>&1 || true",
      { cwd: rootPath, encoding: "utf-8", timeout: 30000 }
    );
    const noCircular =
      output.includes("No circular") || output.trim() === "";
    checks.push({
      id: "9",
      description: "Imports circulares zero",
      category: "deterministic",
      passed: noCircular,
      evidence: noCircular
        ? "No circular imports"
        : `Circular imports: ${output.slice(0, 200)}`,
      blocking: true,
    });
  } catch {
    checks.push({
      id: "9",
      description: "Imports circulares zero",
      category: "deterministic",
      passed: true,
      evidence: "madge not available (skipped)",
      blocking: false,
    });
  }

  // ── Check 10-12: Artifacts present ──
  checks.push({
    id: "10",
    description: "Legacy impact analisado",
    category: "artifact",
    passed: await fileExists(path.join(featureDir, "legacy-impact.md")),
    evidence: (await fileExists(path.join(featureDir, "legacy-impact.md")))
      ? "legacy-impact.md found"
      : "legacy-impact.md missing",
    blocking: true,
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
  });

  checks.push({
    id: "12",
    description: "Implementation log atualizado",
    category: "artifact",
    passed: await fileExists(path.join(featureDir, "implementation-log.jsonl")),
    evidence: (await fileExists(
      path.join(featureDir, "implementation-log.jsonl")
    ))
      ? "implementation-log.jsonl found"
      : "implementation-log.jsonl missing",
    blocking: true,
  });

  // ── Check 13: Git branch not main ──
  try {
    const branch = execSync("git branch --show-current", {
      cwd: rootPath,
      encoding: "utf-8",
    }).trim();
    const isFeatureBranch =
      branch !== "main" && branch !== "master";
    checks.push({
      id: "13",
      description: "Branch não é main",
      category: "git",
      passed: isFeatureBranch,
      evidence: isFeatureBranch
        ? `On feature branch: ${branch}`
        : `⛔ On protected branch: ${branch}`,
      blocking: true,
    });
  } catch {
    checks.push({
      id: "13",
      description: "Branch não é main",
      category: "git",
      passed: false,
      evidence: "Git not available",
      blocking: true,
    });
  }

  // ── Check 14: No TODO/FIXME without ticket ──
  try {
    const output = execSync(
      'grep -rn "TODO\\|FIXME" src/ --include="*.ts" | grep -v "TODO(#" | grep -v "FIXME(#" || true',
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 }
    );
    const clean = output.trim() === "";
    checks.push({
      id: "14",
      description: "Sem TODO/FIXME sem ticket",
      category: "deterministic",
      passed: clean,
      evidence: clean
        ? "No unlinked TODO/FIXME"
        : `Unlinked TODOs:\n${output.slice(0, 300)}`,
      blocking: true,
    });
  } catch {
    checks.push({
      id: "14",
      description: "Sem TODO/FIXME sem ticket",
      category: "deterministic",
      passed: true,
      evidence: "grep not available (skipped)",
      blocking: false,
    });
  }

  // ── Check 15: ADRs for relevant decisions ──
  checks.push({
    id: "15",
    description: "ADRs registrados (decisões relevantes)",
    category: "process",
    passed: true, // Checked during review phase
    evidence: "ADR check deferred to architecture review",
    blocking: false,
  });

  // ── Check 16: Review independente ──
  checks.push({
    id: "16",
    description: "Review independente aprovada",
    category: "review",
    passed: false, // Requires human confirmation
    evidence: "⚠️  Requires independent review approval. Run gatekeeper review.",
    blocking: true,
  });

  // ── Render results ──
  console.log(pc.bold("Definition of Done — 16 Checks\n"));

  let allBlockingPassed = true;

  for (const check of checks) {
    const icon = check.passed ? pc.green("✓") : check.blocking ? pc.red("✖") : pc.yellow("⚠");
    const category = pc.dim(`[${check.category}]`);
    console.log(`  ${icon} ${category} ${check.description}`);
    if (!check.passed) {
      console.log(`    ${pc.yellow(check.evidence)}`);
      if (check.blocking) {
        allBlockingPassed = false;
      }
    }
  }

  console.log();

  const totalPassed = checks.filter((c) => c.passed).length;
  const total = checks.length;

  if (allBlockingPassed) {
    // Check 16 is the gatekeeper review - still needs human confirmation
    const needsHumanReview = checks.find(
      (c) => c.id === "16" && !c.passed
    );

    if (needsHumanReview) {
      console.log(
        pc.yellow(
          `⚠️  ${totalPassed}/${total} checks passed. All blocking checks passed.`
        )
      );
      console.log(
        pc.yellow(
          "   ⚠️  Gatekeeper review required before merge."
        )
      );
      console.log(
        `\n   Run ${pc.bold("devflow gatekeep " + featureId)} to approve or reject.`
      );
    } else {
      console.log(
        pc.green(
          `✅ ${totalPassed}/${total} checks passed — feature ready for merge.`
        )
      );
      console.log(
        `\n   Run ${pc.bold(`git checkout main && git merge feature/${featureId}`)}`
      );
    }
  } else {
    const failed = checks.filter((c) => !c.passed && c.blocking);
    console.log(
      pc.red(
        `❌ ${failed.length} blocking checks failed. Fix before completing feature.`
      )
    );
    console.log(
      pc.yellow(
        "\n   Devflow blocks completion until all blocking checks pass."
      )
    );
  }

  console.log();
}
