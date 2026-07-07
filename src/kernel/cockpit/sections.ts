import type { StateDetectionResult } from "../types/state.js";
import type { ActionRecommendation } from "../types/engine.js";
import type { ProjectInspection } from "../types/project.js";

export function renderStateSection(state: string, confidence: string): string {
  return [
    "## Current State",
    "",
    `**${state}** (confidence: ${confidence})`,
    "",
  ].join("\n");
}

export function renderConfidenceSection(confidence: string): string {
  const icon =
    confidence === "high" ? "🟢" : confidence === "medium" ? "🟡" : "🔴";
  return [
    "## Confidence",
    "",
    `${icon} ${confidence.toUpperCase()}`,
    "",
  ].join("\n");
}

export function renderEvidenceSection(
  evidence: StateDetectionResult["evidence"]
): string {
  const lines = ["## Evidence", ""];

  if (evidence.length === 0) {
    lines.push("_No evidence collected_");
  } else {
    for (const e of evidence) {
      const source = e.source ? ` (${e.source})` : "";
      lines.push(
        `- ${e.key}: \`${String(e.value)}\` — ${e.confidence} confidence${source}`
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function renderActiveFeatureSection(
  inspection: ProjectInspection
): string {
  const lines = ["## Active Feature", ""];

  if (!inspection.activeFeature) {
    lines.push("_No active feature_");
    lines.push("");
    return lines.join("\n");
  }

  const f = inspection.activeFeature;
  lines.push(`**${f.id}**`);
  lines.push("");

  const artifacts = [
    ["requirements.md", f.hasRequirements],
    ["clarification.md", f.hasClarification],
    ["quality-audit.md", f.hasQualityAudit],
    ["roadmap.md", f.hasRoadmap],
    ["actions.md", f.hasActions],
    ["investigation.md", f.hasInvestigation],
    ["qa-report.md", f.hasQaReport],
    ["legacy-impact.md", f.hasLegacyImpact],
    ["regression-watch.md", f.hasRegressionWatch],
    ["implementation-log.jsonl", f.hasImplementationLog],
  ];

  for (const [name, present] of artifacts) {
    const icon = present ? "✅" : "⬜";
    lines.push(`- ${icon} ${name}`);
  }

  if (f.hasActions) {
    lines.push(
      `- Actions: ${Math.round(f.actionsCompletionRatio * 100)}% complete`
    );
  }

  lines.push("");
  return lines.join("\n");
}

export function renderKnownFactsSection(
  stateResult: StateDetectionResult
): string {
  const lines = ["## Known Facts", ""];

  if (stateResult.knownFacts.length === 0) {
    lines.push("_No known facts_");
  } else {
    for (const fact of stateResult.knownFacts) {
      lines.push(`- ${fact}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function renderAssumptionsSection(
  stateResult: StateDetectionResult
): string {
  const lines = ["## Assumptions", ""];

  if (stateResult.assumptions.length === 0) {
    lines.push("_No assumptions_");
  } else {
    for (const a of stateResult.assumptions) {
      lines.push(`- ⚠️ ${a}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function renderBlockersSection(
  stateResult: StateDetectionResult
): string {
  const lines = ["## Blockers", ""];

  if (stateResult.blockers.length === 0) {
    lines.push("_No blockers_");
  } else {
    for (const b of stateResult.blockers) {
      lines.push(`- 🚫 ${b}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function renderActionSection(
  recommendation: ActionRecommendation
): string {
  const action = recommendation.recommendedNextAction;
  const safetyIcon =
    action.safetyLevel === "safe"
      ? "🟢"
      : action.safetyLevel === "caution"
        ? "🟡"
        : "🔴";

  const lines = [
    "## Recommended Next Action",
    "",
    `**${action.id}** — ${safetyIcon} ${action.safetyLevel}`,
    "",
    action.description,
    "",
    "### Why This Action",
    "",
    action.why,
    "",
  ];

  if (action.reads.length > 0) {
    lines.push("### Reads");
    for (const r of action.reads) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }

  if (action.writes.length > 0) {
    lines.push("### Writes");
    for (const w of action.writes) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  lines.push("**Agent/Workflow**: " + action.agentOrWorkflow);
  lines.push("");

  return lines.join("\n");
}

export function renderAlternativesSection(
  recommendation: ActionRecommendation
): string {
  const lines = ["## Alternatives", ""];

  if (recommendation.alternatives.length === 0) {
    lines.push("_No alternatives available_");
  } else {
    for (let i = 0; i < recommendation.alternatives.length; i++) {
      const alt = recommendation.alternatives[i]!;
      lines.push(`${i + 1}. **${alt.description}**`);
      lines.push(`   _When_: ${alt.whenToChoose}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * MANDATORY CONTEXT for any AI agent before modifying code.
 * This section prevents weak-inference code generation.
 */
export function renderAgentContext(inspection: ProjectInspection): string {
  const stack = inspection.stackProfile;
  const lines = [
    "## Mandatory Context for Any Agent Before Modifying Code",
    "",
    "> **CRITICAL:** Read this section before making any changes to the codebase.",
    "",
  ];

  if (stack) {
    lines.push(`- **Language:** ${stack.language}`);
    if (stack.testCommand) lines.push(`- **Test framework:** \`${stack.testCommand}\``);
    if (stack.typeCheckCommand) lines.push(`- **Type checker:** \`${stack.typeCheckCommand}\``);
    if (stack.lintCommand) lines.push(`- **Linter:** \`${stack.lintCommand}\``);
    if (stack.packageManager) lines.push(`- **Package manager:** ${stack.packageManager}`);
    if (stack.hasCI) lines.push(`- **CI:** ${stack.ciProvider || "configured"}`);
  }

  lines.push(`- **Architecture style:** modular monolith with domain/infra separation`);
  lines.push(`- **Source directory:** ${stack?.sourceDir || "src"}`);
  lines.push(`- **Test directory:** ${stack?.testDir || "test"}`);

  if (inspection.activeFeature) {
    lines.push(`- **Active feature:** ${inspection.activeFeature.id}`);
  }

  lines.push("");
  lines.push("### Never Modify");
  lines.push("- `_devflow/` or `.devflow/` — managed by Devflow CLI");
  lines.push("- `DEVFLOW.md` or `CLAUDE.md` Devflow section — auto-generated");
  lines.push("- Constitution rules (C1-C12) without an ADR + exception annotation");
  lines.push("");
  lines.push("### Never Skip");
  lines.push("- `requirements.md` — must be complete before any code");
  lines.push("- `test-plan.md` — must exist before implementation");
  lines.push("- `implementation-log.jsonl` — must be updated after each action");
  lines.push("");
  lines.push("### Rules");
  lines.push("- Domain must NOT import from infrastructure");
  lines.push("- Functions ≤ 40 lines, files ≤ 400 lines, complexity ≤ 10");
  lines.push("- Coverage ≥ 80% lines, 100% domain branches");
  lines.push("- TODO/FIXME require ticket reference: `TODO(#N)`");
  lines.push("");

  return lines.join("\n");
}

/**
 * Stack-adaptive validation commands for the current project.
 */
export function renderValidationCommands(inspection: ProjectInspection): string {
  const stack = inspection.stackProfile;
  const lines = ["## Validation Commands", ""];

  if (stack?.testCommand) {
    lines.push(`- **Tests:** \`${stack.testCommand}\``);
  }
  if (stack?.typeCheckCommand) {
    lines.push(`- **Typecheck:** \`${stack.typeCheckCommand}\``);
  }
  if (stack?.lintCommand) {
    lines.push(`- **Lint:** \`${stack.lintCommand}\``);
  }

  if (!stack?.testCommand && !stack?.typeCheckCommand && !stack?.lintCommand) {
    lines.push("_Stack not detected — run `devflow init` to configure_");
    lines.push("- `npm test` (or equivalent for your stack)");
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Recommended AI prompt for the current state.
 * Tells the user exactly what to ask their AI agent.
 */
export function renderRecommendedPrompt(
  stateResult: { currentState: string },
  inspection: ProjectInspection,
): string {
  const state = stateResult.currentState;
  const feature = inspection.activeFeature;
  const lines = ["## Recommended AI Prompt", ""];

  if (state === "no-project" || state === "greenfield-idea") {
    lines.push("> \"Help me set up a new project with Devflow. I want to use [stack]. The first feature I need is [description].\"");
  } else if (state === "feature-empty" && feature) {
    lines.push(`> "Review the requirements template in _devflow/features/${feature.id}/requirements.md. Help me fill in each section with specific, concrete answers. Do NOT generate code yet.\"`);
  } else if (state === "feature-requirements" && feature) {
    lines.push(`> "Audit _devflow/features/${feature.id}/requirements.md for completeness. Flag any section that is generic or insufficient. Ask me clarification questions for weak sections. Do NOT generate code.\"`);
  } else if (state === "feature-clarification-needed" && feature) {
    lines.push(`> "I have [DOUBT] markers in _devflow/features/${feature.id}/requirements.md. Help me research and resolve each doubt. Write answers in clarification.md. Do NOT generate code.\"`);
  } else if (state === "feature-coding-ready" && feature) {
    lines.push(`> "Implement the feature described in _devflow/features/${feature.id}/requirements.md following the architecture in roadmap.md. Work through actions.md one at a time. Log each action in implementation-log.jsonl. Run tests after each action.\"`);
  } else if (state === "feature-verification" && feature) {
    lines.push(`> "Review the implementation log in _devflow/features/${feature.id}/implementation-log.jsonl. Verify each action against its acceptance criteria. Fix any failing tests or type errors.\"`);
  } else {
    lines.push(`> "Run \`devflow next\` to see the recommended action for current state: **${state}**.\"`);
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Actions the user should NOT do now — prevents premature steps.
 */
export function renderDontDoNow(
  stateResult: { currentState: string },
  _inspection: ProjectInspection,
): string {
  const state = stateResult.currentState;
  const lines = ["## Don't Do Now", ""];

  if (state === "feature-empty" || state === "feature-requirements") {
    lines.push("- Do NOT create test-plan.md until requirements pass quality audit");
    lines.push("- Do NOT start coding until all pre-code artifacts exist");
    lines.push("- Do NOT modify `.devflow/state.json` manually");
  } else if (state === "feature-clarification-needed") {
    lines.push("- Do NOT proceed to design until all [DOUBT] markers are resolved");
    lines.push("- Do NOT skip clarification — ambiguous requirements produce wrong code");
  } else if (state === "feature-coding-ready" || state === "feature-coding-in-progress") {
    lines.push("- Do NOT skip implementation log entries");
    lines.push("- Do NOT mark actions complete without evidence (test output, typecheck pass)");
  } else if (state === "feature-done") {
    lines.push("- Do NOT modify the feature without creating a new feature workspace");
    lines.push("- Do NOT delete audit logs — they are the evidence trail");
  } else {
    lines.push("- Do NOT skip phases — each exists for a reason");
    lines.push("- Do NOT edit `.devflow/` files manually");
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Pending artifacts with "why needed" explanation.
 */
export function renderPendingArtifacts(inspection: ProjectInspection): string {
  const lines = ["## Pending Artifacts", ""];
  const feature = inspection.activeFeature;

  if (!feature) {
    lines.push("_No active feature — create one with `devflow feature new <name>`_");
    lines.push("");
    return lines.join("\n");
  }

  const pending: Array<{ name: string; why: string }> = [];

  if (!feature.hasRequirements) {
    pending.push({ name: "requirements.md", why: "Defines WHAT the feature does. Without it, there is no spec." });
  }
  if (feature.requirementsDoubts) {
    pending.push({ name: "clarification.md", why: `${feature.requirementsDoubts} [DOUBT] markers block progress to feature-design.` });
  }
  if (!feature.hasQualityAudit) {
    pending.push({ name: "quality-audit.md", why: "Required before design phase — ensures requirements are specific enough." });
  }
  if (!feature.hasRoadmap) {
    pending.push({ name: "roadmap.md", why: "Defines HOW the feature will be implemented — architecture, patterns, layers." });
  }
  if (!feature.hasActions) {
    pending.push({ name: "actions.md", why: "Breaks implementation into atomic, verifiable, traceable steps." });
  }
  if (!feature.hasTestPlan) {
    pending.push({ name: "test-plan.md", why: "Ensures acceptance criteria have corresponding test cases." });
  }
  if (!feature.hasImplementationLog) {
    pending.push({ name: "implementation-log.jsonl", why: "Audit trail for every implementation action. Required for gatekeep." });
  }
  if (!feature.hasLegacyImpact) {
    pending.push({ name: "legacy-impact.md", why: "Documents impact on existing code. Required for brownfield projects." });
  }

  if (pending.length === 0) {
    lines.push("_All expected artifacts present_");
  } else {
    lines.push("| Artifact | Why Needed |");
    lines.push("|----------|------------|");
    for (const p of pending) {
      lines.push(`| ${p.name} | ${p.why} |`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Current instruction for AI agents — the first thing an agent should read.
 * Tells the agent whether it can code, what commands are allowed, and what's forbidden.
 */
export function renderCurrentInstruction(
  stateResult: { currentState: string },
  inspection: ProjectInspection,
): string {
  const state = stateResult.currentState;
  const lines = ["## Current Instruction for Agents", ""];

  // Coding-capable states
  const codingStates = [
    "feature-coding-ready",
    "feature-coding-in-progress",
    "feature-verification",
    "feature-ci-verified",
  ];

  const canCode = codingStates.includes(state);

  if (canCode) {
    lines.push("### ✅ CAN CODE");
    lines.push("");
    lines.push("The pre-code artifact pipeline is satisfied. You may implement code.");
    lines.push("");
    lines.push("**Allowed commands:**");
    lines.push("- Read and edit source files in the feature scope");
    lines.push("- Run validation commands (tests, lint, typecheck)");
    lines.push("- Update `implementation-log.jsonl` after each action");
    lines.push("- Mark actions as complete in `actions.md`");
    lines.push("");
    lines.push("**Forbidden commands:**");
    lines.push("- Do NOT modify `.devflow/` files");
    lines.push("- Do NOT modify `DEVFLOW.md`");
    lines.push("- Do NOT skip implementation log entries");
    lines.push("- Do NOT batch multiple actions without logging each one");
  } else if (state === "feature-done") {
    lines.push("### ✅ CODE COMPLETE");
    lines.push("");
    lines.push("This feature has been approved. No further code changes expected.");
    lines.push("");
    lines.push("**Allowed commands:**");
    lines.push("- Read-only inspection of feature artifacts");
    lines.push("");
    lines.push("**Forbidden commands:**");
    lines.push("- Do NOT modify feature code without creating a new feature workspace");
    lines.push("- Do NOT delete audit logs");
  } else if (state === "drift-detected" || state === "blocked") {
    lines.push("### 🚫 CANNOT CODE — Anomaly State");
    lines.push("");
    lines.push(`The system is in anomaly state: **${state}**`);
    lines.push("Run `devflow doctor` before any other action.");
    lines.push("");
    lines.push("**Forbidden commands:**");
    lines.push("- Do NOT write any code until the anomaly is resolved");
  } else {
    lines.push("### 🚫 CANNOT CODE — Pre-Code Phase");
    lines.push("");
    lines.push(`Current state: **${state}**`);
    lines.push("");
    lines.push("**Required reading before any action:**");
    if (inspection.activeFeature) {
      lines.push(`1. \`_devflow/features/${inspection.activeFeature.id}/requirements.md\``);
      lines.push("2. `DEVFLOW.md` — this file, especially Mandatory Context section");
    }
    lines.push("3. `.devflow/constitution.md` — rules C1-C12");
    lines.push("");
    lines.push("**Allowed commands:**");
    lines.push("- Help fill in missing artifact sections (requirements, roadmap, actions, test-plan)");
    lines.push("- Answer clarification questions about the feature");
    lines.push("- Run `devflow next --diagnose` to identify missing work");
    lines.push("- Run `devflow feature prompt <id>` for preview (NOT for implementation)");
    lines.push("");
    lines.push("**Forbidden commands:**");
    lines.push("- Do NOT write any implementation code");
    lines.push("- Do NOT create files outside `_devflow/features/<id>/`");
    lines.push("- Do NOT skip artifacts — each exists to prevent wrong code");
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Remaining risks — what's verified, inferred, and unknown.
 * Reduces false confidence in the process ritual.
 */
export function renderRemainingRisks(
  stateResult: { currentState: string; confidence: string },
  inspection: ProjectInspection,
): string {
  const lines = ["## Remaining Risks", ""];

  // Deterministic checks
  const deterministicVerified: string[] = [];
  const deterministicNotRun: string[] = [];

  if (inspection.stackProfile) {
    if (inspection.stackProfile.testCommand) {
      deterministicVerified.push(`Test framework configured: ${inspection.stackProfile.testFramework}`);
    } else {
      deterministicNotRun.push("No test framework detected — tests not verified");
    }
    if (inspection.stackProfile.typeCheckCommand) {
      deterministicVerified.push(`Type checker configured: ${inspection.stackProfile.typeChecker}`);
    } else if (inspection.stackProfile.language !== "javascript") {
      deterministicNotRun.push("No type checker — type safety not verified");
    }
    if (inspection.stackProfile.lintCommand) {
      deterministicVerified.push(`Linter configured: ${inspection.stackProfile.linter}`);
    } else {
      deterministicNotRun.push("No linter — code style not enforced");
    }
  }

  lines.push("### Deterministic Checks");
  lines.push("");
  if (deterministicVerified.length > 0) {
    for (const v of deterministicVerified) {
      lines.push(`- ✅ ${v}`);
    }
  }
  if (deterministicNotRun.length > 0) {
    for (const v of deterministicNotRun) {
      lines.push(`- ⚠️ ${v}`);
    }
  }
  lines.push("");

  // Inferred items
  lines.push("### Inferred (not verified)");
  lines.push("");
  lines.push(`- Project language: **${inspection.stackProfile?.language ?? "unknown"}** (detected from config files, not runtime)`);
  lines.push(`- Stack tools: inferred from config file presence, not execution`);
  lines.push(`- State: **${stateResult.currentState}** (confidence: ${stateResult.confidence})`);
  lines.push("");

  // Human judgment needed
  lines.push("### Requires Human Judgment");
  lines.push("");
  lines.push("- Architecture decisions (roadmap.md correctness)");
  lines.push("- Requirements completeness (are all edge cases covered?)");
  lines.push("- Test plan adequacy (does it test the right things?)");
  lines.push("- Business rule correctness (does the feature do what users need?)");
  lines.push("- Constitution C12: Independent review (unless solo-hardened mode)");
  lines.push("");

  // Unknown
  lines.push("### Unknown");
  lines.push("");
  lines.push("- Production behavior under real load");
  lines.push("- Security vulnerabilities not caught by static analysis");
  lines.push("- Integration failures with external services");
  lines.push("- Data migration issues in real environments");
  lines.push("");

  return lines.join("\n");
}

export function renderSafetyNotes(
  recommendation: ActionRecommendation
): string {
  const lines = ["## Safety Notes", ""];
  const safetyLevel = recommendation.recommendedNextAction.safetyLevel;

  if (safetyLevel === "safe") {
    lines.push("- ✅ This action is safe to execute");
  } else if (safetyLevel === "caution") {
    lines.push("- ⚠️ Proceed with caution — review the evidence and assumptions");
  } else {
    lines.push("- 🔴 This action is blocked — resolve blockers first");
  }

  if (recommendation.blockers.length > 0) {
    lines.push("- Resolve all blockers before proceeding");
  }

  if (recommendation.confidence === "low") {
    lines.push("- Low confidence — verify state detection before acting");
  }

  lines.push("- Run `devflow doctor` if state seems incorrect");
  lines.push("");

  return lines.join("\n");
}
