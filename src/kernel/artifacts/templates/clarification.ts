import type { TemplatePayload } from "../../types/artifacts.js";

export function clarificationTemplate(payload: TemplatePayload): string {
  const { featureName, featureId, timestamp } = payload;
  return [
    `# Clarification: ${featureName} (${featureId})`,
    "",
    "## Doubt Resolution",
    "<!-- Each [DOUBT] from requirements.md is resolved here -->",
    "",
    "### Doubt 1: <!-- doubt topic -->",
    "**Question**: <!-- the specific question -->",
    "**Answer**: <!-- resolution -->",
    "**Impact**: <!-- how this resolution affects requirements -->",
    "",
    "### Doubt 2: <!-- doubt topic -->",
    "**Question**: <!-- the specific question -->",
    "**Answer**: <!-- resolution -->",
    "**Impact**: <!-- how this resolution affects requirements -->",
    "",
    "## Updated Assumptions",
    "- ",
    "",
    "## Decisions Made",
    "- ",
    "",
    "---",
    "",
    `*Resolved: ${timestamp}*`,
    "",
  ].join("\n");
}
