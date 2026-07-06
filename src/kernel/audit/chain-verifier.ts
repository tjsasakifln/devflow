/**
 * Gatekeep Log Chain Verifier
 *
 * Each gatekeep log entry carries a hash of the previous entry,
 * forming a tamper-evident chain. This module verifies chain integrity
 * and detects removed, edited, or inserted entries.
 */

import { createHash } from "node:crypto";
import { safeReadFile } from "../utils/fs.js";
import path from "node:path";

// ── Types ──

export interface ChainedGatekeepEntry {
  // Core fields (existing)
  timestamp: string;
  gatekeeper: string;
  implementer: string;
  featureId: string;
  decision: "approved" | "rejected";
  reason?: string;
  dodChecksPassed: number;
  dodChecksTotal: number;
  ciStatus: string;
  actorOrigin: string;
  commitSha?: string;
  branch?: string;
  devflowVersion?: string;
  executionMode?: string;
  allBlockingPassed: boolean;

  // Chain fields (new)
  actorId?: string;
  machineId?: string;
  gitUserEmailHash?: string;
  previousLogHash: string;
  entryHash: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  totalEntries: number;
  brokenLinks: number[];
  tamperedEntries: number[];
  missingHashes: number[];
}

// ── Hashing ──

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Compute the hash of a log entry excluding its entryHash field. */
export function computeEntryHash(entry: Omit<ChainedGatekeepEntry, "entryHash">): string {
  const { entryHash: _, ...rest } = entry as ChainedGatekeepEntry;
  return sha256(JSON.stringify(rest, Object.keys(rest).sort()));
}

/** Get machine fingerprint (hash of hostname + platform). */
export function getMachineFingerprint(): string {
  const fingerprint =
    process.env.HOSTNAME || process.env.COMPUTERNAME || "unknown";
  return sha256(`${fingerprint}:${process.platform}`);
}

// ── Chain Verification ──

/**
 * Verify the integrity of a gatekeep JSONL log.
 *
 * Checks that each entry's entryHash matches its content,
 * and that each entry's previousLogHash matches the previous entry's entryHash.
 */
export async function verifyGatekeepChain(
  rootPath: string,
): Promise<ChainVerificationResult> {
  const logPath = path.join(rootPath, ".devflow", "audits", "gatekeep-log.jsonl");
  const raw = await safeReadFile(logPath);

  if (!raw || raw.trim().length === 0) {
    return {
      valid: true,
      totalEntries: 0,
      brokenLinks: [],
      tamperedEntries: [],
      missingHashes: [],
    };
  }

  const lines = raw.trim().split("\n").filter((l) => l.trim());
  const entries: ChainedGatekeepEntry[] = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip malformed lines — not a chain violation
    }
  }

  const brokenLinks: number[] = [];
  const tamperedEntries: number[] = [];
  const missingHashes: number[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;

    // Check that entry hash is present
    if (!entry.entryHash) {
      missingHashes.push(i);
      continue;
    }

    // Verify entry hash matches content
    const { entryHash, ...content } = entry;
    const computedHash = computeEntryHash(content as Omit<ChainedGatekeepEntry, "entryHash">);
    if (computedHash !== entryHash) {
      tamperedEntries.push(i);
    }

    // Verify chain link (skip first entry if it has genesis hash)
    if (i > 0) {
      const prevEntry = entries[i - 1]!;
      if (entry.previousLogHash !== prevEntry.entryHash) {
        brokenLinks.push(i);
      }
    }
  }

  return {
    valid: brokenLinks.length === 0 && tamperedEntries.length === 0,
    totalEntries: entries.length,
    brokenLinks,
    tamperedEntries,
    missingHashes,
  };
}

/**
 * Format chain verification result for display.
 */
export function formatChainViolations(result: ChainVerificationResult): string[] {
  const messages: string[] = [];

  if (result.valid) {
    messages.push(`✅ Gatekeep log chain valid (${result.totalEntries} entries)`);
    return messages;
  }

  for (const idx of result.tamperedEntries) {
    messages.push(`🚫 TAMPERED: Entry #${idx + 1} hash does not match content`);
  }
  for (const idx of result.brokenLinks) {
    messages.push(`🔗 BROKEN LINK: Entry #${idx + 1} does not chain to entry #${idx}`);
  }
  for (const idx of result.missingHashes) {
    messages.push(`⚠️  PRE-CHAIN: Entry #${idx + 1} has no hash (pre-dates chain format)`);
  }

  return messages;
}
