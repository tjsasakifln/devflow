/**
 * Devflow Renderers -- Markdown Report
 *
 * Produces a complete, professional Markdown PR risk report from an AuditReport.
 * Also exports helpers for verdict/severity emoji and a compact PR snippet.
 */

import { getVersion } from "../kernel/utils/version.js"
import { SEVERITY_ICONS } from "../kernel/renderers/severity-icons.js"
import type {
  AuditReport,
  Severity,
  Verdict,
} from "../core/report-model.js"

// ── Emoji helpers ──

/**
 * Returns a single emoji character that visually represents the given verdict.
 *
 *   PASS    → ✅
 *   WARN    → ⚠️
 *   FAIL    → ❌
 *   BLOCKED → 🚫
 */
export function verdictEmoji(verdict: Verdict): string {
  switch (verdict) {
    case "PASS":
      return "✅"
    case "WARN":
      return "⚠️"
    case "FAIL":
      return "❌"
    case "BLOCKED":
      return "🚫"
  }
}

/**
 * Returns a single emoji character that visually represents the given severity.
 *
 *   CRITICAL → 🔴
 *   HIGH     → 🟠
 *   MEDIUM   → 🟡
 *   LOW      → ⚪
 */
export function severityEmoji(severity: Severity): string {
  return SEVERITY_ICONS[severity] ?? "⚪"
}

/**
 * Returns a severity badge string for use in Markdown tables.
 * Emoji + uppercase severity label.
 */
function severityBadge(severity: Severity): string {
  return `${severityEmoji(severity)} ${severity}`
}

/**
 * Maps a changed-file status to a human-friendly icon.
 */
function statusIcon(status: string): string {
  switch (status) {
    case "added":
      return "➕"
    case "modified":
      return "✏️"
    case "deleted":
      return "🗑️"
    case "renamed":
      return "🔀"
    case "copied":
      return "📋"
    default:
      return "❓"
  }
}

// ── PR Snippet ──

/**
 * Renders a compact, single-line summary suitable for pasting into a
 * GitHub PR description or comment.
 *
 * Format:
 *   [verdict-emoji] **Verdict: VERDICT** — reason | N changed files | N risks | Devflow vX.Y.Z
 */
export function renderPrSnippet(report: AuditReport): string {
  const emoji = verdictEmoji(report.verdict)
  const fileCount = report.changedFiles.length
  const riskCount = report.risks.length
  const sha = report.metadata.commitSha.slice(0, 8)

  const parts: string[] = [
    `${emoji} **Verdict: ${report.verdict}**`,
    report.executiveSummary ? `— ${report.executiveSummary.split(".")[0]}.` : "",
    `| ${fileCount} file${fileCount === 1 ? "" : "s"} changed`,
    `${riskCount} risk${riskCount === 1 ? "" : "s"} identified`,
    `Commit \`${sha}\``,
    `Devflow v${getVersion()}`,
  ]

  return parts.filter(Boolean).join(" ")
}

// ── Full Markdown Report ──

/**
 * Generates a complete, professional Markdown PR risk report.
 *
 * Sections:
 *   1.  Title + metadata line
 *   2.  Verdict banner
 *   3.  Executive Summary
 *   4.  Severity Matrix
 *   5.  Changed Files
 *   6.  Risks Found
 *   7.  Evidence Summary
 *   8.  Evidence Absent
 *   9.  What Could Have Shipped Broken
 *   10. Gates Checklist
 *   11. PR Snippet (collapsible)
 *   12. Footer with badge
 */
export function renderMarkdownReport(report: AuditReport): string {
  const lines: string[] = []
  const m = report.metadata
  const sha = m.commitSha.slice(0, 8)

  // ── 1. Title + metadata ──
  lines.push(`# PR Risk Report — ${m.branch} → ${m.base}`)
  lines.push("")
  lines.push(
    `> **Generated:** ${m.timestamp} | **Commit:** \`${sha}\` | **Branch:** \`${m.branch}\` | **Devflow:** v${getVersion()} | **Mode:** ${m.executionMode}`,
  )
  lines.push("")

  // ── 2. Verdict banner ──
  const vEmoji = verdictEmoji(report.verdict)
  lines.push(`## ${vEmoji} Verdict: ${report.verdict}`)
  lines.push("")
  lines.push(`> ${report.executiveSummary}`)
  lines.push("")

  // ── 3. Executive Summary ──
  lines.push("## Executive Summary")
  lines.push("")
  lines.push(report.executiveSummary)
  lines.push("")

  // ── 4. Severity Matrix ──
  lines.push("## Severity Matrix")
  lines.push("")
  lines.push("| Severity | Count |")
  lines.push("|----------|-------|")
  lines.push(`| ${severityBadge("CRITICAL")} | ${report.severityMatrix.critical} |`)
  lines.push(`| ${severityBadge("HIGH")} | ${report.severityMatrix.high} |`)
  lines.push(`| ${severityBadge("MEDIUM")} | ${report.severityMatrix.medium} |`)
  lines.push(`| ${severityBadge("LOW")} | ${report.severityMatrix.low} |`)
  lines.push("")

  // ── 5. Changed Files ──
  lines.push("## Changed Files")
  lines.push("")
  if (report.changedFiles.length === 0) {
    lines.push("_No files changed._")
  } else {
    lines.push("| Status | File | Language | Risk Level |")
    lines.push("|--------|------|----------|------------|")
    for (const f of report.changedFiles) {
      const icon = statusIcon(f.status)
      const lang = f.language ?? "—"
      const risk = f.riskLevel ? severityBadge(f.riskLevel) : "—"
      const additions = f.additions != null ? `+${f.additions}` : ""
      const deletions = f.deletions != null ? `-${f.deletions}` : ""
      const diffStr = additions || deletions ? ` (${additions}/${deletions})` : ""
      lines.push(
        `| ${icon} ${f.status} | \`${f.path}\`${diffStr} | ${lang} | ${risk} |`,
      )
    }
  }
  lines.push("")

  // ── 6. Risks Found ──
  lines.push("## Risks Found")
  lines.push("")
  if (report.risks.length === 0) {
    lines.push("_No risks identified._")
  } else {
    for (const risk of report.risks) {
      const badge = severityBadge(risk.severity)
      const loc = risk.file ? `\`${risk.file}${risk.line != null ? `:${risk.line}` : ""}\`` : null
      lines.push(`### ${badge} ${risk.category}`)
      lines.push("")
      lines.push(`**Description:** ${risk.description}`)
      lines.push("")
      lines.push(`**Recommendation:** ${risk.recommendation}`)
      if (risk.blocking) {
        lines.push("")
        lines.push("> 🚫 **Blocking** — this risk blocks the current verdict.")
      }
      if (loc) {
        lines.push("")
        lines.push(`**Location:** ${loc}`)
      }
      lines.push("")
    }
  }

  // ── 7. Evidence Summary ──
  lines.push("## Evidence Summary")
  lines.push("")
  if (report.evidences.length === 0) {
    lines.push("_No evidence collected._")
  } else {
    lines.push("| Type | Label | Present | Detail |")
    lines.push("|------|-------|---------|--------|")
    for (const ev of report.evidences) {
      const present = ev.present ? "✅" : "❌"
      const detail = ev.detail ?? "—"
      lines.push(`| ${ev.type} | ${ev.label} | ${present} | ${detail} |`)
    }
  }
  lines.push("")

  // ── 8. Evidence Absent ──
  if (report.missingEvidences.length > 0) {
    lines.push("## Evidence Absent")
    lines.push("")
    lines.push("The following evidence could not be verified:")
    lines.push("")
    for (const missing of report.missingEvidences) {
      lines.push(`- ❌ ${missing}`)
    }
    lines.push("")
  }

  // ── 9. What Could Have Shipped Broken ──
  if (report.whatCouldHaveShippedBroken.length > 0) {
    lines.push("## What Could Have Shipped Broken")
    lines.push("")
    lines.push("Without the gates enforced by this review, the following issues could have reached production:")
    lines.push("")
    for (const scenario of report.whatCouldHaveShippedBroken) {
      lines.push(`- ⚠️ ${scenario}`)
    }
    lines.push("")
  }

  // ── 10. Gates Checklist ──
  lines.push("## Gates Checklist")
  lines.push("")

  const gates: Array<{ label: string; pass: boolean }> = [
    { label: "Feature declared", pass: report.featureId != null },
    { label: "Requirements exist", pass: hasEvidenceByLabel(report, "requirements") },
    { label: "Actions exist", pass: hasEvidenceByLabel(report, "actions") },
    { label: "Implementation logged", pass: hasEvidenceByType(report, "implementation-log") },
    { label: "Adversarial review", pass: hasEvidenceByType(report, "adversarial-review") },
    { label: "Gatekeep approved", pass: hasEvidenceByType(report, "gatekeep") },
    { label: "Test framework", pass: hasEvidenceByType(report, "test-result") },
    { label: "Type checker", pass: hasEvidenceByType(report, "typecheck-result") },
  ]

  lines.push("| Gate | Status |")
  lines.push("|------|--------|")
  for (const gate of gates) {
    lines.push(`| ${gate.label} | ${gate.pass ? "✅" : "❌"} |`)
  }
  lines.push("")

  // ── 11. PR Snippet (collapsible) ──
  lines.push("## PR Snippet")
  lines.push("")
  lines.push("<details>")
  lines.push("<summary>Compact PR summary — click to expand</summary>")
  lines.push("")
  lines.push(renderPrSnippet(report))
  lines.push("")
  lines.push("```")
  lines.push(report.prSnippet || renderPrSnippet(report))
  lines.push("```")
  lines.push("")
  lines.push("</details>")
  lines.push("")

  // ── 12. Footer ──
  lines.push("---")
  lines.push("")
  if (report.devflowGovernedBadge) {
    lines.push(report.devflowGovernedBadge)
  } else {
    lines.push(
      `*Report generated by [Devflow](https://github.com/tjsasakifln/devflow) v${getVersion()} — PR governance for AI-generated code.*`,
    )
  }
  lines.push("")

  return lines.join("\n")
}

// ── Internal helpers ──

/**
 * Returns true when at least one evidence entry with the given type has
 * `present === true`.
 */
function hasEvidenceByType(
  report: AuditReport,
  type: string,
): boolean {
  return report.evidences.some((e) => e.type === type && e.present)
}

/**
 * Returns true when at least one evidence entry with a label containing the
 * given substring has `present === true`.
 */
function hasEvidenceByLabel(
  report: AuditReport,
  labelSubstring: string,
): boolean {
  return report.evidences.some(
    (e) => e.label.toLowerCase().includes(labelSubstring.toLowerCase()) && e.present,
  )
}
