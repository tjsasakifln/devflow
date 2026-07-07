/**
 * StackAdapter Registry
 *
 * Central registry for all language-specific StackAdapters.
 * Provides lookup by language and automatic language detection from file lists.
 */

import type { StackAdapter } from "./types.js";
import { typescriptAdapter } from "./typescript/index.js";
import { pythonAdapter } from "./python/index.js";
import { goAdapter } from "./go/index.js";
import { rustAdapter } from "./rust/index.js";

// ── Registry ──

const adapters: Record<string, StackAdapter> = {
  typescript: typescriptAdapter,
  javascript: typescriptAdapter, // JS uses the same adapter (tsc skipped if no tsconfig)
  python: pythonAdapter,
  go: goAdapter,
  rust: rustAdapter,
};

/**
 * Resolve a StackAdapter for the given language string.
 * Returns `null` when no adapter is registered for the language.
 */
export function getStackAdapter(language: string): StackAdapter | null {
  return adapters[language.toLowerCase()] ?? null;
}

/**
 * Detect unique programming languages from a list of file paths.
 * Uses file extensions to infer the language.
 *
 * Returns the list of unique language identifiers suitable for
 * passing to `getStackAdapter()`.
 */
export function detectStackFromFiles(files: string[]): string[] {
  const languages = new Set<string>();

  for (const file of files) {
    const ext = file.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "ts":
      case "tsx":
      case "mts":
      case "cts":
        languages.add("typescript");
        break;
      case "js":
      case "jsx":
      case "mjs":
      case "cjs":
        languages.add("javascript");
        break;
      case "py":
        languages.add("python");
        break;
      case "go":
        languages.add("go");
        break;
      case "rs":
        languages.add("rust");
        break;
      default:
        // Unknown extension — skip
        break;
    }
  }

  return [...languages];
}

/**
 * Return all registered StackAdapters.
 */
export function getAllAdapters(): StackAdapter[] {
  return Object.values(adapters);
}
