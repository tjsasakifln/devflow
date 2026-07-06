import type { TemplatePayload } from "../../types/artifacts.js";

export function qualityAuditTemplate(payload: TemplatePayload): string {
  const { featureName, timestamp } = payload;
  return [
    `# Quality Audit: ${featureName}`,
    "",
    "## Requirements Completeness",
    "- [ ] All sections filled in requirements.md",
    "- [ ] Success criteria are measurable",
    "- [ ] Out of scope is defined",
    "- [ ] Dependencies documented",
    "",
    "## Clarity Check",
    "- [ ] No [DOUBT] markers remain",
    "- [ ] Each requirement is unambiguous",
    "- [ ] Edge cases considered",
    "",
    "## Consistency Check",
    "- [ ] No contradictory requirements",
    "- [ ] Achievable within constraints",
    "- [ ] No overlap with existing features",
    "",
    "## Audit Verdict",
    "<!-- PASS | PASS-WITH-NOTES | FAIL -->",
    "**Verdict**: PENDING",
    "",
    "## Notes",
    "<!-- Specific issues found -->",
    "- ",
    "",
    "---",
    "",
    `*Audited: ${timestamp}*`,
    "",
  ].join("\n");
}
