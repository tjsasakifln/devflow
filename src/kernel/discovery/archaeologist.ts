/**
 * Discovery Phase 2: Archaeologist
 *
 * Deep code analysis — cyclomatic complexity, control flow, data structures.
 * Uses grep-based patterns for language-agnostic analysis.
 */

import path from "node:path";
import { execSync } from "node:child_process";
import { safeReadFile } from "../utils/fs.js";
import type { StackProfile } from "../detection/stack.js";

export interface ComplexityResult {
  file: string;
  score: number;
  description: string;
}

export interface ControlFlowSummary {
  conditionals: number;
  switches: number;
  tryCatch: number;
  loops: number;
}

export interface DataStructureInfo {
  interfaces: number;
  types: number;
  classes: number;
  enums: number;
  records: Array<{ name: string; kind: string; file: string }>;
}

export interface ArchaeologistReport {
  complexFiles: ComplexityResult[];
  controlFlow: ControlFlowSummary;
  dataStructures: DataStructureInfo;
  markdown: string;
}

export async function runArchaeologist(rootPath: string, stack: StackProfile): Promise<ArchaeologistReport> {
  const sourceDir = stack.sourceDir || "src";
  const complexFiles = await analyzeCyclomaticComplexity(rootPath, sourceDir, stack);
  const controlFlow = await analyzeControlFlow(rootPath, sourceDir, stack);
  const dataStructures = await analyzeDataStructures(rootPath, sourceDir, stack);
  const markdown = buildArchaeologistMarkdown(complexFiles, controlFlow, dataStructures);

  return { complexFiles, controlFlow, dataStructures, markdown };
}

/**
 * Estimate cyclomatic complexity by counting decision points per file.
 * Uses pattern matching for language-agnostic analysis.
 */
async function analyzeCyclomaticComplexity(
  rootPath: string,
  sourceDir: string,
  stack: StackProfile,
): Promise<ComplexityResult[]> {
  const results: ComplexityResult[] = [];
  const ext = getSourceExtension(stack.language);
  if (!ext) return results;

  try {
    const filesOutput = execSync(
      `find ${sourceDir}/ -name "*.${ext}" -type f 2>/dev/null | head -80`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    const files = filesOutput.trim().split("\n").filter(Boolean);

    for (const file of files) {
      const content = await safeReadFile(path.join(rootPath, file));
      if (!content) continue;
      if (content.length > 100000) continue; // Skip very large files

      // Count decision points (language-agnostic)
      const ifs = (content.match(/\bif\s*\(/g) || []).length;
      const elseIfs = (content.match(/\belse\s+if\s*\(/g) || []).length;
      const switches = (content.match(/\bswitch\s*\(/g) || []).length;
      const cases = (content.match(/\bcase\s+/g) || []).length;
      const ands = (content.match(/&&/g) || []).length;
      const ors = (content.match(/\|\|/g) || []).length;
      const catches = (content.match(/\bcatch\s*\(/g) || []).length;
      const ternary = (content.match(/\?\s*[^:]+:/g) || []).length;

      // McCabe-like: 1 + #decision points
      const decisionPoints = ifs + elseIfs + switches + cases + ands + ors + catches + ternary;
      const complexity = 1 + decisionPoints;

      if (complexity > 10) {
        const desc = complexity > 30
          ? `High complexity (${complexity}) — refactoring recommended`
          : complexity > 20
            ? `Moderate-high complexity (${complexity}) — consider simplification`
            : `Moderate complexity (${complexity}) — monitor`;
        results.push({ file, score: complexity, description: desc });
      }
    }
  } catch { /* ignore */ }

  // Sort by complexity descending, top 20
  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}

/**
 * Count control flow constructs per source directory.
 */
async function analyzeControlFlow(
  rootPath: string,
  sourceDir: string,
  stack: StackProfile,
): Promise<ControlFlowSummary> {
  const ext = getSourceExtension(stack.language);
  if (!ext) return { conditionals: 0, switches: 0, tryCatch: 0, loops: 0 };

  try {
    const cmd = (pattern: string) => {
      try {
        const out = execSync(
          `grep -rP "${pattern}" ${sourceDir}/ --include="*.${ext}" 2>/dev/null | wc -l`,
          { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
        );
        return parseInt(out.trim(), 10) || 0;
      } catch { return 0; }
    };

    return {
      conditionals: cmd("\\bif\\s*\\(") + cmd("\\belse\\s+if\\s*\\("),
      switches: cmd("\\bswitch\\s*\\("),
      tryCatch: cmd("\\btry\\s*\\{") + cmd("\\bcatch\\s*\\("),
      loops: cmd("\\bfor\\s*\\(") + cmd("\\bwhile\\s*\\(") + cmd("\\bfor\\s+"),
    };
  } catch {
    return { conditionals: 0, switches: 0, tryCatch: 0, loops: 0 };
  }
}

/**
 * Extract data structure definitions (interfaces, types, classes, enums).
 */
async function analyzeDataStructures(
  rootPath: string,
  sourceDir: string,
  stack: StackProfile,
): Promise<DataStructureInfo> {
  const records: Array<{ name: string; kind: string; file: string }> = [];

  if (stack.language !== "typescript") {
    // Generic pattern for class detection in any language
    try {
      const out = execSync(
        `grep -rn "\\bclass\\s\\+\\w\\+" ${sourceDir}/ 2>/dev/null | head -60`,
        { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
      );
      for (const line of out.trim().split("\n").filter(Boolean)) {
        const match = line.match(/^([^:]+):.*\bclass\s+(\w+)/);
        const name = match?.[2];
        const file = match?.[1];
        if (name && file) records.push({ name, kind: "class", file });
      }
    } catch { /* ignore */ }
    return { interfaces: 0, types: 0, classes: records.length, enums: 0, records };
  }

  // TypeScript-specific analysis
  try {
    // Interfaces
    const ifaceOut = execSync(
      `grep -rn "\\binterface\\s\\+\\w\\+" ${sourceDir}/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -60`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    for (const line of ifaceOut.trim().split("\n").filter(Boolean)) {
      const match = line.match(/^([^:]+):.*\binterface\s+(\w+)/);
      const name = match?.[2];
      const file = match?.[1];
      if (name && file) records.push({ name, kind: "interface", file });
    }

    // Types
    const typeOut = execSync(
      `grep -rn "\\btype\\s\\+\\w\\+\\s*=" ${sourceDir}/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -60`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    for (const line of typeOut.trim().split("\n").filter(Boolean)) {
      const match = line.match(/^([^:]+):.*\btype\s+(\w+)\s*=/);
      const name = match?.[2];
      const file = match?.[1];
      if (name && file) records.push({ name, kind: "type alias", file });
    }

    // Classes
    const classOut = execSync(
      `grep -rn "\\bclass\\s\\+\\w\\+" ${sourceDir}/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -60`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    for (const line of classOut.trim().split("\n").filter(Boolean)) {
      const match = line.match(/^([^:]+):.*\bclass\s+(\w+)/);
      const name = match?.[2];
      const file = match?.[1];
      if (name && file) records.push({ name, kind: "class", file });
    }

    // Enums
    const enumOut = execSync(
      `grep -rn "\\benum\\s\\+\\w\\+" ${sourceDir}/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -60`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );
    for (const line of enumOut.trim().split("\n").filter(Boolean)) {
      const match = line.match(/^([^:]+):.*\benum\s+(\w+)/);
      const name = match?.[2];
      const file = match?.[1];
      if (name && file) records.push({ name, kind: "enum", file });
    }
  } catch { /* ignore */ }

  const interfaces = records.filter((r) => r.kind === "interface").length;
  const types = records.filter((r) => r.kind === "type alias").length;
  const classes = records.filter((r) => r.kind === "class").length;
  const enums = records.filter((r) => r.kind === "enum").length;

  return { interfaces, types, classes, enums, records };
}

function buildArchaeologistMarkdown(
  complexFiles: ComplexityResult[],
  controlFlow: ControlFlowSummary,
  dataStructures: DataStructureInfo,
): string {
  const lines: string[] = [];

  lines.push("# Archaeology Report — Code Analysis");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Control flow summary
  lines.push("## Control Flow Overview");
  lines.push("");
  lines.push("| Construct | Count |");
  lines.push("|-----------|-------|");
  lines.push(`| Conditionals (if/else if) | ${controlFlow.conditionals} |`);
  lines.push(`| Switch/Case | ${controlFlow.switches} |`);
  lines.push(`| Try/Catch | ${controlFlow.tryCatch} |`);
  lines.push(`| Loops (for/while) | ${controlFlow.loops} |`);
  lines.push("");

  // Cyclomatic complexity
  lines.push("## Cyclomatic Complexity Hotspots");
  lines.push("");
  if (complexFiles.length > 0) {
    lines.push("Files with complexity > 10 (McCabe-like metric):");
    lines.push("");
    lines.push("| File | Score | Assessment |");
    lines.push("|------|-------|------------|");
    for (const c of complexFiles) {
      lines.push(`| \`${c.file}\` | ${c.score} | ${c.description} |`);
    }
  } else {
    lines.push("_No files exceed moderate complexity thresholds._");
  }
  lines.push("");

  // Data structures
  lines.push("## Data Structures");
  lines.push("");
  lines.push(`- **Interfaces:** ${dataStructures.interfaces}`);
  lines.push(`- **Type Aliases:** ${dataStructures.types}`);
  lines.push(`- **Classes:** ${dataStructures.classes}`);
  lines.push(`- **Enums:** ${dataStructures.enums}`);
  lines.push("");

  if (dataStructures.records.length > 0) {
    lines.push("### Detailed Definitions");
    lines.push("");
    lines.push("| Kind | Name | File |");
    lines.push("|------|------|------|");
    for (const r of dataStructures.records.slice(0, 40)) {
      lines.push(`| ${r.kind} | \`${r.name}\` | \`${r.file}\` |`);
    }
    if (dataStructures.records.length > 40) {
      lines.push(`| ... | _and ${dataStructures.records.length - 40} more_ |`);
    }
    lines.push("");
  }

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
