import path from "node:path";
import { atomicWrite, ensureDir, fileExists, safeReadFile } from "../utils/fs.js";
import { sha256 } from "../utils/hash.js";
import { renderTemplate } from "./templates/index.js";
import { resolvePaths } from "./paths.js";
import { logger } from "../utils/logger.js";
import type {
  TemplateId,
  TemplatePayload,
  ArtifactPaths,
  StateData,
  ActiveFeatureData,
  LogEntry,
} from "../types/index.js";

export class ArtifactManager {
  public readonly paths: ArtifactPaths;

  constructor(rootPath: string) {
    this.paths = resolvePaths(rootPath);
  }

  // ── .devflow/ operations ──

  async readState(): Promise<StateData | null> {
    const raw = await safeReadFile(this.paths.stateFile);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StateData;
    } catch {
      return null;
    }
  }

  async writeState(data: StateData): Promise<void> {
    const content = JSON.stringify(data, null, 2) + "\n";
    await this.safeWrite(this.paths.stateFile, content, "state.json");
  }

  async readActiveFeature(): Promise<ActiveFeatureData | null> {
    const raw = await safeReadFile(this.paths.activeFeatureFile);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ActiveFeatureData;
    } catch {
      return null;
    }
  }

  async writeActiveFeature(feature: ActiveFeatureData): Promise<void> {
    const content = JSON.stringify(feature, null, 2) + "\n";
    await this.safeWrite(
      this.paths.activeFeatureFile,
      content,
      "active-feature.json"
    );
  }

  // ── _devflow/ operations ──

  async ensureFeatureDir(
    featureName: string,
    featureId: string
  ): Promise<string> {
    const dir = path.join(this.paths.featureDir, featureId);
    await ensureDir(dir);
    await ensureDir(path.join(dir, "interfaces"));

    // Write requirements.md from template
    const payload: TemplatePayload = {
      featureName,
      featureId,
      timestamp: new Date().toISOString(),
    };
    const reqContent = renderTemplate("requirements", payload);
    await this.safeWrite(
      path.join(dir, "requirements.md"),
      reqContent,
      "requirements.md"
    );

    return dir;
  }

  async writeTemplate(
    id: TemplateId,
    payload: TemplatePayload,
    targetPath: string
  ): Promise<void> {
    const content = renderTemplate(id, payload);
    await this.safeWrite(targetPath, content, path.basename(targetPath));
  }

  async readFeatureFile(
    featureId: string,
    fileName: string
  ): Promise<string | null> {
    const filePath = path.join(
      this.paths.featureDir,
      featureId,
      fileName
    );
    return safeReadFile(filePath);
  }

  async appendImplementationLog(
    featureId: string,
    entry: LogEntry
  ): Promise<void> {
    const filePath = path.join(
      this.paths.featureDir,
      featureId,
      "implementation-log.jsonl"
    );
    const fs = await import("node:fs/promises");
    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(filePath, line, "utf-8");
  }

  // ── Scaffold operations ──

  async scaffoldAll(): Promise<void> {
    await ensureDir(this.paths.dotDevflow);
    await ensureDir(path.join(this.paths.dotDevflow, "decisions"));
    await ensureDir(path.join(this.paths.dotDevflow, "audits"));
    await ensureDir(path.join(this.paths.dotDevflow, "context"));
    await ensureDir(this.paths.devArtifacts);
    await ensureDir(this.paths.discoveryDir);
    await ensureDir(this.paths.specsDir);
    await ensureDir(this.paths.featureDir);
  }

  // ── Utility ──

  async sha256(content: string): Promise<string> {
    return sha256(content);
  }

  async safeWrite(
    filePath: string,
    content: string,
    label: string
  ): Promise<boolean> {
    const exists = await fileExists(filePath);

    if (exists) {
      const existing = await safeReadFile(filePath);
      if (existing) {
        const existingHash = await sha256(existing);
        const newHash = await sha256(content);

        if (existingHash === newHash) {
          logger.debug(`[SKIP] ${label} — content unchanged`);
          return false;
        }
      }

      logger.warn(
        `[OVERWRITE] ${label} — existing file will be replaced. Use --force to skip this warning.`
      );
    }

    await atomicWrite(filePath, content);
    logger.info(`[WRITE] ${label}`);
    return true;
  }

  async fileAge(filePath: string): Promise<number | null> {
    const fs = await import("node:fs/promises");
    try {
      const stat = await fs.stat(filePath);
      return stat.mtimeMs;
    } catch {
      return null;
    }
  }

  async isStale(filePath: string, maxAgeMs: number): Promise<boolean> {
    const age = await this.fileAge(filePath);
    if (age === null) return false;
    return Date.now() - age > maxAgeMs;
  }
}
