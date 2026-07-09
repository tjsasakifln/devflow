import path from "node:path";
import { inspectProject } from "../adapters/project/inspector.js";
import { detectState } from "../kernel/state/detector.js";
import { computeRecommendation } from "../kernel/actions/recommender.js";
import { fileExists } from "../kernel/utils/fs.js";
import { WorkflowEngine } from "../kernel/workflow/engine.js";
import { ParallelSpawner } from "../kernel/orchestration/parallel-spawner.js";
import { resolveDimensions } from "../kernel/orchestration/dimensions.js";
import { CompletenessCritic } from "../kernel/orchestration/completeness-critic.js";
import type { AnalysisContext } from "../kernel/orchestration/completeness-critic.js";
import pc from "picocolors";

export async function nextCommand(
  cwd: string,
  options: { json?: boolean; force?: boolean; diagnose?: boolean; engine?: boolean }
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const inspection = await inspectProject(rootPath);

  // Determine whether to use engine or legacy recommender
  const useEngine = options.engine ?? true; // Default to engine
  let recommendation: any;

  if (useEngine) {
    try {
      const engine = new WorkflowEngine(rootPath);
      await engine.initialize(inspection);
      const engineRec = await engine.getRecommendation();

      // Map engine recommendation to the format expected by the display
      const recAction = engineRec.recommendedTransition;
      const nextActionEntry = recAction
        ? recommendationFromTransition(recAction)
        : unknownStateRecommendation(engineRec.currentState);

      recommendation = {
        currentState: engineRec.currentState,
        confidence: engineRec.confidence,
        evidence: [],
        known: engineRec.known,
        assumptions: [],
        blockers: engineRec.blockers,
        recommendedNextAction: nextActionEntry,
        alternatives: [],
        workflow: engineRec.workflow,
      };
    } catch {
      // Fall back to legacy if engine fails
      const stateResult = await detectState(inspection);
      recommendation = computeRecommendation(stateResult, inspection);
    }
  } else {
    const stateResult = await detectState(inspection);
    recommendation = computeRecommendation(stateResult, inspection);
  }

  if (options.json) {
    console.log(JSON.stringify(recommendation, null, 2));
    return;
  }

  const action = recommendation.recommendedNextAction;
  const safetyIcon =
    action.safetyLevel === "safe"
      ? pc.green("\u{1F7E2} safe")
      : action.safetyLevel === "caution"
        ? pc.yellow("\u{1F7E1} caution")
        : pc.red("\u{1F534} blocked");

  console.log(pc.bold("\nDevflow — Next Best Action\n"));
  console.log(pc.dim("═".repeat(55)));

  console.log(pc.bold("\nCurrent State: "), pc.cyan(recommendation.currentState));
  console.log(pc.bold("Confidence:    "), recommendation.confidence);
  if (recommendation.workflow) {
    console.log(pc.bold("Workflow:      "), pc.dim(recommendation.workflow));
  }

  // Primary Recommendation
  console.log(pc.bold("\n✦ PRIMARY RECOMMENDATION"));
  console.log(`  ${pc.bold(action.description)}`);
  console.log(`  ${pc.dim(action.why)}`);
  console.log();
  console.log(`  Safety:    ${safetyIcon}`);
  console.log(`  Workflow:  ${pc.dim(action.agentOrWorkflow)}`);

  // Artifact Health
  if (inspection.activeFeature) {
    await showArtifactHealth(rootPath, inspection);
  }

  // Blockers
  if (recommendation.blockers.length > 0) {
    console.log(pc.bold("\n✦ BLOCKERS"));
    for (const b of recommendation.blockers) {
      console.log(`  ${pc.red("🚫")} ${b}`);
    }
  }

  // Can AI code now?
  await showCanCodeNow(recommendation.currentState, recommendation.blockers, rootPath, inspection, options);

  // Specific file guidance
  if (options.diagnose) {
    await showDiagnosticDetail(recommendation.currentState, rootPath, inspection);
  }

  // Files referenced
  if (action.reads && action.reads.length > 0) {
    console.log(pc.bold("\n✦ RELEVANT FILES"));
    for (const r of action.reads) {
      console.log(`  ${pc.dim("→")} ${r}`);
    }
  }

  // Alternatives
  if (recommendation.alternatives && recommendation.alternatives.length > 0) {
    console.log(pc.bold("\n✦ ALTERNATIVES"));
    for (let i = 0; i < recommendation.alternatives.length; i++) {
      const alt = recommendation.alternatives[i];
      console.log(`  ${pc.cyan(`${i + 1}.`)} ${alt.description}`);
      if (alt.whenToChoose) {
        console.log(`     ${pc.dim(alt.whenToChoose)}`);
      }
    }
  }

  if (!options.diagnose) {
    console.log(pc.dim("\n  Run with --diagnose for detailed artifact content analysis.\n"));
  } else {
    console.log();
  }
}

/**
 * Map a ValidTransition to the NextActionEntry-like format.
 */
function recommendationFromTransition(
  recAction: any,
): any {
  const t = recAction.transition;
  const guardNote =
    recAction.guardResult?.passed === false
      ? ` (guard: ${recAction.guardResult.reason ?? "blocked"})`
      : "";

  return {
    id: t.id,
    description: `${t.label}${guardNote}`,
    why: t.description,
    agentOrWorkflow: t.workflow,
    writes: [],
    reads: [],
    safetyLevel:
      recAction.guardResult?.passed === false
        ? "blocked"
        : recAction.guardResult?.passed === null
          ? "caution"
          : "safe",
  };
}

function unknownStateRecommendation(stateName: string): any {
  return {
    id: "unknown-state",
    description: `State "${stateName}" not fully mapped. Run \`devflow doctor\` for diagnosis.`,
    why: "The current state does not have a recommended transition.",
    agentOrWorkflow: "orchestrator",
    writes: [],
    reads: [],
    safetyLevel: "caution",
  };
}

// ---------------------------------------------------------------------------
// Legacy display helpers — kept unchanged for backward compat
// ---------------------------------------------------------------------------

async function showArtifactHealth(_rootPath: string, inspection: any): Promise<void> {
  const feature = inspection.activeFeature;
  if (!feature) return;

  const artifacts = [
    { name: "requirements.md", label: "Requirements", key: "hasRequirements" as const },
    { name: "clarification.md", label: "Clarification", key: "hasClarification" as const },
    { name: "quality-audit.md", label: "Quality Audit", key: "hasQualityAudit" as const },
    { name: "roadmap.md", label: "Architecture Roadmap", key: "hasRoadmap" as const },
    { name: "actions.md", label: "Actions", key: "hasActions" as const },
    { name: "test-plan.md", label: "Test Plan", key: "hasTestPlan" as const },
    { name: "legacy-impact.md", label: "Legacy Impact", key: "hasLegacyImpact" as const },
    { name: "implementation-log.jsonl", label: "Implementation Log", key: "hasImplementationLog" as const },
  ];

  console.log(pc.bold("\n✦ ARTIFACT HEALTH"));

  for (const art of artifacts) {
    const exists = feature[art.key];
    const icon = exists ? pc.green("✅") : pc.dim("⬜");
    const extra = art.key === "hasRequirements" && feature.requirementsDoubts
      ? pc.yellow(` [${feature.requirementsDoubts} DOUBT]`)
      : art.key === "hasActions"
        ? pc.dim(` [${Math.round(feature.actionsCompletionRatio * 100)}%]`)
        : "";
    console.log(`  ${icon} ${art.label}${extra}`);
  }
}

async function showCanCodeNow(
  state: string,
  blockers: string[],
  _rootPath: string,
  inspection: any,
  _options: { diagnose?: boolean },
): Promise<void> {
  console.log(pc.bold("\n✦ CAN I ASK AI TO CODE NOW?"));

  const preCodeStates = [
    "no-project", "greenfield-idea", "greenfield-specified",
    "brownfield-unknown", "brownfield-discovered", "brownfield-specified",
    "feature-empty", "feature-requirements", "feature-clarification-needed",
    "feature-design", "feature-design-reviewed",
    "feature-test-plan", "feature-test-plan-ready",
    "feature-pre-code-audit",
  ];

  const duringCodeStates = [
    "feature-coding-ready", "feature-coding-in-progress",
    "feature-verification",
  ];

  const postCodeStates = [
    "feature-ci-verified", "feature-review",
    "feature-adversarial-review", "feature-done",
  ];

  if (preCodeStates.includes(state)) {
    if (blockers.length > 0) {
      console.log(`  ${pc.red("No.")} There are ${blockers.length} blocker(s) preventing progress.`);
      console.log(`  ${pc.dim("Resolve all blockers first, then run devflow next again.")}`);
    } else if (state === "feature-clarification-needed") {
      console.log(`  ${pc.red("No.")} Requirements have unresolved [DOUBT] markers.`);
      console.log(`  ${pc.dim("If you code now: you'll implement against ambiguous requirements.")}`);
      console.log(`  ${pc.dim("Resolve doubts in clarification.md, then re-run devflow next.")}`);
    } else if (state === "feature-pre-code-audit" || state === "feature-test-plan-ready") {
      console.log(`  ${pc.yellow("Almost.")} Pre-code artifacts are nearly complete.`);
      console.log(`  ${pc.dim("Complete the remaining gate checks, then code can begin.")}`);
    } else {
      const hasRequirements = inspection.activeFeature?.hasRequirements;
      if (!hasRequirements) {
        console.log(`  ${pc.red("No.")} You haven't written requirements yet.`);
        console.log(`  ${pc.dim("Run devflow feature new <name> to create the requirement workspace.")}`);
        console.log(`  ${pc.dim("AI needs clear requirements before writing code — otherwise: fragile output, theatrical confidence.")}`);
      } else {
        console.log(`  ${pc.yellow("Not yet.")} Complete the requirements → design → test-plan pipeline first.`);
        console.log(`  ${pc.dim("AI without spec produces code with conviction but no correctness guarantee.")}`);
      }
    }
  } else if (duringCodeStates.includes(state)) {
    console.log(`  ${pc.green("Yes.")} Pre-code artifacts are complete. You can now implement.`);
    console.log(`  ${pc.dim("Use devflow feature prompt <id> to generate a structured implementation prompt for your AI agent.")}`);
  } else if (postCodeStates.includes(state)) {
    console.log(`  ${pc.green("Code phase complete.")} Focus is now on verification and review.`);
  } else if (state === "drift-detected" || state === "blocked") {
    console.log(`  ${pc.red("No.")} System is in anomaly state: ${state}.`);
    console.log(`  ${pc.dim("Run devflow doctor to diagnose and fix the underlying issue.")}`);
  } else {
    console.log(`  ${pc.yellow("Unknown state.")} Run devflow status to understand your current position.`);
  }
}

async function showDiagnosticDetail(
  state: string,
  rootPath: string,
  inspection: any,
): Promise<void> {
  const feature = inspection.activeFeature;
  if (!feature) return;

  const featureDir = path.join(rootPath, "_devflow", "features", feature.id);

  console.log(pc.bold("\n✦ DIAGNOSTIC DETAILS"));

  // Check for [DOUBT] markers in requirements
  if (state === "feature-clarification-needed" || state === "feature-requirements") {
    const reqPath = path.join(featureDir, "requirements.md");
    if (await fileExists(reqPath)) {
      try {
        const content = await (await import("node:fs/promises")).readFile(reqPath, "utf-8");
        const doubtMatches = content.match(/\[DOUBT\][^\n]*/gi);
        if (doubtMatches && doubtMatches.length > 0) {
          console.log(pc.yellow("\n  [DOUBT] Markers Found:"));
          for (let i = 0; i < doubtMatches.length; i++) {
            console.log(`  ${pc.red("  ?")} ${doubtMatches[i]?.trim()}`);
            console.log(`    ${pc.dim("→ Resolve in: ")}${pc.bold(`_devflow/features/${feature.id}/clarification.md`)}`);
          }
        }
      } catch { /* ignore read errors */ }
    }
  }

  // Check for weak sections (generic content)
  if (state === "feature-requirements" || state === "feature-design") {
    const reqPath = path.join(featureDir, "requirements.md");
    if (await fileExists(reqPath)) {
      try {
        const content = await (await import("node:fs/promises")).readFile(reqPath, "utf-8");
        const sections = content.split(/^##\s+/gm).slice(1);
        const weakSections: string[] = [];

        for (const section of sections) {
          const lines = section.split("\n");
          const heading = lines[0]?.trim() || "";
          const realContent = lines.slice(1)
            .filter(l => !l.trim().startsWith("<!--") && !l.match(/^\s*-\s*$/) && l.trim().length > 0)
            .join(" ");

          if (realContent.length < 30 && heading && !heading.startsWith("Dúvidas")) {
            weakSections.push(heading);
          }
        }

        if (weakSections.length > 0) {
          console.log(pc.yellow("\n  Weak Sections (content < 30 chars):"));
          for (const s of weakSections) {
            console.log(`  ${pc.dim("  ⚡")} ${s}`);
            console.log(`    ${pc.dim("→ Suggested: Add specific, concrete content. Generic text will be rejected by quality checks (score < 70/100).")}`);
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Check for missing critical files by state
  if (state === "feature-design" || state === "feature-design-reviewed") {
    const roadmapPath = path.join(featureDir, "roadmap.md");
    if (!(await fileExists(roadmapPath))) {
      console.log(pc.red("\n  Missing: roadmap.md"));
      console.log(`  ${pc.dim("→ Create: manually edit or use the pedagogical template.")}`);
      console.log(`  ${pc.dim("→ File: ")}${pc.bold(`_devflow/features/${feature.id}/roadmap.md`)}`);
    }
  }

  if (state === "feature-test-plan" || state === "feature-test-plan-ready") {
    const testPlanPath = path.join(featureDir, "test-plan.md");
    if (!(await fileExists(testPlanPath))) {
      console.log(pc.red("\n  Missing: test-plan.md"));
      console.log(`  ${pc.dim("→ Create: manually edit or use the pedagogical template.")}`);
      console.log(`  ${pc.dim("→ File: ")}${pc.bold(`_devflow/features/${feature.id}/test-plan.md`)}`);
    }
  }

  // ── Parallel Analysis Diagnostic ──
  // Run a lightweight parallel analysis in --diagnose mode.
  // Shows findings per dimension if analysis finds issues.
  if (feature) {
    try {
      const spawner = new ParallelSpawner(rootPath);
      const analysisDimensions = resolveDimensions(["security", "architecture", "deps"]);
      const result = await spawner.spawnAgents(analysisDimensions, {
        timeoutPerAgent: 30_000, // faster timeout for diagnostic mode
      });

      if (result.totalFindings > 0) {
        console.log(pc.bold("\n  PARALLEL ANALYSIS (quick scan)"));

        for (const [dimName, findings] of Object.entries(result.byDimension)) {
          const criticalCount = findings.filter((f) => f.severity === "critical").length;
          const warningCount = findings.filter((f) => f.severity === "warning").length;

          if (criticalCount > 0 || warningCount > 0) {
            const color = criticalCount > 0 ? pc.red : pc.yellow;
            console.log(color(
              `  ${dimName}: ${findings.length} issues (${criticalCount} critical, ${warningCount} warning)`,
            ));
          }
        }

        // Show top 3 critical issues
        const criticalIssues = result.topIssues
          .filter((f) => f.severity === "critical")
          .slice(0, 3);

        for (const issue of criticalIssues) {
          console.log(pc.red(`    [${issue.file}:${issue.line}] ${issue.message}`));
        }
      }
    } catch {
      // Parallel analysis is best-effort in diagnostic mode
    }

    // ── Completeness Critic Diagnostic ──
    // After parallel analysis, run the critic to identify gaps
    // in dimensions not covered, sources not read, or claims not verified.
    try {
      const critic = new CompletenessCritic(rootPath, {
          maxIterations: 3,
          dryThreshold: 2,
          useSpawner: false,
        });

        // Re-run a lightweight analysis for the critic context
        // (separate from the parallel analysis above, which is scoped in a try block)
        const criticSpawner = new ParallelSpawner(rootPath);
        const criticDims = resolveDimensions(["security", "architecture", "deps"]);
        const criticResult = await criticSpawner.spawnAgents(criticDims, {
          timeoutPerAgent: 30_000,
        });

        const criticContext: AnalysisContext = {
          rootPath,
          analyzedDimensions: criticDims.map((d) => d.name),
          inspectedFiles: [],
          agentResults: Object.entries(criticResult.byDimension).flatMap(
            ([dim, findings]) => ({
              dimension: dim,
              findings,
              durationMs: 0,
              exitCode: 0,
            }),
          ),
        };

        const criticReport = await critic.fullCritique(criticContext);

        if (criticReport.hasGaps) {
          console.log(pc.bold("\n  COMPLETENESS CRITIC"));

          const dimGaps = criticReport.byType["dimension_not_covered"];
          if (dimGaps.length > 0) {
            console.log(pc.yellow(`  ${dimGaps.length} dimension(s) not covered:`));
            for (const g of dimGaps) {
              console.log(`    ${pc.dim("⚠")} ${g.description}`);
            }
          }

          const srcGaps = criticReport.byType["source_not_read"];
          if (srcGaps.length > 0) {
            console.log(pc.cyan(`  ${srcGaps.length} source gap(s):`));
            for (const g of srcGaps) {
              console.log(`    ${pc.dim("→")} ${g.description}`);
            }
          }

          const claimGaps = criticReport.byType["claim_not_verified"];
          if (claimGaps.length > 0) {
            console.log(pc.magenta(`  ${claimGaps.length} unverified claim(s):`));
            for (const g of claimGaps) {
              console.log(`    ${pc.dim("?")} ${g.description}`);
            }
          }

          console.log(pc.dim(`  (${criticReport.totalIterations} iteration(s), ${Math.round(criticReport.durationMs / 1000)}s)`));
        } else {
          console.log(pc.green("\n  COMPLETENESS CRITIC: No gaps found"));
        }
      } catch {
        // Critic is best-effort in diagnostic mode
      }
    }
  }
