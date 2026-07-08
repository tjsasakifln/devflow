// =============================================================================
// Parallel Agent Spawner — Default Dimension Definitions
// =============================================================================
// Defines the 6 default analysis dimensions with file filter patterns.
// Dimensions are extensible — users can define custom dimensions via config.
// =============================================================================

import os from "node:os";
import type { DimensionDef } from "./types.js";

/**
 * The 6 predefined analysis dimensions.
 *
 * Each dimension has a set of glob patterns that select which files are
 * relevant. An agent spawned for a given dimension receives ONLY the files
 * matching these patterns.
 */
export const DEFAULT_DIMENSIONS: DimensionDef[] = [
  {
    name: "security",
    description:
      "Security analysis — auth patterns, guards, secrets, and access control",
    globPatterns: ["**/auth/**", "**/guards/**", "**/*.secret*"],
  },
  {
    name: "performance",
    description:
      "Performance analysis — query patterns, benchmarks, and hot paths",
    globPatterns: ["**/*.query*", "**/*.bench*"],
  },
  {
    name: "architecture",
    description:
      "Architecture analysis — kernel structure, patterns, and layering",
    globPatterns: ["**/src/kernel/**", "**/*.architecture*"],
  },
  {
    name: "tests",
    description:
      "Test analysis — test coverage, test patterns, and test quality",
    globPatterns: ["**/*.test.ts", "**/*.spec.ts"],
  },
  {
    name: "docs",
    description:
      "Documentation analysis — markdown files, docs directory, inline docs",
    globPatterns: ["**/*.md", "**/docs/**"],
  },
  {
    name: "deps",
    description:
      "Dependency analysis — package.json, import maps, and external dependencies",
    globPatterns: ["package.json", "**/import*"],
  },
];

/**
 * Get the dimension definition by name.
 * Returns undefined if the dimension is not found.
 */
export function getDimensionByName(name: string): DimensionDef | undefined {
  return DEFAULT_DIMENSIONS.find((d) => d.name === name);
}

/**
 * Resolve dimension definitions from a comma-separated list of names.
 * Throws if any name is not recognized.
 */
export function resolveDimensions(names: string[]): DimensionDef[] {
  const dimensions: DimensionDef[] = [];
  for (const name of names) {
    const def = getDimensionByName(name.trim());
    if (!def) {
      throw new Error(
        `Unknown dimension: "${name.trim()}". ` +
          `Available dimensions: ${DEFAULT_DIMENSIONS.map((d) => d.name).join(", ")}`,
      );
    }
    dimensions.push(def);
  }
  return dimensions;
}

/**
 * Resolve dimensions from a config file path.
 * Expects a JSON or YAML file exporting an array of DimensionDef.
 */
export async function resolveDimensionsFromFile(
  configPath: string,
): Promise<DimensionDef[]> {
  const fs = await import("node:fs/promises");
  const content = await fs.readFile(configPath, "utf-8");

  // Try JSON first
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed.dimensions && Array.isArray(parsed.dimensions)) {
      return parsed.dimensions;
    }
  } catch {
    // Not JSON — try YAML
  }

  // Try YAML
  try {
    const yaml = await import("js-yaml");
    const parsed = yaml.load(content) as Record<string, unknown>;
    if (parsed && Array.isArray(parsed.dimensions)) {
      return parsed.dimensions as DimensionDef[];
    }
  } catch {
    throw new Error(
      `Could not parse dimension config: ${configPath}. ` +
        "Supported formats: JSON with an array of DimensionDef, " +
        'or YAML with a "dimensions" key.',
    );
  }

  throw new Error(
    `Invalid dimension config format in: ${configPath}. ` +
      "Expected an array of { name, description, globPatterns }.",
  );
}

/**
 * Compute the default max parallel agent count.
 * Uses min(16, cpu cores - 2) with a floor of 1.
 */
export function computeDefaultMaxParallel(): number {
  const cpuCount = os.cpus().length;
  return Math.max(1, Math.min(16, cpuCount - 2));
}
