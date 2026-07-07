import path from "node:path";
import { ArtifactManager } from "../kernel/artifacts/manager.js";
import { inspectProject } from "../adapters/project/inspector.js";
import { detectState } from "../kernel/state/detector.js";
import {
  missingFileRemediation,
  renderRemediationList,
  type Remediation,
} from "../kernel/errors/remediation.js";
import { logger } from "../kernel/utils/logger.js";
import pc from "picocolors";

export interface FeaturePromptOptions {
  copy?: boolean;
  output?: string;
  save?: boolean;
}

/**
 * Artifacts that MUST exist before generating an implementation prompt.
 * Each entry maps to the file name and a human-readable label.
 */
const REQUIRED_ARTIFACTS: Array<{ file: string; label: string; why: string }> = [
  {
    file: "requirements.md",
    label: "Requirements",
    why: "Defines what to build. Without it, the agent has no functional target.",
  },
  {
    file: "roadmap.md",
    label: "Architecture Roadmap",
    why: "Defines how to structure the code. Without it, the agent may violate architecture constraints.",
  },
  {
    file: "actions.md",
    label: "Actions",
    why: "Defines the atomic implementation steps. Without it, the agent has no task breakdown.",
  },
  {
    file: "test-plan.md",
    label: "Test Plan",
    why: "Defines acceptance criteria and test strategy. Without it, the agent cannot verify correctness.",
  },
];

/**
 * devflow feature prompt <id>
 *
 * Generates a structured implementation prompt for Claude Code, Cursor,
 * or equivalent AI agents. Refuses to generate if required artifacts are missing.
 */
export async function featurePromptCommand(
  cwd: string,
  featureId: string,
  options: FeaturePromptOptions = {},
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const manager = new ArtifactManager(rootPath);

  // ── Validate feature exists ──
  const activeFeature = await manager.readActiveFeature();
  const effectiveId = featureId || activeFeature?.featureId;

  if (!effectiveId) {
    console.log(pc.red("No active feature found."));
    console.log(pc.dim("Run: devflow feature new <name>"));
    return;
  }

  const resolvedId = featureId || effectiveId;

  // Check feature directory exists
  const { fileExists } = await import("../kernel/utils/fs.js");
  const featureDir = path.join(manager.paths.featureDir, resolvedId);
  if (!(await fileExists(featureDir))) {
    console.log(pc.red(`Feature '${resolvedId}' not found.`));
    console.log(pc.dim(`Directory missing: ${featureDir}`));
    console.log(pc.dim("Run: devflow feature new <name>"));
    return;
  }

  // ── Check required artifacts ──
  const missing: Remediation[] = [];

  for (const artifact of REQUIRED_ARTIFACTS) {
    const content = await manager.readFeatureFile(resolvedId, artifact.file);
    if (!content || content.trim().length === 0) {
      missing.push(missingFileRemediation(artifact.file, artifact.why));
    }
  }

  if (missing.length > 0) {
    console.log(
      pc.red(
        `\n🚫 Cannot generate implementation prompt — ${missing.length} required artifact(s) missing.\n`,
      ),
    );
    console.log(
      renderRemediationList(
        missing,
        "Missing Artifacts",
      ),
    );
    console.log(
      pc.dim(
        "\nEach artifact exists for a reason. Generating a prompt without them\n" +
          "would produce code with conviction but no correctness guarantee.\n",
      ),
    );
    console.log(
      `Run ${pc.bold("devflow next")} to see what to create next.\n`,
    );
    return;
  }

  // ── Read all artifacts ──
  const requirements = (await manager.readFeatureFile(resolvedId, "requirements.md")) ?? "";
  const roadmap = (await manager.readFeatureFile(resolvedId, "roadmap.md")) ?? "";
  const actions = (await manager.readFeatureFile(resolvedId, "actions.md")) ?? "";
  const testPlan = (await manager.readFeatureFile(resolvedId, "test-plan.md")) ?? "";
  const legacyImpact = await manager.readFeatureFile(resolvedId, "legacy-impact.md");
  const implementationLog = await manager.readFeatureFile(resolvedId, "implementation-log.jsonl");

  // ── Inspect project for stack profile and state ──
  const inspection = await inspectProject(rootPath);
  const stateResult = await detectState(inspection);
  const stack = inspection.stackProfile;

  if (!stack) {
    console.log(pc.yellow("⚠️  Stack profile not detected. Using default (unknown)."));
  }

  const safeStack = stack ?? {
    language: "unknown" as const,
    testFramework: null,
    testCommand: null,
    linter: null,
    lintCommand: null,
    typeChecker: null,
    typeCheckCommand: null,
    formatter: null,
    packageManager: null,
    hasDocker: false,
    hasCI: false,
    ciProvider: null,
    sourceDir: "src",
    testDir: "test",
  };

  // ── Warn if state < feature-coding-ready ──
  const preCodeStates = [
    "feature-empty",
    "feature-requirements",
    "feature-clarification-needed",
    "feature-design",
    "feature-design-reviewed",
    "feature-test-plan",
    "feature-test-plan-ready",
    "feature-pre-code-audit",
  ];

  if (preCodeStates.includes(stateResult.currentState)) {
    console.log(
      pc.yellow(
        `\n⚠️  Current state: ${stateResult.currentState} — not yet feature-coding-ready.\n`,
      ),
    );
    console.log(
      pc.dim(
        "Implementation prompt generated anyway for preview/review purposes.\n" +
          "Do NOT start coding until all pre-code gates pass.\n" +
          "Run devflow next to see remaining work.\n",
      ),
    );
  }

  // ── Generate the prompt ──
  const prompt = buildPrompt({
    featureId: resolvedId,
    state: stateResult.currentState,
    requirements,
    roadmap,
    actions,
    testPlan,
    legacyImpact,
    implementationLog,
    stack: safeStack,
    cwd: rootPath,
  });

  // ── Output ──
  const outputPath = options.output ?? null;
  const saveToFeature = options.save ?? false;

  if (saveToFeature) {
    const promptPath = path.join(featureDir, "implementation-prompt.md");
    const fs = await import("node:fs/promises");
    await fs.writeFile(promptPath, prompt, "utf-8");
    console.log(pc.green(`\n✅ Implementation prompt saved to:`));
    console.log(pc.dim(`   ${promptPath}`));
  }

  if (outputPath) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(path.resolve(outputPath), prompt, "utf-8");
    console.log(pc.green(`\n✅ Implementation prompt written to: ${outputPath}`));
  }

  if (options.copy) {
    try {
      const { execSync } = await import("node:child_process");
      // Try platform-specific clipboard
      if (process.platform === "linux") {
        execSync("xclip -selection clipboard", { input: prompt, encoding: "utf-8" });
      } else if (process.platform === "darwin") {
        execSync("pbcopy", { input: prompt, encoding: "utf-8" });
      } else if (process.platform === "win32") {
        execSync("clip", { input: prompt, encoding: "utf-8" });
      }
      console.log(pc.green("📋 Prompt copied to clipboard."));
    } catch {
      console.log(pc.yellow("⚠️  Could not copy to clipboard (xclip/pbcopy/clip not available)."));
    }
  }

  // Default: print to stdout
  if (!saveToFeature && !outputPath) {
    console.log(pc.bold("\n══════════════════════════════════════════════════════════════"));
    console.log(pc.bold("  AI Implementation Prompt"));
    console.log(pc.bold("══════════════════════════════════════════════════════════════\n"));
    console.log(prompt);
    console.log(pc.dim("\n─── End of Prompt ───\n"));
    console.log(pc.dim("Tip: Use --save to write this to the feature directory."));
    console.log(pc.dim("     Use --copy to copy to clipboard."));
    console.log(pc.dim("     Use --output <file> to write to a specific file.\n"));
  }

  // Log generation
  logger.info(`[PROMPT] Generated implementation prompt for feature ${resolvedId}`);
}

// ── Prompt Builder ──

interface PromptContext {
  featureId: string;
  state: string;
  requirements: string;
  roadmap: string;
  actions: string;
  testPlan: string;
  legacyImpact: string | null;
  implementationLog: string | null;
  stack: import("../kernel/detection/stack.js").StackProfile;
  cwd: string;
}

function buildPrompt(ctx: PromptContext): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Implementation Prompt: ${ctx.featureId}`);
  lines.push("");
  lines.push(`> **Generated by Devflow** — structured prompt for AI-assisted implementation.`);
  lines.push(`> **Current state:** ${ctx.state}`);
  lines.push(`> **Stack:** ${ctx.stack.language}${ctx.stack.packageManager ? ` (${ctx.stack.packageManager})` : ""}`);
  lines.push("");

  // ── 1. Context & Goal ──
  lines.push("## 1. Context & Goal");
  lines.push("");
  lines.push("You are implementing this feature in a Devflow-governed project.");
  lines.push("Read this entire prompt before writing any code.");
  lines.push("");
  lines.push(extractSection(ctx.requirements, "Descrição Funcional") || "_See requirements.md for functional description._");
  lines.push("");

  // ── 2. Negative Scope ──
  const negScope = extractSection(ctx.requirements, "Escopo Negativo");
  if (negScope && !negScope.includes("<!--")) {
    lines.push("## 2. Negative Scope (Do NOT Build)");
    lines.push("");
    lines.push(negScope);
    lines.push("");
  }

  // ── 3. Architecture ──
  lines.push("## 3. Architecture Constraints");
  lines.push("");
  lines.push("Follow the architecture decisions in roadmap.md. Key points:");
  lines.push("");
  const archSummary = extractSection(ctx.roadmap, "Desenho Arquitetural");
  if (archSummary) {
    lines.push(archSummary);
  } else {
    lines.push("_See roadmap.md for full architecture._");
  }
  lines.push("");

  // Layer info
  const layers = extractSection(ctx.roadmap, "Camadas Envolvidas");
  if (layers) {
    lines.push("### Layers");
    lines.push("");
    lines.push(layers);
    lines.push("");
  }

  // ── 4. Actions (Task Breakdown) ──
  lines.push("## 4. Implementation Actions");
  lines.push("");
  lines.push("**CRITICAL: Work through these actions ONE AT A TIME.**");
  lines.push("Do NOT implement multiple actions in a single pass.");
  lines.push("After each action: update implementation-log.jsonl, run tests, verify.");
  lines.push("");

  // Extract action items from actions.md
  const actionItems = extractActionItems(ctx.actions);
  if (actionItems.length > 0) {
    for (const item of actionItems) {
      lines.push(`- [ ] ${item}`);
    }
  } else {
    lines.push("_Extracted from actions.md:_");
    lines.push("");
    // Truncate raw actions.md to avoid overwhelming the prompt
    const truncated = ctx.actions.length > 3000
      ? ctx.actions.slice(0, 3000) + "\n\n_(truncated — see full actions.md)_"
      : ctx.actions;
    lines.push("```");
    lines.push(truncated);
    lines.push("```");
  }
  lines.push("");

  // ── 5. Acceptance Criteria ──
  lines.push("## 5. Acceptance Criteria");
  lines.push("");
  const acceptance = extractSection(ctx.requirements, "Critérios de Aceitação");
  if (acceptance) {
    lines.push(acceptance);
  } else {
    lines.push("_See requirements.md for acceptance criteria._");
  }
  lines.push("");
  lines.push("Every action must satisfy at least one acceptance criterion.");
  lines.push("");

  // ── 6. Test Plan ──
  lines.push("## 6. Test Strategy");
  lines.push("");

  const testStrategy = extractSection(ctx.testPlan, "Test Strategy");
  if (testStrategy) {
    lines.push(testStrategy);
    lines.push("");
  }

  // Extract test commands
  const verificationCommands = extractSection(ctx.testPlan, "Verification Commands");
  if (verificationCommands) {
    lines.push("### Verification Commands");
    lines.push("");
    lines.push(verificationCommands);
    lines.push("");
  }

  lines.push("### Coverage Targets");
  lines.push("");
  lines.push("- Lines: ≥ 80%");
  lines.push("- Branches: ≥ 80%");
  lines.push("- Functions: ≥ 80%");
  lines.push("- Domain branches: 100%");
  lines.push("");

  // ── 7. Files ──
  lines.push("## 7. Files");
  lines.push("");

  lines.push("### Files You MAY Modify");
  lines.push("");
  lines.push(`- Source directory: \`${ctx.stack.sourceDir}/\``);
  lines.push(`- Test directory: \`${ctx.stack.testDir}/\``);
  lines.push(`- Feature directory: \`_devflow/features/${ctx.featureId}/\``);
  if (ctx.legacyImpact) {
    lines.push("- See legacy-impact.md for affected existing files");
  }
  lines.push("");

  lines.push("### Files You MUST NOT Modify");
  lines.push("");
  lines.push("- `.devflow/` — configuration and state (managed by Devflow)");
  lines.push("- `DEVFLOW.md` — auto-generated cockpit");
  lines.push("- `_devflow/specs/` — global specifications");
  lines.push("- Any file outside the feature scope without documenting it in legacy-impact.md");
  lines.push("");

  // ── 8. Validation Commands ──
  lines.push("## 8. Validation Commands (Run After Each Action)");
  lines.push("");

  if (ctx.stack.testCommand) {
    lines.push(`**Tests:** \`${ctx.stack.testCommand}\``);
  }
  if (ctx.stack.typeCheckCommand) {
    lines.push(`**TypeCheck:** \`${ctx.stack.typeCheckCommand}\``);
  }
  if (ctx.stack.lintCommand) {
    lines.push(`**Lint:** \`${ctx.stack.lintCommand}\``);
  }
  if (!ctx.stack.testCommand && !ctx.stack.typeCheckCommand && !ctx.stack.lintCommand) {
    lines.push(`_No automated validation commands detected for stack: ${ctx.stack.language}_`);
    lines.push("_Configure validation commands in .devflow/config.json_");
  }
  lines.push("");

  // ── 9. Coding Rules ──
  lines.push("## 9. Mandatory Coding Rules");
  lines.push("");
  lines.push("1. **Action-by-action:** Implement ONE action at a time. Do not batch.");
  lines.push("2. **Log every action:** After each action, append to `implementation-log.jsonl`:");
  lines.push("   ```json");
  lines.push('   {"timestamp":"<ISO>","actionId":"T001","action":"<summary>","filesChanged":["a.ts","b.ts"],"status":"completed","notes":"<test output / evidence>"}');
  lines.push("   ```");
  lines.push("3. **Test after each action:** Run the stack validation commands. Red tests = stop and fix.");
  lines.push("4. **Never skip tests:** Every action must have test evidence.");
  lines.push("5. **Respect the constitution:** Check `.devflow/constitution.md` for rules C1-C12.");
  lines.push("6. **No silent refactors:** If you touch a file not in the action, document it in legacy-impact.md.");
  lines.push("7. **Typecheck before commit:** Zero type errors allowed.");
  lines.push("8. **Update actions.md:** Mark completed actions with `[X]`.");
  lines.push("");

  // ── 10. Pre-Coding Checklist ──
  lines.push("## 10. Pre-Coding Checklist");
  lines.push("");
  lines.push("Before writing the first line of code, confirm:");
  lines.push("");
  lines.push(`- [ ] Read the full requirements.md in _devflow/features/${ctx.featureId}/`);
  lines.push(`- [ ] Read the full roadmap.md (architecture) in _devflow/features/${ctx.featureId}/`);
  lines.push(`- [ ] Read the full actions.md (task breakdown) in _devflow/features/${ctx.featureId}/`);
  lines.push(`- [ ] Read the full test-plan.md in _devflow/features/${ctx.featureId}/`);
  if (ctx.legacyImpact) {
    lines.push(`- [ ] Read legacy-impact.md in _devflow/features/${ctx.featureId}/`);
  }
  lines.push("- [ ] Read DEVFLOW.md — Mandatory Context for Any Agent Before Modifying Code");
  lines.push("- [ ] Read .devflow/constitution.md — rules C1-C12");
  lines.push("- [ ] Confirm current state is feature-coding-ready or later");
  lines.push("");

  // ── 11. Error Cases & Edge Cases ──
  const errorCases = extractSection(ctx.requirements, "Casos de Erro");
  const edgeCases = extractSection(ctx.requirements, "Casos Extremos");

  if (errorCases || edgeCases) {
    lines.push("## 11. Error & Edge Cases to Handle");
    lines.push("");
    if (errorCases && !errorCases.includes("<!--")) {
      lines.push("### Error Cases");
      lines.push("");
      lines.push(errorCases);
      lines.push("");
    }
    if (edgeCases && !edgeCases.includes("<!--")) {
      lines.push("### Edge Cases");
      lines.push("");
      lines.push(edgeCases);
      lines.push("");
    }
  }

  // ── 12. Doubts ──
  const doubts = extractDoubtResolutions(ctx.requirements);
  if (doubts.length > 0) {
    lines.push("## 12. Resolved Doubts");
    lines.push("");
    for (const d of doubts) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`*Prompt generated by Devflow for feature ${ctx.featureId} in state ${ctx.state}.*`);
  lines.push(`*Stack: ${ctx.stack.language} | Tests: ${ctx.stack.testCommand ?? "none"} | Lint: ${ctx.stack.lintCommand ?? "none"} | TypeCheck: ${ctx.stack.typeCheckCommand ?? "none"}*`);
  lines.push("");

  return lines.join("\n");
}

// ── Helpers ──

/**
 * Extract a section from markdown content by heading name.
 * Returns content between the heading and the next heading of same or higher level.
 */
function extractSection(markdown: string, headingName: string): string | null {
  // Find the heading
  const headingRegex = new RegExp(
    `^#{2,4}\\s+${escapeRegex(headingName)}\\s*$`,
    "m",
  );
  const match = headingRegex.exec(markdown);
  if (!match) return null;

  const startIndex = match.index + match[0].length;
  const remaining = markdown.slice(startIndex);

  // Find next heading of same or higher level
  const nextHeadingRegex = /^#{2,4}\s+/m;
  const nextMatch = nextHeadingRegex.exec(remaining);

  const content = nextMatch
    ? remaining.slice(0, nextMatch.index)
    : remaining;

  return content.trim() || null;
}

/**
 * Extract action items from actions.md content.
 * Looks for T001/T002 pattern lines and checkbox items.
 */
function extractActionItems(actionsMd: string): string[] {
  const items: string[] = [];

  // Match T001/T002 pattern lines
  const taskRegex = /^(?:###\s+)?(T\d{3}[:\s-].+)$/gm;
  let match;
  while ((match = taskRegex.exec(actionsMd)) !== null) {
    if (match[1]) {
      items.push(match[1].trim());
    }
  }

  // If no T-entries found, match checkbox items
  if (items.length === 0) {
    const checkboxRegex = /^-\s*\[([ xX])\]\s+(.+)$/gm;
    while ((match = checkboxRegex.exec(actionsMd)) !== null) {
      if (match[2] && match[1]) {
        const checked = match[1].toLowerCase() === "x" ? "[X]" : "[ ]";
        items.push(`${checked} ${match[2].trim()}`);
      }
    }
  }

  return items;
}

/**
 * Extract resolved doubts from requirements.md.
 * Returns only non-[DOUBT] items (resolved ones without the marker).
 */
function extractDoubtResolutions(requirementsMd: string): string[] {
  const doubtsSection = extractSection(requirementsMd, "Dúvidas");
  if (!doubtsSection) return [];

  const resolutions: string[] = [];
  const lines = doubtsSection.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip [DOUBT] markers — those are unresolved
    if (trimmed.includes("[DOUBT]")) continue;
    // Skip empty, HTML comments, and the section placeholder
    if (!trimmed || trimmed.startsWith("<!--") || trimmed.startsWith("*")) continue;
    // Collect resolved items (checkbox checked or plain text)
    const match = /^-\s*\[([ xX])\]\s+(.+)$/.exec(trimmed);
    if (match && match[1]?.toLowerCase() === "x") {
      resolutions.push(match[2]?.trim() ?? trimmed);
    } else if (trimmed.startsWith("-")) {
      resolutions.push(trimmed.replace(/^-\s*/, ""));
    }
  }

  return resolutions;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
