import path from "node:path";
import { inspectProject } from "../project/inspector.js";
import { detectState } from "../engine/state-detector.js";
import { computeRecommendation } from "../engine/next-action.js";
import { fileExists } from "../utils/fs.js";
import pc from "picocolors";

export async function nextCommand(
  cwd: string,
  options: { json?: boolean; force?: boolean; diagnose?: boolean }
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const inspection = await inspectProject(rootPath);
  const stateResult = await detectState(inspection);
  const recommendation = computeRecommendation(stateResult, inspection);

  if (options.json) {
    console.log(JSON.stringify(recommendation, null, 2));
    return;
  }

  const action = recommendation.recommendedNextAction;
  const safetyIcon =
    action.safetyLevel === "safe"
      ? pc.green("🟢 safe")
      : action.safetyLevel === "caution"
        ? pc.yellow("🟡 caution")
        : pc.red("🔴 blocked");

  console.log(pc.bold("\nDevflow — Next Best Action\n"));
  console.log(pc.dim("═".repeat(55)));

  console.log(pc.bold("\nCurrent State: "), pc.cyan(recommendation.currentState));
  console.log(pc.bold("Confidence:    "), recommendation.confidence);

  // ── Primary Recommendation ──
  console.log(pc.bold("\n✦ PRIMARY RECOMMENDATION"));
  console.log(`  ${pc.bold(action.description)}`);
  console.log(`  ${pc.dim(action.why)}`);
  console.log();
  console.log(`  Safety:    ${safetyIcon}`);
  console.log(`  Workflow:  ${pc.dim(action.agentOrWorkflow)}`);

  // ── Artifact Health ──
  if (inspection.activeFeature) {
    await showArtifactHealth(rootPath, inspection);
  }

  // ── Blockers ──
  if (recommendation.blockers.length > 0) {
    console.log(pc.bold("\n✦ BLOCKERS"));
    for (const b of recommendation.blockers) {
      console.log(`  ${pc.red("🚫")} ${b}`);
    }
  }

  // ── Answer: Can I ask AI to code now? ──
  await showCanCodeNow(recommendation.currentState, recommendation.blockers, rootPath, inspection, options);

  // ── Specific file guidance ──
  if (options.diagnose) {
    await showDiagnosticDetail(recommendation.currentState, rootPath, inspection);
  }

  // ── Files referenced ──
  if (action.reads.length > 0) {
    console.log(pc.bold("\n✦ RELEVANT FILES"));
    for (const r of action.reads) {
      console.log(`  ${pc.dim("→")} ${r}`);
    }
  }

  // ── Alternatives ──
  if (recommendation.alternatives.length > 0) {
    console.log(pc.bold("\n✦ ALTERNATIVES"));
    for (let i = 0; i < recommendation.alternatives.length; i++) {
      const alt = recommendation.alternatives[i]!;
      console.log(`  ${pc.cyan(`${i + 1}.`)} ${alt.description}`);
      console.log(`     ${pc.dim(alt.whenToChoose)}`);
    }
  }

  if (!options.diagnose) {
    console.log(pc.dim("\n  Run with --diagnose for detailed artifact content analysis.\n"));
  } else {
    console.log();
  }
}

/**
 * Show artifact health for the active feature.
 */
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

/**
 * Answer the question: "Can I ask AI to code now or will I mess up?"
 */
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

/**
 * Detailed diagnostic for specific states when --diagnose flag is used.
 */
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
          // Find actual content (skip HTML comments and empty lines)
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
}
