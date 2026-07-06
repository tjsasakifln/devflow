import type { TemplatePayload } from "../../types/artifacts.js";

export function regressionWatchTemplate(payload: TemplatePayload): string {
  const { featureName, timestamp } = payload;
  return [
    `# Regression Watch: ${featureName}`,
    "",
    "## Areas to Monitor",
    "| Area | Watch For | Duration |",
    "|------|-----------|----------|",
    "| <!-- area name --> | <!-- what to look for --> | <!-- monitoring period --> |",
    "",
    "## Existing Tests That Cover Adjacent Areas",
    "| Test File | Coverage |",
    "|-----------|----------|",
    "| `test/path.test.ts` | <!-- what it covers --> |",
    "",
    "## Manual Checkpoints",
    "- [ ] <!-- checkpoint 1: what to verify -->",
    "- [ ] <!-- checkpoint 2: what to verify -->",
    "",
    "---",
    "",
    `*Created: ${timestamp}*`,
    "",
  ].join("\n");
}
