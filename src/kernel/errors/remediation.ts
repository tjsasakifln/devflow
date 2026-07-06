import pc from "picocolors";

/**
 * Structured remediation for a blocking failure.
 *
 * Every DoD check, guard, and doctor diagnostic returns one of these
 * so that the user sees not just WHAT failed but WHY it matters,
 * WHAT happens if ignored, and EXACTLY which command to run.
 */
export type Severity = "blocking" | "advisory" | "info";

export interface Remediation {
  /** Human-readable title for the failure (e.g. "Typecheck failed") */
  title: string;

  /** Why this check exists — what class of bugs it prevents */
  whyMatters: string;

  /** Concrete consequence if the user proceeds without fixing */
  impact: string;

  /** The suggested fix, as prose (e.g. "Run tsc --noEmit to see errors, then fix each one") */
  suggestedFix: string;

  /** A minimal concrete example the user can pattern-match against */
  minimalExample: string;

  /** Severity level */
  severity: Severity;

  /** Exact shell command the user can copy-paste to start fixing */
  copyableCommand?: string;
}

export interface RemediationResult {
  passed: boolean;
  remediation: Remediation;
}

/**
 * Render a single remediation block to the terminal.
 */
export function renderRemediation(r: Remediation): string {
  const lines: string[] = [];

  const icon =
    r.severity === "blocking"
      ? pc.red("🚫")
      : r.severity === "advisory"
        ? pc.yellow("⚠️ ")
        : pc.blue("ℹ️ ");

  lines.push(`\n  ${icon} ${pc.bold(r.title)}`);
  lines.push(pc.dim(`     Severity: ${r.severity}`));
  lines.push("");
  lines.push(`     ${pc.cyan("Why it matters:")} ${r.whyMatters}`);
  lines.push(`     ${pc.yellow("If ignored:")}     ${r.impact}`);
  lines.push(`     ${pc.green("Suggested fix:")}   ${r.suggestedFix}`);

  if (r.minimalExample) {
    lines.push(`     ${pc.dim("Example:")}`);
    for (const line of r.minimalExample.split("\n")) {
      lines.push(`       ${pc.dim(line)}`);
    }
  }

  if (r.copyableCommand) {
    lines.push("");
    lines.push(`     ${pc.bold("Run:")} ${pc.cyan(r.copyableCommand)}`);
  }

  return lines.join("\n");
}

/**
 * Render multiple remediations as a grouped failure block.
 */
export function renderRemediationList(
  remediations: Remediation[],
  title?: string,
): string {
  if (remediations.length === 0) return "";

  const lines: string[] = [];

  if (title) {
    lines.push(pc.bold(`\n${title}`));
  }

  const blocking = remediations.filter((r) => r.severity === "blocking");
  const advisory = remediations.filter((r) => r.severity === "advisory");
  const info = remediations.filter((r) => r.severity === "info");

  if (blocking.length > 0) {
    lines.push(pc.red(`\n  Blocking (${blocking.length}):`));
    for (const r of blocking) {
      lines.push(renderRemediation(r));
    }
  }

  if (advisory.length > 0) {
    lines.push(pc.yellow(`\n  Advisory (${advisory.length}):`));
    for (const r of advisory) {
      lines.push(renderRemediation(r));
    }
  }

  if (info.length > 0) {
    lines.push(pc.dim(`\n  Info (${info.length}):`));
    for (const r of info) {
      lines.push(renderRemediation(r));
    }
  }

  return lines.join("\n");
}

/**
 * Create a quick remediation for a missing file.
 */
export function missingFileRemediation(
  fileName: string,
  whyNeeded: string,
): Remediation {
  return {
    title: `${fileName} is missing`,
    whyMatters: whyNeeded,
    impact: `Without ${fileName}, Devflow cannot verify this phase. Subsequent checks will also fail.`,
    suggestedFix: `Create ${fileName} with the required content. Run "devflow next" to see the exact template.`,
    minimalExample: `# ${fileName}\n\n<!-- Fill in the required sections -->`,
    severity: "blocking",
  };
}

/**
 * Create a quick remediation for a tool not installed.
 */
export function toolNotInstalledRemediation(
  toolName: string,
  installCommand: string,
): Remediation {
  return {
    title: `${toolName} is not installed`,
    whyMatters: `${toolName} provides deterministic verification that cannot be done manually at scale.`,
    impact: `Without ${toolName}, this check cannot run. Code quality regressions may go undetected.`,
    suggestedFix: `Install ${toolName} and re-run the check.`,
    minimalExample: installCommand,
    severity: "advisory",
    copyableCommand: installCommand,
  };
}

/**
 * Create a quick remediation for a tool that ran but failed.
 */
export function toolFailedRemediation(
  toolName: string,
  command: string,
  detail: string,
  severity: Severity = "blocking",
): Remediation {
  return {
    title: `${toolName} check failed`,
    whyMatters: `${toolName} found issues that indicate quality problems.`,
    impact: `The reported issues could cause bugs, maintenance problems, or production incidents.`,
    suggestedFix: `Run '${command}' to see the full output, then fix each issue.`,
    minimalExample: detail,
    severity,
    copyableCommand: command,
  };
}
