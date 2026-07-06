import type { TemplatePayload } from "../../types/artifacts.js";

export function investigationTemplate(payload: TemplatePayload): string {
  const { featureName, timestamp } = payload;
  return [
    `# Investigation: ${featureName}`,
    "",
    "## Current State Map",
    "<!-- How the relevant code is structured today -->",
    "",
    "## Key Files",
    "| File | Purpose | Risk Level |",
    "|------|---------|------------|",
    "| `path/to/file` | <!-- purpose --> | low / medium / high |",
    "",
    "## Data Flow",
    "<!-- How data moves through the affected area -->",
    "```",
    "<!-- data flow diagram or description -->",
    "```",
    "",
    "## Observations",
    "- <!-- important finding -->",
    "- <!-- performance concern -->",
    "- <!-- code quality issue -->",
    "",
    "## Recommendations",
    "- <!-- what to change, why -->",
    "- <!-- what to keep, why -->",
    "",
    "---",
    "",
    `*Investigated: ${timestamp}*`,
    "",
  ].join("\n");
}
