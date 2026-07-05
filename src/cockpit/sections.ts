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
