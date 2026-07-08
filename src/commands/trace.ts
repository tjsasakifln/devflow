/**
 * Execution Trace Visualizer
 *
 * Reads gatekeep-log.jsonl and implementation-log.jsonl from the audits directory
 * and generates a timeline visual of decisions, actions, gates, and timestamps.
 *
 * Output formats: terminal (default), JSON, HTML
 * JSON output is pipe-safe (printed to stdout).
 * Human-readable output goes to stderr.
 */

import path from "node:path";
import pc from "picocolors";
import { safeReadFile, fileExists } from "../kernel/utils/fs.js";

interface TraceEntry {
  timestamp: string;
  type: "gate" | "action" | "decision" | "review";
  source: "gatekeep-log" | "implementation-log" | "adversarial-review";
  summary: string;
  detail: string;
  status?: string;
  actor?: string;
}

interface TraceResult {
  command: "trace";
  status: "ok" | "no-data" | "error";
  featureId: string;
  entries: TraceEntry[];
  timeline: string;
  summary: {
    total: number;
    gates: number;
    actions: number;
    decisions: number;
    reviews: number;
    timeRange: string;
  };
  error?: string;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return ts;
  }
}

function formatTimestampShort(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toTimeString().slice(0, 8);
  } catch {
    return ts;
  }
}

function relativeTime(ts1: string, ts2: string): string {
  try {
    const ms = new Date(ts2).getTime() - new Date(ts1).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  } catch {
    return "";
  }
}

async function readGatekeepLog(rootPath: string): Promise<TraceEntry[]> {
  const logPath = path.join(rootPath, ".devflow", "audits", "gatekeep-log.jsonl");
  const raw = await safeReadFile(logPath);
  if (!raw) return [];

  const entries: TraceEntry[] = [];
  for (const line of raw.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      entries.push({
        timestamp: entry.timestamp || entry.date || new Date().toISOString(),
        type: "gate",
        source: "gatekeep-log",
        summary: `${entry.verdict || "unknown"}: ${entry.featureId || entry.feature || "unknown"}`,
        detail: `${entry.reason || entry.comment || ""} | Gatekeeper: ${entry.gatekeeper || entry.actor || "unknown"}`,
        status: entry.verdict,
        actor: entry.gatekeeper || entry.actor,
      });
    } catch {
      // Skip malformed lines
    }
  }
  return entries;
}

async function readImplementationLogs(rootPath: string): Promise<TraceEntry[]> {
  const logsDir = path.join(rootPath, ".devflow", "features");
  const entries: TraceEntry[] = [];

  // Try to read from _devflow/features/ directory
  try {
    const { listDir } = await import("../kernel/utils/fs.js");
    if (await fileExists(logsDir)) {
      const featureDirs = await listDir(logsDir);
      for (const featureDir of featureDirs) {
        const implLogPath = path.join(logsDir, featureDir, "implementation-log.jsonl");
        if (await fileExists(implLogPath)) {
          const raw = await safeReadFile(implLogPath);
          if (raw) {
            for (const line of raw.trim().split("\n")) {
              if (!line.trim()) continue;
              try {
                const entry = JSON.parse(line);
                entries.push({
                  timestamp: entry.timestamp || new Date().toISOString(),
                  type: "action",
                  source: "implementation-log",
                  summary: `${entry.actionId || entry.action || "unknown"}: ${entry.status || "unknown"}`,
                  detail: `${entry.description || entry.detail || ""} | Actor: ${entry.actor || entry.author || "unknown"}`,
                  status: entry.status,
                  actor: entry.actor || entry.author,
                });
              } catch {
                // Skip malformed lines
              }
            }
          }
        }
      }
    }
  } catch {
    // Log dir not available
  }

  return entries;
}

async function readAdversarialReviews(rootPath: string): Promise<TraceEntry[]> {
  const auditsDir = path.join(rootPath, ".devflow", "audits");
  const entries: TraceEntry[] = [];

  try {
    const { listDir } = await import("../kernel/utils/fs.js");
    if (await fileExists(auditsDir)) {
      const auditDirs = await listDir(auditsDir);
      for (const dir of auditDirs) {
        const dirPath = path.join(auditsDir, dir);
        if (dir === "gatekeep-log.jsonl") continue;
        const reviewPath = path.join(dirPath, "adversarial-review.md");
        if (await fileExists(reviewPath)) {
          const raw = await safeReadFile(reviewPath);
          if (raw) {
            const dateMatch = raw.match(/> \*\*Date:\*\* (.+)/);
            const verdictMatch = raw.match(/> \*\*Verdict:\*\* (.+)/);
            entries.push({
              timestamp: dateMatch ? dateMatch[1]!.trim() : new Date().toISOString(),
              type: "review",
              source: "adversarial-review",
              summary: `Adversarial Review: ${verdictMatch ? verdictMatch[1]!.trim() : "unknown"} for "${dir}"`,
              detail: `Feature: ${dir} | Report: adversarial-review.md`,
              status: verdictMatch ? verdictMatch[1]!.trim() : undefined,
            });
          }
        }

        // Also check for AI adversarial review
        const aiReviewPath = path.join(dirPath, "adversarial-review-ai.md");
        if (await fileExists(aiReviewPath)) {
          const raw = await safeReadFile(aiReviewPath);
          if (raw) {
            const dateMatch = raw.match(/> \*\*Date:\*\* (.+)/);
            const verdictMatch = raw.match(/> \*\*Verdict:\*\* (.+)/);
            entries.push({
              timestamp: dateMatch ? dateMatch[1]!.trim() : new Date().toISOString(),
              type: "review",
              source: "adversarial-review",
              summary: `AI Adversarial Review: ${verdictMatch ? verdictMatch[1]!.trim() : "unknown"} for "${dir}"`,
              detail: `Feature: ${dir} | AI-powered review`,
              status: verdictMatch ? verdictMatch[1]!.trim() : undefined,
            });
          }
        }
      }
    }
  } catch {
    // Audits dir not available
  }

  return entries;
}

function buildTimeline(entries: TraceEntry[]): string {
  if (entries.length === 0) return "(no entries)";

  // Sort by timestamp
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const lines: string[] = [];
  let prevTs: string | null = null;

  for (const entry of sorted) {
    const time = formatTimestampShort(entry.timestamp);
    const gap = prevTs ? ` (${relativeTime(prevTs, entry.timestamp)})` : "";

    let icon: string;
    let typeLabel: string;

    switch (entry.type) {
      case "gate":
        icon = entry.status === "approved" || entry.status === "PASS" ? "🟢" : "🔴";
        typeLabel = "GATE";
        break;
      case "action":
        icon = entry.status === "completed" || entry.status === "done" ? "⚡" : "⏳";
        typeLabel = "ACTN";
        break;
      case "decision":
        icon = "📋";
        typeLabel = "DECI";
        break;
      case "review":
        icon = entry.status === "PASS" ? "✅" : "❌";
        typeLabel = "REVW";
        break;
      default:
        icon = "•";
        typeLabel = "INFO";
    }

    lines.push(`  ${time} ${icon} [${typeLabel}] ${entry.summary}${gap}`);
    lines.push(`         ${pc.dim(entry.detail)}`);
    prevTs = entry.timestamp;
  }

  return lines.join("\n");
}

function escapeHtml(s: string | undefined | null): string {
  if (s === undefined || s === null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHTMLTimeline(entries: TraceEntry[]): string {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const rows = sorted
    .map((e) => {
      const time = formatTimestamp(e.timestamp);
      return `<tr>
  <td>${time}</td>
  <td><span class="type-${escapeHtml(e.type)}">${escapeHtml(e.type.toUpperCase())}</span></td>
  <td>${escapeHtml(e.summary)}</td>
  <td>${escapeHtml(e.detail)}</td>
  <td>${escapeHtml(e.status)}</td>
  <td>${escapeHtml(e.actor)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Devflow Trace</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 2rem; background: #0d1117; color: #c9d1d9; }
  h1 { color: #58a6ff; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #30363d; }
  th { background: #161b22; color: #8b949e; font-weight: 600; }
  tr:hover { background: #161b22; }
  .type-gate { color: #f0883e; font-weight: bold; }
  .type-action { color: #3fb950; font-weight: bold; }
  .type-decision { color: #d2a8ff; font-weight: bold; }
  .type-review { color: #58a6ff; font-weight: bold; }
</style>
</head>
<body>
<h1>Devflow Execution Trace</h1>
<p>Generated: ${new Date().toISOString()} | ${sorted.length} entries</p>
<table>
<thead><tr><th>Timestamp</th><th>Type</th><th>Summary</th><th>Detail</th><th>Status</th><th>Actor</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>`;
}

export async function traceCommand(
  rootPath: string,
  options: {
    format?: "terminal" | "json" | "html";
    featureId?: string;
  },
): Promise<void> {
  const format = options.format || "terminal";

  // Collect entries from all sources
  const [gateEntries, actionEntries, reviewEntries] = await Promise.all([
    readGatekeepLog(rootPath),
    readImplementationLogs(rootPath),
    readAdversarialReviews(rootPath),
  ]);

  // Filter by feature if specified
  let allEntries = [...gateEntries, ...actionEntries, ...reviewEntries];
  if (options.featureId) {
    const fid = options.featureId.toLowerCase();
    allEntries = allEntries.filter(
      (e) =>
        e.summary.toLowerCase().includes(fid) || e.detail.toLowerCase().includes(fid),
    );
  }

  // Sort by timestamp
  allEntries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (allEntries.length === 0) {
    const result: TraceResult = {
      command: "trace",
      status: "no-data",
      featureId: options.featureId || "all",
      entries: [],
      timeline: "(no trace data found)",
      summary: {
        total: 0,
        gates: 0,
        actions: 0,
        decisions: 0,
        reviews: 0,
        timeRange: "N/A",
      },
    };

    console.error(pc.yellow("\n⚠ No trace data found.\n"));
    console.error(pc.dim("  Devflow generates trace data when you run:\n"));
    console.error(pc.dim("    - devflow gatekeep         → gatekeep-log.jsonl"));
    console.error(pc.dim("    - devflow feature complete → implementation-log.jsonl"));
    console.error(pc.dim("    - devflow adversarial-review → adversarial-review.md\n"));

    if (format === "json") {
      console.log(JSON.stringify(result));
    }
    return;
  }

  // Build summary
  const timeRange =
    allEntries.length >= 2
      ? `${formatTimestamp(allEntries[0]!.timestamp)} → ${formatTimestamp(allEntries[allEntries.length - 1]!.timestamp)}`
      : formatTimestamp(allEntries[0]!.timestamp);

  const summary = {
    total: allEntries.length,
    gates: gateEntries.length,
    actions: actionEntries.length,
    decisions: 0,
    reviews: reviewEntries.length,
    timeRange,
  };

  // Build timeline text
  const timeline = buildTimeline(allEntries);
  const featureId = options.featureId || "all";

  if (format === "json") {
    const result: TraceResult = {
      command: "trace",
      status: "ok",
      featureId,
      entries: allEntries,
      timeline,
      summary,
    };
    console.log(JSON.stringify(result));
    return;
  }

  if (format === "html") {
    const html = buildHTMLTimeline(allEntries);
    console.log(html);
    return;
  }

  // Terminal format — output to stderr
  console.error(pc.bold("\nDevflow Execution Trace\n"));
  console.error(pc.dim("═".repeat(55)));

  console.error(pc.bold("\nSummary:\n"));
  console.error(pc.dim(`  Period:  ${timeRange}`));
  console.error(pc.dim(`  Entries: ${summary.total} (${summary.gates} gates, ${summary.actions} actions, ${summary.reviews} reviews)`));
  console.error(`  Feature: ${featureId}`);
  console.error("");

  console.error(pc.bold("Timeline:\n"));
  console.error(timeline);
  console.error("");
}
