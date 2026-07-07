/**
 * Devflow Renderers -- HTML Report
 *
 * Produces a standalone HTML document from an AuditReport.
 * Includes inline CSS, dark/light mode support, collapsible sections,
 * copy-to-clipboard, print-friendly styles, and responsive layout.
 */

import type { AuditReport, Severity, Verdict } from "../core/report-model.js"
import { verdictEmoji, severityEmoji } from "./markdown.js"

// ── Colour tokens ──

const COLORS = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#2563eb",
  pass: "#16a34a",
  warn: "#ca8a04",
  fail: "#dc2626",
  blocked: "#6b21a8",
  purple: "#6e3af2",
} as const

// ── CSS ──

function inlineCss(): string {
  return `
/* ── Reset & Base ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px}
body{
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;
  color:#1f2937;background:#f9fafb;line-height:1.6;padding:0;-webkit-font-smoothing:antialiased
}
@media(prefers-color-scheme:dark){
  body{color:#e5e7eb;background:#111827}
}
/* ── Layout ── */
.wrap{max-width:900px;margin:0 auto;padding:24px 16px}
@media(min-width:640px){.wrap{padding:40px 24px}}
/* ── Typography ── */
h1{font-size:1.75rem;font-weight:700;margin-bottom:4px}
h2{font-size:1.25rem;font-weight:600;margin-top:32px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e5e7eb}
@media(prefers-color-scheme:dark){h2{border-bottom-color:#374151}}
h3{font-size:1.05rem;font-weight:600;margin-top:20px;margin-bottom:8px}
p{margin-bottom:12px}
a{color:${COLORS.purple};text-decoration:none}
a:hover{text-decoration:underline}
/* ── Meta ── */
.meta{font-size:0.875rem;color:#6b7280;margin-bottom:24px}
@media(prefers-color-scheme:dark){.meta{color:#9ca3af}}
/* ── Verdict Banner ── */
.verdict-banner{
  display:flex;align-items:center;gap:12px;
  padding:16px 20px;border-radius:8px;
  font-size:1.125rem;font-weight:700;margin-bottom:24px;
  border:1px solid
}
.verdict-banner .emoji{font-size:1.5rem}
.verdict-PASS{background:#f0fdf4;color:#166534;border-color:#bbf7d0}
.verdict-WARN{background:#fffbeb;color:#92400e;border-color:#fde68a}
.verdict-FAIL{background:#fef2f2;color:#991b1b;border-color:#fecaca}
.verdict-BLOCKED{background:#faf5ff;color:#581c87;border-color:#e9d5ff}
@media(prefers-color-scheme:dark){
  .verdict-PASS{background:#052e16;color:#86efac;border-color:#166534}
  .verdict-WARN{background:#451a03;color:#fcd34d;border-color:#92400e}
  .verdict-FAIL{background:#450a0a;color:#fca5a5;border-color:#991b1b}
  .verdict-BLOCKED{background:#2e1065;color:#d8b4fe;border-color:#581c87}
}
/* ── Summary ── */
.summary{font-size:1rem;color:#374151;margin-bottom:24px;padding:12px 16px;background:#fff;border-radius:6px;border:1px solid #e5e7eb}
@media(prefers-color-scheme:dark){.summary{color:#d1d5db;background:#1f2937;border-color:#374151}}
/* ── Tables ── */
table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:0.9rem}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #e5e7eb}
th{font-weight:600;background:#f3f4f6;font-size:0.8rem;text-transform:uppercase;letter-spacing:.05em;color:#6b7280}
@media(prefers-color-scheme:dark){
  th,td{border-bottom-color:#374151}
  th{background:#1f2937;color:#9ca3af}
}
tr:last-child td{border-bottom:none}
.code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:0.85em;background:#f3f4f6;padding:2px 5px;border-radius:3px}
@media(prefers-color-scheme:dark){.code{background:#374151}}
/* ── Severity badges ── */
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:700;color:#fff;white-space:nowrap}
.badge-CRITICAL{background:${COLORS.critical}}
.badge-HIGH{background:${COLORS.high}}
.badge-MEDIUM{background:${COLORS.medium}}
.badge-LOW{background:${COLORS.low}}
/* ── Risks ── */
.risk-card{border:1px solid #e5e7eb;border-radius:6px;padding:14px 16px;margin-bottom:12px;background:#fff}
@media(prefers-color-scheme:dark){.risk-card{background:#1f2937;border-color:#374151}}
.risk-card h3{margin-top:0;margin-bottom:6px}
.risk-card .rec{margin-top:6px;font-size:0.9rem;color:#4b5563}
@media(prefers-color-scheme:dark){.risk-card .rec{color:#9ca3af}}
.risk-card .loc{margin-top:4px;font-size:0.85rem}
.risk-blocking{border-left:4px solid ${COLORS.fail};margin-top:8px;padding:6px 10px;background:#fef2f2;border-radius:4px;font-size:0.875rem;font-weight:600;color:#991b1b}
@media(prefers-color-scheme:dark){.risk-blocking{background:#450a0a;color:#fca5a5}}
/* ── Collapsible ── */
details{margin-bottom:12px}
details summary{cursor:pointer;font-weight:600;padding:8px 0;user-select:none}
details summary::-webkit-details-marker{color:#6b7280}
/* ── Copy Button ── */
.copy-btn{
  display:inline-flex;align-items:center;gap:4px;
  padding:6px 14px;font-size:0.8rem;font-weight:600;
  border:1px solid #d1d5db;border-radius:6px;
  background:#fff;color:#374151;cursor:pointer;
  transition:background .15s,color .15s
}
.copy-btn:hover{background:#f3f4f6}
.copy-btn.copied{background:#f0fdf4;color:#166534;border-color:#bbf7d0}
@media(prefers-color-scheme:dark){
  .copy-btn{background:#1f2937;color:#e5e7eb;border-color:#4b5563}
  .copy-btn:hover{background:#374151}
  .copy-btn.copied{background:#052e16;color:#86efac;border-color:#166534}
}
/* ── Snippet box ── */
.snippet-box{
  padding:12px 16px;background:#f3f4f6;border-radius:6px;
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  font-size:0.85rem;line-height:1.5;white-space:pre-wrap;word-break:break-word;
  border:1px solid #e5e7eb;margin:8px 0
}
@media(prefers-color-scheme:dark){.snippet-box{background:#1f2937;border-color:#374151}}
/* ── Badge list ── */
ul,ol{padding-left:24px;margin-bottom:12px}
li{margin-bottom:4px}
/* ── Footer ── */
footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:0.8rem;color:#6b7280}
@media(prefers-color-scheme:dark){footer{border-top-color:#374151;color:#9ca3af}}
/* ── Print ── */
@media print{
  body{background:#fff;color:#000;font-size:12pt}
  .wrap{max-width:100%;padding:0}
  .copy-btn{display:none}
  details[open] summary{margin-bottom:8px}
  details:not([open]){display:block !important}
  details:not([open]) summary{margin-bottom:0}
  details:not([open]) *:not(summary){display:block !important}
  h2{page-break-after:avoid}
  .risk-card{page-break-inside:avoid}
  table{page-break-inside:avoid}
}
`
}

// ── Helpers ──

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

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

function renderSeverityBadge(severity: Severity): string {
  return `<span class="badge badge-${severity}">${severityEmoji(severity)} ${severity}</span>`
}

// ── Sections ──

function renderVerdictBanner(verdict: Verdict): string {
  const emoji = verdictEmoji(verdict)
  return [
    `<div class="verdict-banner verdict-${verdict}">`,
    `  <span class="emoji">${emoji}</span>`,
    `  <span>${escapeHtml(verdict)}</span>`,
    `</div>`,
  ].join("\n")
}

function renderSeverityMatrix(sm: AuditReport["severityMatrix"]): string {
  const rows: Array<[Severity, number]> = [
    ["CRITICAL", sm.critical],
    ["HIGH", sm.high],
    ["MEDIUM", sm.medium],
    ["LOW", sm.low],
  ]
  const tableRows = rows
    .map(
      ([sev, count]) =>
        `      <tr><td>${renderSeverityBadge(sev)}</td><td><strong>${count}</strong></td></tr>`,
    )
    .join("\n")
  return [
    `    <table>`,
    `      <thead><tr><th>Severity</th><th>Count</th></tr></thead>`,
    `      <tbody>`,
    tableRows,
    `      </tbody>`,
    `    </table>`,
  ].join("\n")
}

function renderChangedFiles(files: AuditReport["changedFiles"]): string {
  if (files.length === 0) return "    <p><em>No files changed.</em></p>"
  const rows = files
    .map((f) => {
      const diff =
        f.additions != null || f.deletions != null
          ? ` <span class="code">+${f.additions ?? 0}/-${f.deletions ?? 0}</span>`
          : ""
      const lang = f.language ? escapeHtml(f.language) : "—"
      const risk = f.riskLevel ? renderSeverityBadge(f.riskLevel) : "—"
      return [
        `      <tr>`,
        `        <td>${statusIcon(f.status)} ${f.status}</td>`,
        `        <td><span class="code">${escapeHtml(f.path)}</span>${diff}</td>`,
        `        <td>${lang}</td>`,
        `        <td>${risk}</td>`,
        `      </tr>`,
      ].join("\n")
    })
    .join("\n")
  return [
    `    <table>`,
    `      <thead><tr><th>Status</th><th>File</th><th>Language</th><th>Risk Level</th></tr></thead>`,
    `      <tbody>`,
    rows,
    `      </tbody>`,
    `    </table>`,
  ].join("\n")
}

function renderRisks(risks: AuditReport["risks"]): string {
  if (risks.length === 0) return "    <p><em>No risks identified.</em></p>"
  return risks
    .map((r) => {
      const loc =
        r.file
          ? `<p class="loc"><span class="code">${escapeHtml(r.file)}${r.line != null ? `:${r.line}` : ""}</span></p>`
          : ""
      const blocking = r.blocking
        ? `      <div class="risk-blocking">🚫 Blocking — this risk blocks the current verdict.</div>`
        : ""
      return [
        `    <div class="risk-card">`,
        `      <h3>${renderSeverityBadge(r.severity)} ${escapeHtml(r.category)}</h3>`,
        `      <p><strong>Description:</strong> ${escapeHtml(r.description)}</p>`,
        `      <p class="rec"><strong>Recommendation:</strong> ${escapeHtml(r.recommendation)}</p>`,
        loc,
        blocking,
        `    </div>`,
      ].join("\n")
    })
    .join("\n")
}

function renderEvidenceTable(evidences: AuditReport["evidences"]): string {
  if (evidences.length === 0) return "    <p><em>No evidence collected.</em></p>"
  const rows = evidences
    .map((ev) => {
      const present = ev.present ? "✅" : "❌"
      const detail = ev.detail ? escapeHtml(ev.detail) : "—"
      return [
        `      <tr>`,
        `        <td><span class="code">${ev.type}</span></td>`,
        `        <td>${escapeHtml(ev.label)}</td>`,
        `        <td>${present}</td>`,
        `        <td>${detail}</td>`,
        `      </tr>`,
      ].join("\n")
    })
    .join("\n")
  return [
    `    <table>`,
    `      <thead><tr><th>Type</th><th>Label</th><th>Present</th><th>Detail</th></tr></thead>`,
    `      <tbody>`,
    rows,
    `      </tbody>`,
    `    </table>`,
  ].join("\n")
}

function renderMissingEvidences(missing: string[]): string {
  if (missing.length === 0) return ""
  const items = missing.map((m) => `      <li>❌ ${escapeHtml(m)}</li>`).join("\n")
  return [
    `    <h2>Evidence Absent</h2>`,
    `    <p>The following evidence could not be verified:</p>`,
    `    <ul>`,
    items,
    `    </ul>`,
  ].join("\n")
}

function renderWhatCouldHaveShippedBroken(scenarios: string[]): string {
  if (scenarios.length === 0) return ""
  const items = scenarios.map((s) => `      <li>⚠️ ${escapeHtml(s)}</li>`).join("\n")
  return [
    `    <h2>What Could Have Shipped Broken</h2>`,
    `    <p>Without the gates enforced by this review, the following issues could have reached production:</p>`,
    `    <ul>`,
    items,
    `    </ul>`,
  ].join("\n")
}

function renderGatesChecklist(
  featureId: string | null,
  evidences: AuditReport["evidences"],
): string {
  const gates: Array<{ label: string; pass: boolean }> = [
    { label: "Feature declared", pass: featureId != null },
    { label: "Requirements exist", pass: evidences.some((e) => e.label.toLowerCase().includes("requirement") && e.present) },
    { label: "Actions exist", pass: evidences.some((e) => e.label.toLowerCase().includes("action") && e.present) },
    { label: "Implementation logged", pass: evidences.some((e) => e.type === "implementation-log" && e.present) },
    { label: "Adversarial review", pass: evidences.some((e) => e.type === "adversarial-review" && e.present) },
    { label: "Gatekeep approved", pass: evidences.some((e) => e.type === "gatekeep" && e.present) },
    { label: "Test framework", pass: evidences.some((e) => e.type === "test-result" && e.present) },
    { label: "Type checker", pass: evidences.some((e) => e.type === "typecheck-result" && e.present) },
  ]
  const rows = gates
    .map((g) => `      <tr><td>${escapeHtml(g.label)}</td><td>${g.pass ? "✅" : "❌"}</td></tr>`)
    .join("\n")
  return [
    `    <table>`,
    `      <thead><tr><th>Gate</th><th>Status</th></tr></thead>`,
    `      <tbody>`,
    rows,
    `      </tbody>`,
    `    </table>`,
  ].join("\n")
}

// ── Main render function ──

/**
 * Produces a standalone HTML document from an AuditReport.
 *
 * The output is a complete HTML5 document with:
 *   - Inline CSS (zero external dependencies)
 *   - Dark / light mode via `prefers-color-scheme`
 *   - Verdict banner with colour coding
 *   - Collapsible `<details>` sections
 *   - Severity colour coding matching the colour tokens
 *   - Copy-to-clipboard button for the PR snippet
 *   - Print-friendly styles
 *   - Responsive layout (max-width 900 px, centred)
 *   - Footer with Devflow Governed badge
 */
export function renderHtmlReport(report: AuditReport): string {
  const m = report.metadata
  const sha = m.commitSha.slice(0, 8)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>PR Risk Report — ${escapeHtml(m.branch)} → ${escapeHtml(m.base)}</title>
<style>${inlineCss()}</style>
</head>
<body>
<div class="wrap">

  <h1>PR Risk Report — ${escapeHtml(m.branch)} → ${escapeHtml(m.base)}</h1>
  <p class="meta">Generated: ${escapeHtml(m.timestamp)} &middot; Commit: <span class="code">${sha}</span> &middot; Branch: <span class="code">${escapeHtml(m.branch)}</span> &middot; Devflow v${escapeHtml(m.devflowVersion)} &middot; Mode: ${escapeHtml(m.executionMode)}</p>

  ${renderVerdictBanner(report.verdict)}

  <details open>
  <summary><h2 style="display:inline;border:none;margin:0">Executive Summary</h2></summary>
  <div class="summary">${escapeHtml(report.executiveSummary)}</div>
  </details>

  <details open>
  <summary><h2 style="display:inline;border:none;margin:0">Severity Matrix</h2></summary>
${renderSeverityMatrix(report.severityMatrix)}
  </details>

  <details open>
  <summary><h2 style="display:inline;border:none;margin:0">Changed Files</h2></summary>
${renderChangedFiles(report.changedFiles)}
  </details>

  <details open>
  <summary><h2 style="display:inline;border:none;margin:0">Risks Found</h2></summary>
${renderRisks(report.risks)}
  </details>

  <details open>
  <summary><h2 style="display:inline;border:none;margin:0">Evidence Summary</h2></summary>
${renderEvidenceTable(report.evidences)}
  </details>

${renderMissingEvidences(report.missingEvidences)}

${renderWhatCouldHaveShippedBroken(report.whatCouldHaveShippedBroken)}

  <details open>
  <summary><h2 style="display:inline;border:none;margin:0">Gates Checklist</h2></summary>
${renderGatesChecklist(report.featureId, report.evidences)}
  </details>

  <details>
  <summary><h2 style="display:inline;border:none;margin:0">PR Snippet</h2></summary>
  <div style="display:flex;gap:8px;align-items:center;margin:12px 0;">
    <button class="copy-btn" onclick="copySnippet()">📋 Copy to clipboard</button>
  </div>
  <div id="snippet" class="snippet-box">${escapeHtml(report.prSnippet)}</div>
  </details>

  <footer>
    ${report.devflowGovernedBadge ? report.devflowGovernedBadge : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;"><span style="padding:3px 6px;border-radius:3px 0 0 3px;background:#555;color:#fff;font-weight:600;">Devflow</span><span style="padding:3px 6px;border-radius:0 3px 3px 0;background:${COLORS.purple};color:#fff;font-weight:600;">Governed</span></span>`}
    &middot;
    <a href="https://github.com/tjsasakifln/devflow">github.com/tjsasakifln/devflow</a>
  </footer>

</div>

<script>
function copySnippet(){
  const el=document.getElementById('snippet');
  const txt=el.textContent;
  if(!txt)return;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(function(){
      const btn=document.querySelector('.copy-btn');
      btn.textContent='✅ Copied!';
      btn.classList.add('copied');
      setTimeout(function(){btn.textContent='📋 Copy to clipboard';btn.classList.remove('copied')},2500);
    })
  }else{
    const ta=document.createElement('textarea');
    ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy')}catch(e){}
    document.body.removeChild(ta);
  }
}
</script>

</body>
</html>`
}
