/**
 * devflow drift check — Semantic drift detection between requirements and implementation
 *
 * Compares acceptance criteria (ACs) documented in requirements.md against
 * entries in implementation-log.jsonl to detect:
 *   1. Implemented but not documented (code exists without spec)
 *   2. Documented but not implemented (spec not fulfilled)
 *
 * Two matching modes:
 *   --strict: exact string matching (deterministic, no false positives)
 *   --heuristic: fuzzy word matching (catches more, may have false positives)
 *
 * Output: pipe-safe JSON via stdout, banner via stderr.
 */
import path from "node:path";
import { safeReadFile } from "../kernel/utils/fs.js";
import pc from "picocolors";

export interface DriftCheckResult {
  featureId: string;
  mode: "strict" | "heuristic";
  documentedCount: number;
  implementedCount: number;
  implementedNotDocumented: string[];
  documentedNotImplemented: string[];
  driftRatio: number;
  verdict: "clean" | "drift-detected" | "no-requirements" | "no-implementation-log";
}

interface ImplementationLogEntry {
  timestamp?: string;
  actionId?: string;
  action?: string;
  description?: string;
  status?: string;
  filesChanged?: string[];
  notes?: string;
}

/**
 * Parse acceptance criteria from requirements.md.
 * Looks for:
 *   - Lines starting with "- [ ] AC:" or "- [x] AC:" (acceptance criteria lists)
 *   - Lines starting with "AC:" prefix
 *   - Lines starting with "- " that contain "should" or "must" (spec-like statements)
 *   - Lines under "## Acceptance Criteria" heading
 */
function parseAcceptanceCriteria(content: string): string[] {
  const criteria: string[] = [];
  const lines = content.split("\n");

  let inAcSection = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Track section context
    if (/^##\s+/i.test(trimmed)) {
      inAcSection = /acceptance\s*criteria|ac|requisitos|critérios/i.test(trimmed);
    }

    // Match checklist items that look like ACs: "- [ ] something" or "- [x] something"
    const checklistMatch = trimmed.match(/^-\s*\[[x ]\]\s*(.+)/i);
    if (checklistMatch) {
      const text = checklistMatch[1]!.trim();
      if (text.length > 10) {
        criteria.push(text);
      }
      continue;
    }

    // Match "AC:" prefixed lines
    const acPrefixMatch = trimmed.match(/^AC\d*[:\]]\s*(.+)/i);
    if (acPrefixMatch) {
      criteria.push(acPrefixMatch[1]!.trim());
      continue;
    }

    // In AC section, match bullet points that describe requirements
    if (inAcSection) {
      const bulletMatch = trimmed.match(/^-\s+(.+)/);
      if (bulletMatch) {
        const text = bulletMatch[1]!.trim();
        if (text.length > 10) {
          criteria.push(text);
        }
        continue;
      }
    }
  }

  return [...new Set(criteria)]; // Deduplicate
}

/**
 * Parse implementation-log.jsonl for action entries.
 */
function parseImplementationLog(content: string): ImplementationLogEntry[] {
  const entries: ImplementationLogEntry[] = [];
  const lines = content.trim().split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed) as ImplementationLogEntry;
      entries.push(parsed);
    } catch {
      // Skip malformed JSON lines
      continue;
    }
  }

  return entries;
}

/**
 * Normalize text for comparison — removes punctuation, lowercases,
 * collapses whitespace.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract significant words from text (filters out common stop words).
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can",
    "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "out", "off", "over", "under", "again",
    "further", "then", "once", "here", "there", "when", "where",
    "why", "how", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "and", "but", "or",
    "if", "because", "about", "up", "just",
  ]);

  const words = normalizeText(text).split(" ");
  return words.filter((w) => w.length > 2 && !stopWords.has(w));
}

/**
 * Calculate Jaccard similarity between two keyword sets.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Check if an AC is matched by an implementation entry.
 */
function isAcImplemented(
  acText: string,
  entries: ImplementationLogEntry[],
  mode: "strict" | "heuristic",
): boolean {
  const acNorm = normalizeText(acText);
  const acKeywords = mode === "heuristic" ? extractKeywords(acText) : [];

  for (const entry of entries) {
    // Build a combined string from all entry fields
    const entryText = [
      entry.action,
      entry.description,
      entry.actionId,
      entry.notes,
    ]
      .filter(Boolean)
      .join(" ");

    if (!entryText) continue;

    if (mode === "strict") {
      // Exact substring match
      if (normalizeText(entryText).includes(acNorm)) {
        return true;
      }
    } else {
      // Heuristic: Jaccard similarity on keywords
      const entryKeywords = extractKeywords(entryText);
      const similarity = jaccardSimilarity(acKeywords, entryKeywords);
      if (similarity >= 0.3) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if an implementation entry is documented in the ACs.
 */
function isEntryDocumented(
  entry: ImplementationLogEntry,
  acs: string[],
  mode: "strict" | "heuristic",
): boolean {
  const entryText = [entry.action, entry.description, entry.actionId, entry.notes]
    .filter(Boolean)
    .join(" ");
  if (!entryText) return false;

  const entryNorm = normalizeText(entryText);
  const entryKeywords = mode === "heuristic" ? extractKeywords(entryText) : [];

  for (const ac of acs) {
    if (mode === "strict") {
      if (entryNorm.includes(normalizeText(ac)) || normalizeText(ac).includes(entryNorm)) {
        return true;
      }
    } else {
      const acKeywords = extractKeywords(ac);
      const similarity = jaccardSimilarity(entryKeywords, acKeywords);
      if (similarity >= 0.3) {
        return true;
      }
    }
  }

  return false;
}

export async function driftCheckCommand(
  cwd: string,
  featureId: string,
  options: { strict?: boolean; heuristic?: boolean } = {},
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const featureDir = path.join(rootPath, "_devflow", "features", featureId);

  // Determine mode: default is heuristic unless --strict is explicitly passed
  const mode: "strict" | "heuristic" =
    options.strict === true ? "strict" : "heuristic";

  // Load requirements.md
  const reqPath = path.join(featureDir, "requirements.md");
  const reqContent = await safeReadFile(reqPath);

  if (!reqContent) {
    const result: DriftCheckResult = {
      featureId,
      mode,
      documentedCount: 0,
      implementedCount: 0,
      implementedNotDocumented: [],
      documentedNotImplemented: [],
      driftRatio: 1,
      verdict: "no-requirements",
    };

    console.log(JSON.stringify(result, null, 2));

    console.error(
      pc.yellow(`\n${pc.bold("Devflow Drift Check")}`),
    );
    console.error(pc.yellow(`  Feature: ${featureId}`));
    console.error(pc.red("  No requirements.md found.\n"));
    return;
  }

  // Load implementation-log.jsonl
  const implLogPath = path.join(featureDir, "implementation-log.jsonl");
  const implLogContent = await safeReadFile(implLogPath);

  if (!implLogContent) {
    const result: DriftCheckResult = {
      featureId,
      mode,
      documentedCount: 0,
      implementedCount: 0,
      implementedNotDocumented: [],
      documentedNotImplemented: [],
      driftRatio: 1,
      verdict: "no-implementation-log",
    };

    console.log(JSON.stringify(result, null, 2));

    console.error(
      pc.yellow(`\n${pc.bold("Devflow Drift Check")}`),
    );
    console.error(pc.yellow(`  Feature: ${featureId}`));
    console.error(pc.red("  No implementation-log.jsonl found.\n"));
    return;
  }

  // Parse both files
  const acs = parseAcceptanceCriteria(reqContent);
  const entries = parseImplementationLog(implLogContent);

  // Detect: documented but not implemented
  const documentedNotImplemented: string[] = [];
  for (const ac of acs) {
    if (!isAcImplemented(ac, entries, mode)) {
      documentedNotImplemented.push(ac);
    }
  }

  // Detect: implemented but not documented
  const implementedNotDocumented: string[] = [];
  for (const entry of entries) {
    if (!isEntryDocumented(entry, acs, mode)) {
      const desc = entry.description || entry.action || entry.actionId || "";
      if (desc) {
        implementedNotDocumented.push(desc);
      }
    }
  }

  const totalItems = Math.max(acs.length + entries.length, 1);
  const driftItems = documentedNotImplemented.length + implementedNotDocumented.length;
  const driftRatio = driftItems / totalItems;

  let verdict: DriftCheckResult["verdict"] = "clean";
  if (driftItems > 0) {
    verdict = "drift-detected";
  }

  const result: DriftCheckResult = {
    featureId,
    mode,
    documentedCount: acs.length,
    implementedCount: entries.length,
    implementedNotDocumented,
    documentedNotImplemented,
    driftRatio,
    verdict,
  };

  // JSON output to stdout (pipe-safe)
  console.log(JSON.stringify(result, null, 2));

  // Banner to stderr
  console.error(
    pc.bold("\nDevflow Drift Check"),
  );
  console.error(pc.dim(`  Feature: ${result.featureId}`));
  console.error(pc.dim(`  Mode: ${result.mode}`));
  console.error("");

  if (verdict === "drift-detected") {
    console.error(
      pc.yellow(`  ${pc.bold("Drift detected!")} ${driftItems} item(s) out of sync:`),
    );

    if (result.documentedNotImplemented.length > 0) {
      console.error(pc.red(`\n  Documented but not implemented (${result.documentedNotImplemented.length}):`));
      for (const item of result.documentedNotImplemented) {
        console.error(pc.red(`    ✗ ${item.slice(0, 100)}${item.length > 100 ? "..." : ""}`));
      }
    }

    if (result.implementedNotDocumented.length > 0) {
      console.error(pc.yellow(`\n  Implemented but not documented (${result.implementedNotDocumented.length}):`));
      for (const item of result.implementedNotDocumented) {
        console.error(pc.yellow(`    ? ${item.slice(0, 100)}${item.length > 100 ? "..." : ""}`));
      }
    }

    console.error(pc.dim(`\n  Drift ratio: ${(result.driftRatio * 100).toFixed(1)}%`));
  } else {
    console.error(pc.green("  No drift detected. Requirements and implementation are in sync."));
    console.error(pc.dim(`  ${result.documentedCount} ACs, ${result.implementedCount} log entries — all matched.`));
  }

  console.error("");
}
