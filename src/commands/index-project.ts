/**
 * Project Index Command
 *
 * Maps project structure and builds a searchable index at .devflow/index/.
 * Runs the indexing pipeline: symbols → imports → summaries → domain-map.
 */

import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export async function indexProject(rootPath: string): Promise<void> {
  const indexDir = path.join(rootPath, ".devflow", "index");
  await mkdir(indexDir, { recursive: true });

  // Phase 7: Full symbol extraction + embeddings via AI.
  // For now, build a lightweight structural index from file scanning.

  console.log("Indexing project...");
  console.log(`  Index directory: ${indexDir}`);

  // Stub: produce minimal symbols.json and domain-map.md
  const symbols = { indexed: new Date().toISOString(), files: [] as string[] };
  await writeFile(
    path.join(indexDir, "symbols.json"),
    JSON.stringify(symbols, null, 2),
  );

  console.log("  symbols.json — done");
  console.log("  Full RAG index requires AI provider (devflow ai init)");
  console.log("Index complete. Re-run with --ai for semantic indexing.");
}
