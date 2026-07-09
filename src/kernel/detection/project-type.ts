import path from "node:path";
import { fileExists, isDirectory } from "../utils/fs.js";

/**
 * Project type classification.
 * Greenfield = new project, no existing source code.
 * Brownfield = existing codebase, with or without `discover` run.
 */
export type ProjectType = "greenfield" | "brownfield" | "unknown";

/**
 * Detects whether the project at `rootPath` is greenfield or brownfield.
 *
 * Detection rules:
 * - Greenfield: no src/ directory exists AND file count in source dirs is very low (< 5)
 *   AND no existing features with requirements.md
 * - Brownfield: src/ directory exists OR has substantial files OR has run `discover`
 * - Unknown: cannot determine (fallback to brownfield for safety)
 *
 * The `inspection` parameter can optionally provide pre-computed inspection data
 * to avoid duplicate filesystem reads.
 */
export async function detectProjectType(
  rootPath: string,
  inspection?: {
    hasSrcDir?: boolean;
    fileCount?: number;
    hasDevflowMd?: boolean;
    hasDotDevflow?: boolean;
    hasReversaSdd?: boolean;
  },
): Promise<ProjectType> {
  // ── Gather data ──
  const hasSrcDir = inspection?.hasSrcDir ?? (await isDirectory(path.join(rootPath, "src")));
  const fileCount = inspection?.fileCount ?? await countSourceFiles(rootPath);
  const hasDevflowMd = inspection?.hasDevflowMd ?? (await fileExists(path.join(rootPath, "DEVFLOW.md")));
  const hasDotDevflow = inspection?.hasDotDevflow ?? (await fileExists(path.join(rootPath, ".devflow", "config.json")));
  const hasReversaSdd = inspection?.hasReversaSdd ?? (await isDirectory(path.join(rootPath, "_reversa_sdd")));

  // ── Brownfield signals (strong) ──
  if (hasReversaSdd) return "brownfield";
  if (hasSrcDir && fileCount > 0) return "brownfield";
  if (fileCount > 20) return "brownfield";

  // ── Greenfield signals ──
  if (!hasSrcDir && fileCount <= 5 && !hasDotDevflow) {
    return "greenfield";
  }

  // ── Devflow-initialized but no src/ yet ──
  if (hasDevflowMd && !hasSrcDir && fileCount <= 5) {
    return "greenfield";
  }

  // ── Default: unknown → brownfield for safety ──
  return "brownfield";
}

/**
 * Quick count of source files (src/ + lib/ + app/ directories).
 * Non-recursive for speed.
 */
async function countSourceFiles(rootPath: string): Promise<number> {
  const dirsToCheck = ["src", "lib", "app", "components", "pages"];
  let count = 0;

  for (const dir of dirsToCheck) {
    const dirPath = path.join(rootPath, dir);
    if (await isDirectory(dirPath)) {
      try {
        const { readdir } = await import("node:fs/promises");
        const entries = await readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          count++;
          if (entry.isDirectory()) {
            const subEntries = await readdir(path.join(dirPath, entry.name), { withFileTypes: true });
            count += subEntries.filter((e) => e.isFile()).length;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return count;
}
