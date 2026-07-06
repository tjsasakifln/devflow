import type { TemplatePayload } from "../../types/artifacts.js";

export function legacyImpactTemplate(payload: TemplatePayload): string {
  const { featureName, timestamp } = payload;
  return [
    `# Legacy Impact Assessment: ${featureName}`,
    "",
    "## Affected Existing Code",
    "| Module | Impact | Risk |",
    "|--------|--------|------|",
    "| `path/to/module` | <!-- description of impact --> | low / medium / high |",
    "",
    "## Migration Strategy",
    "<!-- If code needs to change, how to migrate safely -->",
    "- ",
    "",
    "## Backward Compatibility",
    "- [ ] No breaking changes",
    "- [ ] Deprecation path documented",
    "- [ ] Migration guide available",
    "",
    "## Rollback Plan",
    "<!-- Specific steps to roll back this feature -->",
    "1. ",
    "2. ",
    "3. ",
    "",
    "## Regressions Risk",
    "<!-- What existing behavior might break -->",
    "| Risk Area | Likelihood | Detection Method |",
    "|-----------|------------|------------------|",
    "| <!-- area --> | low / medium / high | <!-- how to detect --> |",
    "",
    "---",
    "",
    `*Assessed: ${timestamp}*`,
    "",
  ].join("\n");
}
