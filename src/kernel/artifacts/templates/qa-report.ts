import type { TemplatePayload } from "../../types/artifacts.js";

export function qaReportTemplate(payload: TemplatePayload): string {
  const { featureName, timestamp } = payload;
  return [
    `# QA Report: ${featureName}`,
    "",
    "## Actions Verified",
    "| Action ID | Status | Notes |",
    "|-----------|--------|-------|",
    "| <!-- id --> | PASS / FAIL / SKIP |  |",
    "",
    "## Test Results",
    "- Unit tests: <!-- count --> passed, <!-- count --> failed",
    "- Integration tests: <!-- count --> passed, <!-- count --> failed",
    "",
    "## Acceptance Criteria Verification",
    "- [ ] <!-- criterion 1 met -->",
    "- [ ] <!-- criterion 2 met -->",
    "- [ ] <!-- criterion 3 met -->",
    "",
    "## Issue List",
    "| ID | Description | Severity | Status |",
    "|----|-------------|----------|--------|",
    "| <!-- id --> | <!-- description --> | low / medium / high | open / fixed |",
    "",
    "## Verdict",
    "<!-- PASS | PASS-WITH-ISSUES | FAIL -->",
    "**Verdict**: PENDING",
    "",
    "---",
    "",
    `*Reported: ${timestamp}*`,
    "",
  ].join("\n");
}
