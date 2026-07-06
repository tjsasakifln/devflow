import type { TemplatePayload } from "../../types/artifacts.js";

export function dataDeltaTemplate(payload: TemplatePayload): string {
  const { featureName, timestamp } = payload;
  return [
    `# Data Delta: ${featureName}`,
    "",
    "## Schema Changes",
    "### New Entities",
    "<!-- New tables, collections, or data structures -->",
    "",
    "### Modified Entities",
    "<!-- Changes to existing tables, collections, or data structures -->",
    "",
    "### Removed Entities",
    "<!-- Deprecated tables, collections, or data structures -->",
    "",
    "## Migration Scripts",
    "<!-- Paths to migration scripts -->",
    "- ",
    "",
    "## Data Validation",
    "<!-- How to verify data integrity after migration -->",
    "- [ ] <!-- validation step -->",
    "",
    "---",
    "",
    `*Analyzed: ${timestamp}*`,
    "",
  ].join("\n");
}
