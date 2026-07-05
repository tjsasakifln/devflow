import type { GuardCheck } from "../types/guards.js";

export function buildRefusalMessage(
  failedChecks: GuardCheck[],
  context?: string
): string {
  const lines = [
    "## Action Blocked",
    "",
    context ? `${context}\n` : "",
    "The following checks failed:",
    "",
    ...failedChecks.map(
      (c, i) =>
        `${i + 1}. **${c.checkId}** — ${c.description}\n   ${c.reason}`
    ),
    "",
    "### How to Resolve",
    "- Run `devflow next` for the recommended next action",
    "- Run `devflow status` to review the full project state",
    "- Run `devflow doctor` to diagnose and auto-fix issues",
    "",
  ];

  return lines.join("\n");
}

export function formatGuardResult(
  check: GuardCheck,
  index: number
): string {
  const icon = check.passed ? "✅" : "❌";
  return `${icon} ${index}. ${check.description}: ${check.reason}`;
}
