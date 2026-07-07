import { describe, it, expect } from "vitest";
import { renderMarkdownReport, renderPrSnippet, verdictEmoji, severityEmoji } from "../../src/renderers/markdown.js";
import { renderHtmlReport } from "../../src/renderers/html.js";
import { renderJsonReport } from "../../src/renderers/json.js";
import { devflowGovernedMarkdownBadge, devflowGovernedHtmlBadge, devflowGovernedSvgBadge } from "../../src/renderers/badges.js";
import type { AuditReport } from "../../src/core/report-model.js";

// Build a minimal valid report for testing
function makeReport(overrides: Partial<AuditReport> = {}): AuditReport {
  return {
    verdict: "WARN",
    executiveSummary: "3 risks found, none blocking.",
    severityMatrix: { critical: 0, high: 1, medium: 1, low: 1 },
    changedFiles: [{ path: "src/test.ts", status: "modified", language: "TypeScript", riskLevel: "HIGH" }],
    risks: [
      { severity: "HIGH", category: "security", description: "Hardcoded secret", recommendation: "Use env var", blocking: true, file: "src/test.ts", line: 10 },
      { severity: "MEDIUM", category: "code-quality", description: "TODO without ticket", recommendation: "Add ticket ref", blocking: false, file: "src/test.ts", line: 5 },
      { severity: "LOW", category: "governance", description: "No feature declared", recommendation: "Create feature", blocking: false },
    ],
    evidences: [
      { type: "test-result", label: "Test Framework", present: true, detail: "vitest" },
      { type: "lint-result", label: "Linter", present: false, detail: "No linter detected" },
    ],
    missingEvidences: ["No linter detected"],
    metadata: {
      devflowVersion: "0.4.1",
      timestamp: "2026-07-07T00:00:00.000Z",
      commitSha: "abc12345",
      branch: "feature/test",
      base: "main",
      executionMode: "local",
      workingTreeClean: true,
    },
    whatCouldHaveShippedBroken: ["HIGH: Hardcoded secret would reach production silently"],
    devflowGovernedBadge: devflowGovernedMarkdownBadge(),
    featureId: null,
    prSnippet: "<details><summary>⚠️ Devflow Audit: WARN</summary>...</details>",
    ...overrides,
  };
}

describe("Markdown Renderer", () => {
  it("should produce markdown with verdict", () => {
    const report = makeReport();
    const md = renderMarkdownReport(report);
    expect(md).toContain("WARN");
    expect(md).toContain("Severity Matrix");
    expect(md).toContain("Changed Files");
    expect(md).toContain("src/test.ts");
    expect(md).toContain("What Could Have Shipped Broken");
    expect(md).toContain("Devflow Governed");
  });

  it("should produce PR snippet", () => {
    const report = makeReport();
    const snippet = renderPrSnippet(report);
    expect(snippet).toContain("WARN");
  });

  it("verdictEmoji returns correct emoji", () => {
    expect(verdictEmoji("PASS")).toBe("✅");
    expect(verdictEmoji("WARN")).toBe("⚠️");
    expect(verdictEmoji("FAIL")).toBe("❌");
    expect(verdictEmoji("BLOCKED")).toBe("🚫");
  });

  it("severityEmoji returns correct emoji", () => {
    expect(severityEmoji("CRITICAL")).toBe("🔴");
    expect(severityEmoji("HIGH")).toBe("🟠");
    expect(severityEmoji("MEDIUM")).toBe("🟡");
    expect(severityEmoji("LOW")).toBe("🔵");
  });

  it("should include gates checklist", () => {
    const report = makeReport();
    const md = renderMarkdownReport(report);
    expect(md).toContain("Gates Checklist");
    expect(md).toContain("Feature declared");
    expect(md).toContain("Test framework");
  });

  it("should handle empty changed files", () => {
    const report = makeReport({ changedFiles: [] });
    const md = renderMarkdownReport(report);
    expect(md).toContain("No files changed");
  });

  it("should handle empty risks", () => {
    const report = makeReport({ risks: [], severityMatrix: { critical: 0, high: 0, medium: 0, low: 0 }, verdict: "PASS", executiveSummary: "No risks found." });
    const md = renderMarkdownReport(report);
    expect(md).toContain("No risks identified");
  });
});

describe("HTML Renderer", () => {
  it("should produce valid HTML document", () => {
    const report = makeReport();
    const html = renderHtmlReport(report);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("WARN");
    expect(html).toContain("Severity Matrix");
    expect(html).toContain("details");
    expect(html).toContain("dc2626"); // CRITICAL color
    expect(html).toContain("Devflow Governed");
  });

  it("should include inline CSS", () => {
    const report = makeReport();
    const html = renderHtmlReport(report);
    expect(html).toContain("<style>");
    expect(html).toContain("</style>");
  });

  it("should include copy-to-clipboard button", () => {
    const report = makeReport();
    const html = renderHtmlReport(report);
    expect(html).toContain("copySnippet");
    expect(html).toContain("Copy to clipboard");
  });

  it("should handle PASS verdict gracefully", () => {
    const report = makeReport({ verdict: "PASS", executiveSummary: "All checks passed.", severityMatrix: { critical: 0, high: 0, medium: 0, low: 0 }, risks: [], whatCouldHaveShippedBroken: ["No dangerous patterns detected"], missingEvidences: [] });
    const html = renderHtmlReport(report);
    // PASS should appear in content (not just in CSS class names)
    const bodyContent = html.split("</style>")[1] ?? html;
    expect(bodyContent).toContain("PASS");
    // Verify the PASS verdict banner class is present
    expect(html).toContain('class="verdict-banner verdict-PASS"');
  });

  it("should include escped HTML in snippet", () => {
    const report = makeReport();
    const html = renderHtmlReport(report);
    expect(html).toContain("&lt;");
  });
});

describe("JSON Renderer", () => {
  it("should produce valid JSON with $schema", () => {
    const report = makeReport();
    const json = renderJsonReport(report);
    const parsed = JSON.parse(json);
    expect(parsed.$schema).toBeDefined();
    expect(parsed.verdict).toBe("WARN");
    expect(parsed.severityMatrix.critical).toBe(0);
    expect(parsed.severityMatrix.high).toBe(1);
  });

  it("should include all report fields", () => {
    const report = makeReport();
    const json = renderJsonReport(report);
    const parsed = JSON.parse(json);
    expect(parsed.risks).toHaveLength(3);
    expect(parsed.evidences).toHaveLength(2);
    expect(parsed.changedFiles).toHaveLength(1);
    expect(parsed.metadata.branch).toBe("feature/test");
  });

  it("should produce valid JSON syntax", () => {
    const report = makeReport();
    const json = renderJsonReport(report);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe("Badge Renderers", () => {
  it("should produce markdown badge", () => {
    const badge = devflowGovernedMarkdownBadge();
    expect(badge).toContain("Devflow");
    expect(badge).toContain("Governed");
  });

  it("should produce HTML badge", () => {
    const badge = devflowGovernedHtmlBadge();
    expect(badge.length).toBeGreaterThan(0);
    expect(badge).toContain("Devflow");
    expect(badge).toContain("Governed");
    expect(badge).toContain("span");
  });

  it("should produce SVG badge", () => {
    const badge = devflowGovernedSvgBadge();
    expect(badge).toContain("<svg");
    expect(badge).toContain("Devflow");
    expect(badge).toContain("Governed");
    expect(badge).toContain("xmlns");
  });
});
