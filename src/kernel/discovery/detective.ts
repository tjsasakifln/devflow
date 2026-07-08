/**
 * Discovery Phase 3: Detective
 *
 * Business rule extraction, retroactive ADRs via git log, state machine detection.
 */

import path from "node:path";
import { execSync } from "node:child_process";
import { safeReadFile } from "../utils/fs.js";
import type { StackProfile } from "../detection/stack.js";

export interface BusinessRule {
  pattern: string;
  examples: string[];
  file: string;
  description: string;
}

export interface ADREntry {
  date: string;
  author: string;
  message: string;
  type: string;
}

export interface StateMachine {
  name: string;
  file: string;
  states: string[];
}

export interface DetectiveReport {
  businessRules: BusinessRule[];
  adrs: ADREntry[];
  stateMachines: StateMachine[];
  markdown: string;
}

export async function runDetective(rootPath: string, stack: StackProfile): Promise<DetectiveReport> {
  const sourceDir = stack.sourceDir || "src";
  const businessRules = await extractBusinessRules(rootPath, sourceDir, stack);
  const adrs = await extractADRs(rootPath);
  const stateMachines = await detectStateMachines(rootPath, sourceDir, stack);
  const markdown = buildDetectiveMarkdown(businessRules, adrs, stateMachines);

  return { businessRules, adrs, stateMachines, markdown };
}

/**
 * Extract business rules by detecting validation, guard, and assertion patterns.
 */
async function extractBusinessRules(
  rootPath: string,
  sourceDir: string,
  stack: StackProfile,
): Promise<BusinessRule[]> {
  const rules: BusinessRule[] = [];
  const ext = getSourceExtension(stack.language);
  if (!ext) return rules;

  // Pattern categories
  const patterns: Array<{
    name: string;
    grep: string;
    description: string;
  }> = [
    { name: "Validation Rules", grep: "validate\\w*\\s*\\(|isValid\\w*\\s*\\(|\\bschema\\.", description: "Input validation logic" },
    { name: "Guard Clauses", grep: "\\bguard\\s*\\(|\\bcan[A-Z]\\w*\\s*\\(|\\bmay[A-Z]\\w*\\s*\\(", description: "Authorization and access control" },
    { name: "Assertions", grep: "\\bassert\\s*\\(|\\bexpect\\.|\\bshould\\s+", description: "Programmatic assertions and invariants" },
    { name: "Permission Checks", grep: "\\bhasRole\\b|\\bhasPermission\\b|\\bisAdmin\\b|\\bisOwner\\b", description: "Role and permission verification" },
    { name: "Rate Limiting", grep: "\\brateLimit\\b|\\bthrottle\\b|\\bmaxRequests\\b", description: "Rate limiting logic" },
  ];

  for (const pattern of patterns) {
    try {
      const out = execSync(
        `grep -rn "${pattern.grep}" ${sourceDir}/ --include="*.${ext}" 2>/dev/null | head -15`,
        { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
      );
      const examples = out.trim().split("\n").filter(Boolean).map((l) => l.trim());
      if (examples.length > 0) {
        const firstFile = examples[0]?.split(":")[0] ?? "";
        rules.push({
          pattern: pattern.name,
          examples: examples.slice(0, 8),
          file: firstFile,
          description: pattern.description,
        });
      }
    } catch { /* ignore */ }
  }

  // Also search for common business rule keywords
  try {
    const businessPatterns = [
      { name: "Business Rules", grep: "\\bMIN_\\w+\\b|\\bMAX_\\w+\\b|\\bLIMIT_\\w+\\b" },
      { name: "Status/State Constants", grep: "\\bSTATUS_\\w+\\b|\\bSTATE_\\w+\\b" },
      { name: "Error Codes", grep: "\\bERROR_\\w+|\\bERR_\\w+" },
    ];

    for (const bp of businessPatterns) {
      try {
        const out = execSync(
          `grep -rn "${bp.grep}" ${sourceDir}/ --include="*.${ext}" 2>/dev/null | head -10`,
          { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
        );
        const examples = out.trim().split("\n").filter(Boolean).map((l) => l.trim());
        if (examples.length > 0) {
          const firstFile = examples[0]?.split(":")[0] ?? "";
          if (!rules.some((r) => r.pattern === bp.name)) {
            rules.push({
              pattern: bp.name,
              examples: examples.slice(0, 5),
              file: firstFile,
              description: `Project-specific ${bp.name.toLowerCase()}`,
            });
          }
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return rules;
}

/**
 * Extract retroactive ADRs from git commit messages that indicate architectural decisions.
 */
async function extractADRs(rootPath: string): Promise<ADREntry[]> {
  const adrs: ADREntry[] = [];

  try {
    // Look for commits with decision-related keywords
    const logOutput = execSync(
      `git log --oneline --format="%ai|%an|%s" --all -100 2>/dev/null`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );

    const decisionKeywords = [
      "decision", "decid", "choose", "change", "migrate", "replace",
      "adopt", "introduce", "refactor", "redesign", "restructure",
      "extract", "split", "merge", "move to", "switch to", "upgrade",
    ];

    for (const line of logOutput.trim().split("\n").filter(Boolean)) {
      const parts = line.split("|");
      if (parts.length >= 3) {
        const date = parts[0] ?? "";
        const author = parts[1] ?? "";
        const message = parts[2]?.trim() ?? "";
        const isDecision = decisionKeywords.some((kw) =>
          message.toLowerCase().includes(kw),
        );
        const type = isDecision
          ? "architectural-decision"
          : message.toLowerCase().includes("fix") || message.toLowerCase().includes("bug")
            ? "fix"
            : message.toLowerCase().includes("feat") || message.toLowerCase().includes("feature")
              ? "feature"
              : "other";

        adrs.push({
          date,
          author,
          message,
          type,
        });
      }
    }
  } catch { /* ignore */ }

  return adrs.slice(0, 30);
}

/**
 * Detect state machines by looking for switch/case blocks with state-like names.
 */
async function detectStateMachines(
  rootPath: string,
  sourceDir: string,
  stack: StackProfile,
): Promise<StateMachine[]> {
  const machines: StateMachine[] = [];
  const ext = getSourceExtension(stack.language);
  if (!ext) return machines;

  try {
    // Find switch statements that look like state machines
    const switchFiles = execSync(
      `grep -rl "\\bswitch\\s*(" ${sourceDir}/ --include="*.${ext}" 2>/dev/null | head -20`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );

    for (const file of switchFiles.trim().split("\n").filter(Boolean)) {
      const content = await safeReadFile(path.join(rootPath, file));
      if (!content) continue;

      // Look for switch blocks with state-like enum/constant values
      const switchMatches = content.match(/switch\s*\(\s*(\w+(?:state|status|phase|mode|step|stage))\s*\)/gi);
      if (switchMatches && switchMatches.length > 0) {
        // Extract case values as potential states
        const caseValues: string[] = [];
        const caseRegex = /\bcase\s+(\w+(?:STATE|STATUS|PHASE|MODE|STEP|STAGE|_[A-Z]+)?)\b/gi;
        let caseMatch;
        while ((caseMatch = caseRegex.exec(content)) !== null) {
          if (caseMatch[1] && !caseValues.includes(caseMatch[1])) {
            caseValues.push(caseMatch[1]);
          }
        }

        for (const match of switchMatches) {
          const nameMatch = match.match(/switch\s*\(\s*(\w+)/i);
          const name = nameMatch?.[1];
          if (name) {
            machines.push({
              name,
              file,
              states: caseValues.slice(0, 15),
            });
          }
        }
      }
    }
  } catch { /* ignore */ }

  // Also detect enum-like state definitions
  try {
    const enumPatterns = [
      "PENDING|ACTIVE|INACTIVE|COMPLETED|FAILED",
      "DRAFT|REVIEW|APPROVED|REJECTED",
      "OPEN|CLOSED|RESOLVED|REOPENED",
      "CREATED|UPDATED|DELETED|ARCHIVED",
    ];

    for (const ep of enumPatterns) {
      try {
        const out = execSync(
          `grep -rn "${ep}" ${sourceDir}/ --include="*.${ext}" 2>/dev/null | grep -i "enum\\|const\\|state\\|status" | head -5`,
          { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
        );
        if (out.trim()) {
          for (const line of out.trim().split("\n").filter(Boolean)) {
            const file = line.split(":")[0] ?? "";
            const states = ep.split("|");
            if (!machines.some((m) => m.file === file && m.states.some((s) => states.includes(s)))) {
              machines.push({
                name: path.basename(file, `.${ext}`) + "-state-machine",
                file,
                states,
              });
            }
          }
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return machines;
}

function buildDetectiveMarkdown(
  businessRules: BusinessRule[],
  adrs: ADREntry[],
  stateMachines: StateMachine[],
): string {
  const lines: string[] = [];

  lines.push("# Detective Report — Business Logic Analysis");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Business rules
  lines.push("## Business Rules Detected");
  lines.push("");
  if (businessRules.length > 0) {
    for (const rule of businessRules) {
      lines.push(`### ${rule.pattern}`);
      lines.push("");
      lines.push(`${rule.description}`);
      lines.push("");
      lines.push(`**Source:** \`${rule.file}\``);
      lines.push("");
      lines.push("```");
      for (const ex of rule.examples) {
        lines.push(ex);
      }
      lines.push("```");
      lines.push("");
    }
  } else {
    lines.push("_No business rule patterns detected._");
  }
  lines.push("");

  // Retroactive ADRs
  lines.push("## Retroactive ADRs (from git log)");
  lines.push("");
  lines.push("Architecturally-significant commits identified by decision keywords.");
  lines.push("");
  if (adrs.length > 0) {
    const decisionAdrs = adrs.filter((a) => a.type === "architectural-decision");
    if (decisionAdrs.length > 0) {
      lines.push("### Architectural Decisions");
      lines.push("");
      lines.push("| Date | Author | Message |");
      lines.push("|------|--------|---------|");
      for (const adr of decisionAdrs) {
        lines.push(`| ${adr.date.slice(0, 10)} | ${adr.author} | ${adr.message} |`);
      }
      lines.push("");
    }

    // Recent commit history
    lines.push("### Recent Commit Profile");
    lines.push("");
    const typeCount: Record<string, number> = {};
    for (const adr of adrs) {
      typeCount[adr.type] = (typeCount[adr.type] || 0) + 1;
    }
    lines.push("| Type | Count |");
    lines.push("|------|-------|");
    for (const [type, count] of Object.entries(typeCount)) {
      lines.push(`| ${type} | ${count} |`);
    }
    lines.push("");
  } else {
    lines.push("_No git history available._");
  }
  lines.push("");

  // State machines
  lines.push("## State Machines Detected");
  lines.push("");
  if (stateMachines.length > 0) {
    for (const sm of stateMachines) {
      lines.push(`### \`${sm.name}\``);
      lines.push("");
      lines.push(`**File:** \`${sm.file}\``);
      lines.push("");
      lines.push("**States:** " + sm.states.join(", "));
      lines.push("");
    }
  } else {
    lines.push("_No state machine patterns detected._");
  }
  lines.push("");

  return lines.join("\n");
}

function getSourceExtension(language: string): string | null {
  const map: Record<string, string> = {
    typescript: "ts",
    javascript: "js",
    python: "py",
    go: "go",
    rust: "rs",
    ruby: "rb",
    php: "php",
    java: "java",
  };
  return map[language] ?? null;
}
