import { describe, it, expect } from "vitest";
import { runWriter } from "../../../src/kernel/discovery/writer.js";
import type { AllPhaseReports } from "../../../src/kernel/discovery/writer.js";
import type { ScoutReport } from "../../../src/kernel/discovery/scout.js";
import type { ArchaeologistReport } from "../../../src/kernel/discovery/archaeologist.js";
import type { DetectiveReport } from "../../../src/kernel/discovery/detective.js";
import type { ArchitectReport } from "../../../src/kernel/discovery/architect.js";
import {
  TYPESCRIPT_SCOUT_REPORT, COMPLEX_ARCHAEOLOGIST_REPORT, COMPLEX_DETECTIVE_REPORT, COMPLEX_ARCHITECT_REPORT,
  EMPTY_SCOUT_REPORT, EMPTY_ARCHAEOLOGIST_REPORT, EMPTY_DETECTIVE_REPORT, EMPTY_ARCHITECT_REPORT,
} from "./fixtures/mock-reports.js";

function buildPhases(overrides: any = {}): AllPhaseReports {
  return {
    scout: (overrides.scout ?? TYPESCRIPT_SCOUT_REPORT) as unknown as ScoutReport,
    archaeologist: (overrides.archaeologist ?? COMPLEX_ARCHAEOLOGIST_REPORT) as unknown as ArchaeologistReport,
    detective: (overrides.detective ?? COMPLEX_DETECTIVE_REPORT) as unknown as DetectiveReport,
    architect: (overrides.architect ?? COMPLEX_ARCHITECT_REPORT) as unknown as ArchitectReport,
  };
}

describe("Discovery Writer", () => {
  it("runWriter returns all three report fields", async () => {
    const report = await runWriter(buildPhases());
    expect(report).toHaveProperty("technicalDebt");
    expect(report).toHaveProperty("technicalDebtReport");
    expect(report).toHaveProperty("consolidatedSpec");
  });

  it("each report begins with a markdown title", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebt).toMatch(/^# Technical Debt Assessment/);
    expect(report.technicalDebtReport).toMatch(/^# Technical Debt Report/);
    expect(report.consolidatedSpec).toMatch(/^# Consolidated Discovery Specification/);
  });

  it("reports include generation timestamp", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebt).toContain("> Generated:");
    expect(report.technicalDebtReport).toContain("> Generated:");
    expect(report.consolidatedSpec).toContain("> Generated:");
  });

  it("technical debt lists complexity hotspots from archaeologist", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebt).toContain("High Complexity (score > 20)");
    expect(report.technicalDebt).toContain("src/processor.ts");
    expect(report.technicalDebt).toContain("Moderate Complexity (score 11-20)");
  });

  it("technical debt includes data structure summary", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebt).toContain("Data Structure Debt");
    expect(report.technicalDebt).toContain("Interfaces:");
    expect(report.technicalDebt).toContain("8");
    expect(report.technicalDebt).toContain("Type Aliases:");
    expect(report.technicalDebt).toContain("Classes:");
    expect(report.technicalDebt).toContain("Enums:");
  });

  it("technical debt lists business rule documentation gaps", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebt).toContain("Business Logic Documentation Gaps");
    expect(report.technicalDebt).toContain("Validation Rules");
  });

  it("technical debt includes ADR section", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebt).toContain("Missing Architecture Decision Records");
    expect(report.technicalDebt).toContain("migrate from REST to GraphQL");
  });

  it("technical debt identifies integration risk areas", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebt).toContain("Integration Risk Areas");
    expect(report.technicalDebt).toContain("External dependency risk");
  });

  it("technical debt includes structural observations from scout", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebt).toContain("Structural Observations");
    expect(report.technicalDebt).toContain("Primary Language");
  });

  it("executive report contains overview and key metrics", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebtReport).toContain("## Overview");
    expect(report.technicalDebtReport).toContain("## Key Metrics");
    expect(report.technicalDebtReport).toContain("| Metric | Value |");
  });

  it("executive report generates recommended actions", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebtReport).toContain("## Recommended Actions");
    expect(report.technicalDebtReport).toContain("Refactor");
  });

  it("executive report shows framework & tools recommendations", async () => {
    const report = await runWriter(buildPhases());
    expect(report.technicalDebtReport).toContain("## Framework & Tools");
    expect(report.technicalDebtReport).toContain("Dependabot");
  });

  it("consolidated spec lists entry points and state machines", async () => {
    const report = await runWriter(buildPhases());
    expect(report.consolidatedSpec).toContain("Requirements Overview");
    expect(report.consolidatedSpec).toContain("src/index.ts");
    expect(report.consolidatedSpec).toContain("State Machines");
    expect(report.consolidatedSpec).toContain("orderState");
  });

  it("consolidated spec has notices section", async () => {
    const report = await runWriter(buildPhases());
    expect(report.consolidatedSpec).toContain("## Notices");
  });

  it("handles empty reports gracefully", async () => {
    const report = await runWriter(buildPhases({
      scout: EMPTY_SCOUT_REPORT as unknown as ScoutReport,
      archaeologist: EMPTY_ARCHAEOLOGIST_REPORT as unknown as ArchaeologistReport,
      detective: EMPTY_DETECTIVE_REPORT as unknown as DetectiveReport,
      architect: EMPTY_ARCHITECT_REPORT as unknown as ArchitectReport,
    }));
    expect(report.technicalDebt).toBeTruthy();
    expect(report.technicalDebtReport).toBeTruthy();
    expect(report.consolidatedSpec).toBeTruthy();
    expect(report.technicalDebtReport).toContain("Maintain");
  });

  it("handles complex multi-language scout scenario", async () => {
    const multiLangScout: ScoutReport = {
      directoryTree: ".\n./src\n./src/main.py\n./src/app.js",
      languages: { py: 10, js: 5, ts: 3 },
      frameworks: [{ name: "Django", evidence: "Config file: manage.py", confidence: "high" }],
      entryPoints: ["src/main.py", "src/app.js"],
      conventions: ["Multi-language project", "Source in src/"],
      markdown: "Multi-language scout report.",
    };
    const report = await runWriter(buildPhases({ scout: multiLangScout }));
    expect(report.technicalDebt).toContain("Multi-language project");
    expect(report.technicalDebt).toContain("3 language types detected");
  });

  it("empty complex files leads to maintain recommendation", async () => {
    const empty: ArchaeologistReport = {
      complexFiles: [], controlFlow: { conditionals: 0, switches: 0, tryCatch: 0, loops: 0 },
      dataStructures: { interfaces: 0, types: 0, classes: 0, enums: 0, records: [] }, markdown: "",
    };
    const report = await runWriter(buildPhases({ archaeologist: empty }));
    expect(report.technicalDebtReport).toContain("Maintain");
  });

  it("empty archaeologist shows no complexity hotspots", async () => {
    const report = await runWriter(buildPhases({ archaeologist: EMPTY_ARCHAEOLOGIST_REPORT as unknown as ArchaeologistReport }));
    expect(report.technicalDebt).toContain("No complexity hotspots detected");
  });

  it("empty detective shows no business rules", async () => {
    const report = await runWriter(buildPhases({ detective: EMPTY_DETECTIVE_REPORT as unknown as DetectiveReport }));
    expect(report.technicalDebt).toContain("No undocumented business rules detected");
  });

  it("empty architect shows no integrations", async () => {
    const report = await runWriter(buildPhases({ architect: EMPTY_ARCHITECT_REPORT as unknown as ArchitectReport }));
    expect(report.technicalDebt).toContain("No integration risks identified");
  });
});
