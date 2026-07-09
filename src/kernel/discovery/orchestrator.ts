/**
 * Discovery Orchestrator
 *
 * Executes the 5 discovery phases in sequence with:
 * - Visible progress per phase
 * - Intermediate output files for checkpoint/resume
 * - Phase-level error handling
 */

import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import pc from "picocolors";
import { detectStackProfile } from "../detection/stack.js";
import type { StackProfile } from "../detection/stack.js";
import { runScout } from "./scout.js";
import type { ScoutReport } from "./scout.js";
import { runArchaeologist } from "./archaeologist.js";
import type { ArchaeologistReport } from "./archaeologist.js";
import { runDetective } from "./detective.js";
import type { DetectiveReport } from "./detective.js";
import { runArchitect } from "./architect.js";
import type { ArchitectReport, SchemaReport } from "./architect.js";
import { runWriter } from "./writer.js";
import { WorkflowEngine } from "../workflow/engine.js";

export type PhaseName = "scout" | "archaeologist" | "detective" | "architect" | "writer";
export type NewPhaseName = "scan" | "analyze" | "deduce" | "design" | "document";

const PHASE_NAMES: PhaseName[] = ["scout", "archaeologist", "detective", "architect", "writer"];

const PHASE_LABELS: Record<PhaseName, string> = {
  scout: "Scout — Project Structure",
  archaeologist: "Archaeologist — Code Analysis",
  detective: "Detective — Business Logic",
  architect: "Architect — Architecture Reconstruction",
  writer: "Writer — Specification Generation",
};

/**
 * Phase Alias Map (old → new verb names)
 * Enables backward-compatible phase name resolution.
 */
export const PHASE_ALIASES: Record<string, PhaseName> = {
  // Old names (identity)
  scout: "scout",
  archaeologist: "archaeologist",
  detective: "detective",
  architect: "architect",
  writer: "writer",
  // New verb aliases (scout→scan, archaeologist→analyze, etc.)
  scan: "scout",
  analyze: "archaeologist",
  deduce: "detective",
  design: "architect",
  document: "writer",
};

export const NEW_PHASE_NAMES: NewPhaseName[] = ["scan", "analyze", "deduce", "design", "document"];

/**
 * Resolve a phase name, accepting both old and new names.
 * Returns the canonical PhaseName or undefined if not recognized.
 */
export function resolvePhaseName(name: string): PhaseName | undefined {
  const normalized = name.toLowerCase().trim();
  return PHASE_ALIASES[normalized];
}

export interface PhaseContext {
  scout?: ScoutReport;
  archaeologist?: ArchaeologistReport;
  detective?: DetectiveReport;
  architect?: ArchitectReport;
  schema?: SchemaReport;
}

export interface DiscoverOptions {
  phase?: PhaseName;
  rootPath: string;
}

/**
 * Run the full discovery workflow or a single phase.
 */
export async function runDiscovery(options: DiscoverOptions): Promise<void> {
  const { rootPath, phase } = options;
  const discoveryDir = path.join(rootPath, "_devflow", "discovery");
  await mkdir(discoveryDir, { recursive: true });

  // Detect stack once, used by all phases
  const stack = await detectStackProfile(rootPath);

  // Initialize workflow engine for tracking
  const engine = new WorkflowEngine(rootPath);
  try {
    await engine.initialize();
  } catch {
    // Engine not required to be initialized — proceed without it
  }

  const ctx: PhaseContext = {};

  if (phase) {
    // Single phase execution
    await executePhase(phase, rootPath, discoveryDir, stack, ctx, engine);
    console.log(pc.green(`\nPhase "${phase}" complete.`));
  } else {
    // Full workflow
    console.log(pc.bold("\nDevflow Discovery — Brownfield Analysis\n"));

    for (const phaseName of PHASE_NAMES) {
      const label = PHASE_LABELS[phaseName];
      console.log(pc.cyan(`\n→ Phase: ${label}`));
      await executePhase(phaseName, rootPath, discoveryDir, stack, ctx, engine);
      console.log(pc.green(`  ✓ ${phaseName} complete`));
    }

    console.log(pc.green("\n✓ Discovery complete!"));
    console.log(pc.dim(`  Reports: ${discoveryDir}/\n`));
  }
}

async function executePhase(
  phaseName: PhaseName,
  rootPath: string,
  discoveryDir: string,
  stack: StackProfile,
  ctx: PhaseContext,
  engine: WorkflowEngine,
): Promise<void> {
  switch (phaseName) {
    case "scout":
      await executeScoutPhase(rootPath, discoveryDir, stack, ctx, engine);
      break;
    case "archaeologist":
      await executeArchaeologistPhase(rootPath, discoveryDir, stack, ctx, engine);
      break;
    case "detective":
      await executeDetectivePhase(rootPath, discoveryDir, stack, ctx, engine);
      break;
    case "architect":
      await executeArchitectPhase(rootPath, discoveryDir, stack, ctx, engine);
      break;
    case "writer":
      await executeWriterPhase(discoveryDir, ctx, engine);
      break;
  }
}

async function executeScoutPhase(
  rootPath: string,
  discoveryDir: string,
  stack: StackProfile,
  ctx: PhaseContext,
  _engine: WorkflowEngine,
): Promise<void> {
  const report = await runScout(rootPath, stack);
  ctx.scout = report;

  // Write intermediate output
  await writeFile(path.join(discoveryDir, "scout-report.md"), report.markdown, "utf-8");
}

async function executeArchaeologistPhase(
  rootPath: string,
  discoveryDir: string,
  stack: StackProfile,
  ctx: PhaseContext,
  _engine: WorkflowEngine,
): Promise<void> {
  const report = await runArchaeologist(rootPath, stack);
  ctx.archaeologist = report;

  await writeFile(path.join(discoveryDir, "archaeology-report.md"), report.markdown, "utf-8");
}

async function executeDetectivePhase(
  rootPath: string,
  discoveryDir: string,
  stack: StackProfile,
  ctx: PhaseContext,
  _engine: WorkflowEngine,
): Promise<void> {
  const report = await runDetective(rootPath, stack);
  ctx.detective = report;

  await writeFile(path.join(discoveryDir, "detective-report.md"), report.markdown, "utf-8");
}

async function executeArchitectPhase(
  rootPath: string,
  discoveryDir: string,
  stack: StackProfile,
  ctx: PhaseContext,
  _engine: WorkflowEngine,
): Promise<void> {
  const { report, schemaReport } = await runArchitect(rootPath, stack);
  ctx.architect = report;
  ctx.schema = schemaReport;

  await writeFile(path.join(discoveryDir, "architecture-reconstruction.md"), report.markdown, "utf-8");
  await writeFile(path.join(discoveryDir, "SCHEMA.md"), schemaReport.schemaMarkdown, "utf-8");
}

async function executeWriterPhase(
  discoveryDir: string,
  ctx: PhaseContext,
  _engine: WorkflowEngine,
): Promise<void> {
  const { scout, archaeologist, detective, architect } = ctx;
  if (!scout || !archaeologist || !detective || !architect) {
    console.log(pc.yellow("  Warning: Some phases missing data. Writer will work with available data."));
  }

  const phases = {
    scout: scout ?? await createEmptyScoutReport(),
    archaeologist: archaeologist ?? await createEmptyArchaeologistReport(),
    detective: detective ?? await createEmptyDetectiveReport(),
    architect: architect ?? await createEmptyArchitectReport(),
  };

  const report = await runWriter(phases);

  await writeFile(path.join(discoveryDir, "technical-debt.md"), report.technicalDebt, "utf-8");
  await writeFile(path.join(discoveryDir, "TECHNICAL-DEBT-REPORT.md"), report.technicalDebtReport, "utf-8");
  await writeFile(path.join(discoveryDir, "consolidated-spec.md"), report.consolidatedSpec, "utf-8");

  // Build final system-architecture.md from all previous phase outputs
  const systemArchMarkdown = await buildSystemArchitectureMarkdown(phases);
  await writeFile(path.join(discoveryDir, "system-architecture.md"), systemArchMarkdown, "utf-8");
}

async function buildSystemArchitectureMarkdown(
  phases: {
    scout: ScoutReport;
    archaeologist: ArchaeologistReport;
    detective: DetectiveReport;
    architect: ArchitectReport;
  },
): Promise<string> {
  const lines: string[] = [];

  lines.push("# System Architecture");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Section 1: Structure (from Scout)
  lines.push("## 1. Project Structure");
  lines.push("");
  lines.push("### Directory Layout");
  lines.push("");
  lines.push("```");
  lines.push(phases.scout.directoryTree);
  lines.push("```");
  lines.push("");

  lines.push("### Languages");
  lines.push("");
  const sorted = Object.entries(phases.scout.languages).sort((a, b) => b[1] - a[1]);
  for (const [ext, count] of sorted) {
    lines.push(`- .${ext}: ${count} files`);
  }
  lines.push("");

  lines.push("### Frameworks");
  lines.push("");
  for (const fw of phases.scout.frameworks) {
    lines.push(`- **${fw.name}** (${fw.confidence}): ${fw.evidence}`);
  }
  lines.push("");

  lines.push("### Entry Points");
  lines.push("");
  for (const ep of phases.scout.entryPoints) {
    lines.push(`- \`${ep}\``);
  }
  lines.push("");

  // Section 2: Internals (from Archaeologist)
  lines.push("## 2. Code Internals");
  lines.push("");
  lines.push("### Control Flow");
  lines.push("");
  const cf = phases.archaeologist.controlFlow;
  lines.push(`- Conditionals: ${cf.conditionals}`);
  lines.push(`- Switch/Case: ${cf.switches}`);
  lines.push(`- Try/Catch: ${cf.tryCatch}`);
  lines.push(`- Loops: ${cf.loops}`);
  lines.push("");

  lines.push("### Data Structures");
  lines.push("");
  const ds = phases.archaeologist.dataStructures;
  lines.push(`- Interfaces: ${ds.interfaces}`);
  lines.push(`- Types: ${ds.types}`);
  lines.push(`- Classes: ${ds.classes}`);
  lines.push(`- Enums: ${ds.enums}`);
  lines.push("");

  if (phases.archaeologist.complexFiles.length > 0) {
    lines.push("### Complexity Hotspots");
    lines.push("");
    for (const c of phases.archaeologist.complexFiles.slice(0, 10)) {
      lines.push(`- \`${c.file}\`: ${c.score} — ${c.description}`);
    }
    lines.push("");
  }

  // Section 3: Business Logic (from Detective)
  lines.push("## 3. Business Logic");
  lines.push("");
  if (phases.detective.businessRules.length > 0) {
    lines.push("### Business Rules");
    lines.push("");
    for (const rule of phases.detective.businessRules) {
      lines.push(`- **${rule.pattern}**: ${rule.description}`);
    }
    lines.push("");
  }

  if (phases.detective.stateMachines.length > 0) {
    lines.push("### State Machines");
    lines.push("");
    for (const sm of phases.detective.stateMachines) {
      lines.push(`- **${sm.name}** (${sm.file}): ${sm.states.length} states`);
    }
    lines.push("");
  }

  if (phases.detective.adrs.length > 0) {
    lines.push("### Recent Commit Profile");
    lines.push("");
    const typeCount: Record<string, number> = {};
    for (const adr of phases.detective.adrs) {
      typeCount[adr.type] = (typeCount[adr.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(typeCount)) {
      lines.push(`- ${type}: ${count}`);
    }
    lines.push("");
  }

  // Section 4: Architecture (from Architect)
  lines.push("## 4. Architecture");
  lines.push("");
  lines.push("### C4 Context Diagram");
  lines.push("");
  lines.push("```mermaid");
  lines.push(phases.architect.c4ContextDiagram);
  lines.push("```");
  lines.push("");

  lines.push("### Integrations");
  lines.push("");
  for (const i of phases.architect.integrations) {
    lines.push(`- **${i.name}** (${i.type}): ${i.evidence}`);
  }
  lines.push("");

  if (phases.architect.erd) {
    lines.push("### Entity Relationship Diagram");
    lines.push("");
    lines.push("```mermaid");
    lines.push(phases.architect.erd);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

async function createEmptyScoutReport(): Promise<ScoutReport> {
  return {
    directoryTree: "No data",
    languages: {},
    frameworks: [],
    entryPoints: [],
    conventions: [],
    markdown: "No scout data available.",
  };
}

async function createEmptyArchaeologistReport(): Promise<ArchaeologistReport> {
  return {
    complexFiles: [],
    controlFlow: { conditionals: 0, switches: 0, tryCatch: 0, loops: 0 },
    dataStructures: { interfaces: 0, types: 0, classes: 0, enums: 0, records: [] },
    markdown: "No archaeologist data available.",
  };
}

async function createEmptyDetectiveReport(): Promise<DetectiveReport> {
  return {
    businessRules: [],
    adrs: [],
    stateMachines: [],
    markdown: "No detective data available.",
  };
}

async function createEmptyArchitectReport(): Promise<ArchitectReport> {
  return {
    c4ContextDiagram: "",
    c4ContainerDiagram: "",
    integrations: [],
    modules: [],
    erd: null,
    hasSchema: false,
    markdown: "No architect data available.",
  };
}
