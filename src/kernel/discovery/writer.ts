/**
 * Discovery Phase 5: Writer
 *
 * Consolidation of all discovery findings into specification documents:
 * - technical-debt.md — consolidated technical debt findings
 * - TECHNICAL-DEBT-REPORT.md — executive summary
 * - consolidated-spec.md — full specification
 */

import type { ScoutReport } from "./scout.js";
import type { ArchaeologistReport } from "./archaeologist.js";
import type { DetectiveReport } from "./detective.js";
import type { ArchitectReport } from "./architect.js";

export interface WriterReport {
  technicalDebt: string;
  technicalDebtReport: string;
  consolidatedSpec: string;
}

export interface AllPhaseReports {
  scout: ScoutReport;
  archaeologist: ArchaeologistReport;
  detective: DetectiveReport;
  architect: ArchitectReport;
}

/**
 * Run the Writer phase — consolidate all phase outputs into spec documents.
 */
export async function runWriter(phases: AllPhaseReports): Promise<WriterReport> {
  const technicalDebt = buildTechnicalDebt(phases);
  const technicalDebtReport = buildTechnicalDebtReport(phases);
  const consolidatedSpec = buildConsolidatedSpec(phases);

  return { technicalDebt, technicalDebtReport, consolidatedSpec };
}

function buildTechnicalDebt(phases: AllPhaseReports): string {
  const lines: string[] = [];

  lines.push("# Technical Debt Assessment");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Complexity hotspots from archaeologist
  lines.push("## Complexity Hotspots");
  lines.push("");
  if (phases.archaeologist.complexFiles.length > 0) {
    const highComplexity = phases.archaeologist.complexFiles.filter((c) => c.score > 20);
    const modComplexity = phases.archaeologist.complexFiles.filter((c) => c.score <= 20);

    if (highComplexity.length > 0) {
      lines.push("### High Complexity (score > 20)");
      lines.push("");
      for (const c of highComplexity) {
        lines.push(`- \`${c.file}\` — score ${c.score}`);
      }
      lines.push("");
    }

    if (modComplexity.length > 0) {
      lines.push("### Moderate Complexity (score 11-20)");
      lines.push("");
      for (const c of modComplexity) {
        lines.push(`- \`${c.file}\` — score ${c.score}`);
      }
      lines.push("");
    }
  } else {
    lines.push("_No complexity hotspots detected._");
  }
  lines.push("");

  // Large files (from scout-context: directory structure doesn't have this directly)
  // We'll rely on the archaeologist data
  lines.push("## Data Structure Debt");
  lines.push("");
  const ds = phases.archaeologist.dataStructures;
  lines.push(`- **Interfaces:** ${ds.interfaces}`);
  lines.push(`- **Type Aliases:** ${ds.types}`);
  lines.push(`- **Classes:** ${ds.classes}`);
  lines.push(`- **Enums:** ${ds.enums}`);
  lines.push("");

  // Business rule gaps (from detective)
  lines.push("## Business Logic Documentation Gaps");
  lines.push("");
  if (phases.detective.businessRules.length > 0) {
    lines.push("Detected business rules that may need formal documentation:");
    lines.push("");
    for (const rule of phases.detective.businessRules) {
      lines.push(`- **${rule.pattern}** — ${rule.description}`);
    }
  } else {
    lines.push("_No undocumented business rules detected._");
  }
  lines.push("");

  // ADRs from detective
  lines.push("## Missing Architecture Decision Records");
  lines.push("");
  const decisionAdrs = phases.detective.adrs.filter((a) => a.type === "architectural-decision");
  if (decisionAdrs.length > 0) {
    lines.push(`Found ${decisionAdrs.length} architectural decisions in git history that lack formal ADRs:`);
    lines.push("");
    for (const adr of decisionAdrs.slice(0, 10)) {
      lines.push(`- ${adr.date.slice(0, 10)} — ${adr.message}`);
    }
    lines.push("");
  } else {
    lines.push("_No git history with decision patterns found._");
  }
  lines.push("");

  // Integration risks
  lines.push("## Integration Risk Areas");
  lines.push("");
  if (phases.architect.integrations.length > 0) {
    for (const integration of phases.architect.integrations) {
      const riskLevel = integration.type === "external-api" ? "External dependency risk" : "Infrastructure dependency";
      lines.push(`- **${integration.name}** (${integration.type}) — ${riskLevel}`);
    }
  } else {
    lines.push("_No integration risks identified._");
  }
  lines.push("");

  // Framework/structure observations
  lines.push("## Structural Observations");
  lines.push("");
  if (phases.scout.languages && Object.keys(phases.scout.languages).length > 0) {
    const langs = Object.entries(phases.scout.languages);
    const primary = langs[0];
    if (primary) {
      lines.push(`- **Primary Language:** ${primary[0]} (${primary[1]} files)`);
    }
    if (langs.length > 1) {
      lines.push(`- **Multi-language project:** ${langs.length} language types detected — increases complexity`);
    }
  }
  if (phases.scout.frameworks.length > 0) {
    lines.push(`- **Frameworks:** ${phases.scout.frameworks.map((f) => f.name).join(", ")}`);
  }
  lines.push(`- **Entry Points:** ${phases.scout.entryPoints.length} detected`);
  lines.push(`- **State Machines:** ${phases.detective.stateMachines.length} detected`);
  lines.push("");

  return lines.join("\n");
}

function buildTechnicalDebtReport(phases: AllPhaseReports): string {
  const lines: string[] = [];

  lines.push("# Technical Debt Report — Executive Summary");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push(`This report summarizes the technical debt assessment for the analyzed project.`);
  lines.push(`The analysis was performed across 5 phases: Scout, Archaeologist, Detective, Architect, and Writer.`);
  lines.push("");

  // Key metrics
  const totalComplexFiles = phases.archaeologist.complexFiles.length;
  const highComplex = phases.archaeologist.complexFiles.filter((c) => c.score > 20).length;
  const totalDataStructures = phases.archaeologist.dataStructures.interfaces +
    phases.archaeologist.dataStructures.types +
    phases.archaeologist.dataStructures.classes +
    phases.archaeologist.dataStructures.enums;
  const totalBusinessRules = phases.detective.businessRules.length;
  const totalAdrs = phases.detective.adrs.length;
  const totalStateMachines = phases.detective.stateMachines.length;
  const totalIntegrations = phases.architect.integrations.length;
  const totalFrameworks = phases.scout.frameworks.length;

  lines.push("## Key Metrics");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Files with elevated complexity | ${totalComplexFiles} |`);
  lines.push(`| High-complexity files (score > 20) | ${highComplex} |`);
  lines.push(`| Data structures defined | ${totalDataStructures} |`);
  lines.push(`| Business rule patterns | ${totalBusinessRules} |`);
  lines.push(`| Git-based decisions (potential ADRs) | ${totalAdrs} |`);
  lines.push(`| State machines detected | ${totalStateMachines} |`);
  lines.push(`| External integrations | ${totalIntegrations} |`);
  lines.push(`| Frameworks detected | ${totalFrameworks} |`);
  lines.push("");

  // Risk levels
  const complexityRisk = totalComplexFiles > 10 ? "HIGH" : totalComplexFiles > 5 ? "MEDIUM" : "LOW";
  const integrationRisk = totalIntegrations > 5 ? "HIGH" : totalIntegrations > 2 ? "MEDIUM" : "LOW";
  const docGapRisk = totalBusinessRules > 3 ? "MEDIUM" : "LOW";

  lines.push("## Risk Assessment");
  lines.push("");
  lines.push("| Area | Risk Level | Recommendation |");
  lines.push("|------|-----------|----------------|");
  lines.push(`| Code Complexity | ${complexityRisk} | ${complexityRisk === "HIGH" ? "Prioritize refactoring complex files" : "Monitor for new complexity"}`);
  lines.push(`| Integration Surface | ${integrationRisk} | ${integrationRisk === "HIGH" ? "Document all external dependencies" : "Keep current monitoring"}`);
  lines.push(`| Documentation Gaps | ${docGapRisk} | ${docGapRisk === "MEDIUM" ? "Formalize business rules as ADRs" : "Maintain current practices"}`);
  lines.push("");

  // Action items
  lines.push("## Recommended Actions");
  lines.push("");
  const actions: string[] = [];

  if (highComplex > 0) {
    actions.push(`1. **Refactor** ${highComplex} high-complexity file(s) to reduce cyclomatic complexity below 20`);
  }
  if (totalComplexFiles > 0 && highComplex === 0) {
    actions.push(`1. **Review** ${totalComplexFiles} moderately complex file(s) for simplification opportunities`);
  }
  if (totalIntegrations > 0) {
    actions.push(`${actions.length + 1}. **Document** ${totalIntegrations} integration point(s) with interface contracts`);
  }
  if (totalStateMachines > 0) {
    actions.push(`${actions.length + 1}. **Formalize** ${totalStateMachines} detected state machine(s) with ADRs`);
  }
  if (totalBusinessRules > 0) {
    actions.push(`${actions.length + 1}. **Catalog** ${totalBusinessRules} business rule pattern(s) in formal documentation`);
  }
  if (actions.length === 0) {
    actions.push("1. **Maintain** — No critical issues detected. Continue current practices.");
  }

  for (const action of actions) {
    lines.push(action);
  }
  lines.push("");

  // Framework recommendations
  lines.push("## Framework & Tools");
  lines.push("");
  if (totalFrameworks > 0) {
    lines.push(`Detected frameworks: ${phases.scout.frameworks.map((f) => f.name).join(", ")}`);
    lines.push("");
  }
  lines.push("Consider adopting:");
  lines.push("- Automated dependency upgrade tooling (Dependabot, Renovate)");
  lines.push("- Static analysis integration in CI pipeline");
  lines.push("- Architecture Decision Record (ADR) process for future decisions");
  lines.push("");

  return lines.join("\n");
}

function buildConsolidatedSpec(phases: AllPhaseReports): string {
  const lines: string[] = [];

  lines.push("# Consolidated Discovery Specification");
  lines.push("");
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Requirements
  lines.push("## Requirements Overview");
  lines.push("");
  lines.push("### Functional Areas");
  lines.push("");
  if (phases.scout.entryPoints.length > 0) {
    lines.push(`The system has ${phases.scout.entryPoints.length} entry point(s), suggesting the following functional areas:`);
    lines.push("");
    for (const ep of phases.scout.entryPoints) {
      lines.push(`- **Entry:** \`${ep}\``);
    }
    lines.push("");
  }

  if (phases.detective.stateMachines.length > 0) {
    lines.push("### State Machines");
    lines.push("");
    for (const sm of phases.detective.stateMachines) {
      lines.push(`- **\`${sm.name}\`** — States: ${sm.states.join(", ")}`);
    }
    lines.push("");
  }

  // Design considerations
  lines.push("## Design Considerations");
  lines.push("");
  if (phases.architect.integrations.length > 0) {
    lines.push("### Integration Points");
    lines.push("");
    for (const i of phases.architect.integrations) {
      lines.push(`- \`${i.name}\` (${i.type})`);
    }
    lines.push("");
  }

  if (phases.scout.conventions.length > 0) {
    lines.push("### Conventions");
    lines.push("");
    for (const c of phases.scout.conventions) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }

  // Implementation tasks
  lines.push("## Implementation Tasks");
  lines.push("");
  lines.push("Based on the discovery findings, the following tasks are recommended:");
  lines.push("");

  const highComplex = phases.archaeologist.complexFiles.filter((c) => c.score > 20);
  if (highComplex.length > 0) {
    lines.push("1. **Refactor high-complexity code** — Files exceeding complexity threshold");
    for (const c of highComplex.slice(0, 5)) {
      lines.push(`   - Refactor \`${c.file}\` (complexity: ${c.score})`);
    }
    lines.push("");
  }

  if (phases.detective.businessRules.length > 0) {
    lines.push(`${highComplex.length > 0 ? "2" : "1"}. **Document business rules** — Formalize detected patterns`);
    for (const rule of phases.detective.businessRules) {
      lines.push(`   - Create ADR for \`${rule.pattern}\``);
    }
    lines.push("");
  }

  if (phases.detective.stateMachines.length > 0) {
    const idx = (highComplex.length > 0 ? 2 : 0) + (phases.detective.businessRules.length > 0 ? 1 : 0) + 1;
    lines.push(`${idx}. **Formalize state machines** — Document with ADRs`);
    for (const sm of phases.detective.stateMachines) {
      lines.push(`   - ADR for \`${sm.name}\` state machine in \`${sm.file}\``);
    }
    lines.push("");
  }

  lines.push("## Notices");
  lines.push("");
  lines.push("> This specification was auto-generated by `devflow discover`. Review and validate all findings");
  lines.push("> before using them as the basis for implementation work.");
  lines.push("");

  return lines.join("\n");
}
