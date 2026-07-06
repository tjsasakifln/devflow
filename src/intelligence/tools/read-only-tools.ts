/**
 * Read-Only Tools by Role
 *
 * Each tool is strictly scoped to what its role is allowed to read.
 * NO tool writes to src/, .devflow/state.json, or any artifact file.
 * Write operations go through the kernel's promote mechanism.
 */

import { safeReadFile } from "../../kernel/utils/fs.js";

// ── Shared Helpers ──

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    const content = await safeReadFile(filePath);
    return content ?? null;
  } catch {
    return null;
  }
}

// ── Requirements Reviewer ──

export const RequirementsReviewer = {
  role: "requirements-reviewer" as const,
  canWrite: false,

  async readRequirements(featureDir: string): Promise<string | null> {
    return readIfExists(`${featureDir}/requirements.md`);
  },

  async readSpecs(rootPath: string): Promise<string | null> {
    return readIfExists(`${rootPath}/_reversa_sdd/architecture.md`);
  },

  async readDiscovery(rootPath: string): Promise<string | null> {
    return readIfExists(`${rootPath}/.devflow/index/domain-map.md`);
  },
};

// ── Architecture Reviewer ──

export const ArchitectureReviewer = {
  role: "architecture-reviewer" as const,
  canWrite: false,

  async readRoadmap(featureDir: string): Promise<string | null> {
    return readIfExists(`${featureDir}/roadmap.md`);
  },

  async readConstitution(rootPath: string): Promise<string | null> {
    return readIfExists(`${rootPath}/.devflow/constitution.md`);
  },

  async readDependencyGraph(rootPath: string): Promise<string | null> {
    return readIfExists(`${rootPath}/.devflow/index/imports.graph.json`);
  },

  async readSymbols(rootPath: string): Promise<string | null> {
    return readIfExists(`${rootPath}/.devflow/index/symbols.json`);
  },
};

// ── Test Reviewer ──

export const TestReviewer = {
  role: "test-reviewer" as const,
  canWrite: false,

  async readTestPlan(featureDir: string): Promise<string | null> {
    return readIfExists(`${featureDir}/test-plan.md`);
  },

  async readRequirements(featureDir: string): Promise<string | null> {
    return readIfExists(`${featureDir}/requirements.md`);
  },
};

// ── Adversarial Reviewer ──

export const AdversarialReviewer = {
  role: "adversarial-reviewer" as const,
  canWrite: false,

  async readEverything(featureDir: string, rootPath: string): Promise<Record<string, string | null>> {
    const [requirements, roadmap, testPlan, actions, constitution, log] = await Promise.all([
      readIfExists(`${featureDir}/requirements.md`),
      readIfExists(`${featureDir}/roadmap.md`),
      readIfExists(`${featureDir}/test-plan.md`),
      readIfExists(`${featureDir}/actions.md`),
      readIfExists(`${rootPath}/.devflow/constitution.md`),
      readIfExists(`${featureDir}/implementation-log.jsonl`),
    ]);
    return { requirements, roadmap, testPlan, actions, constitution, log };
  },
};

// ── Implementer ──

export const Implementer = {
  role: "implementer" as const,
  canWrite: false, // Can propose patches to temp files only — never mutate src/ directly

  async readAllArtifacts(featureDir: string): Promise<Record<string, string | null>> {
    const [requirements, roadmap, actions, testPlan] = await Promise.all([
      readIfExists(`${featureDir}/requirements.md`),
      readIfExists(`${featureDir}/roadmap.md`),
      readIfExists(`${featureDir}/actions.md`),
      readIfExists(`${featureDir}/test-plan.md`),
    ]);
    return { requirements, roadmap, actions, testPlan };
  },
};
