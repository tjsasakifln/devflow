import path from "node:path";
import { atomicWrite, fileExists, safeReadFile } from "../utils/fs.js";
import { DEFAULTS } from "./defaults.js";
import type { DevflowConfig } from "../types/artifacts.js";

export type { DevflowConfig };

export class ConfigManager {
  private configPath: string;

  constructor(rootPath: string) {
    this.configPath = path.join(rootPath, ".devflow", "config.json");
  }

  getDefaults(): DevflowConfig {
    return { ...DEFAULTS };
  }

  async load(): Promise<DevflowConfig> {
    const raw = await safeReadFile(this.configPath);
    if (!raw) {
      return { ...DEFAULTS };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DevflowConfig>;
      return { ...DEFAULTS, ...parsed } as DevflowConfig;
    } catch {
      return { ...DEFAULTS };
    }
  }

  async save(config: DevflowConfig): Promise<void> {
    config.modifiedTimestamp = new Date().toISOString();
    await atomicWrite(this.configPath, JSON.stringify(config, null, 2) + "\n");
  }

  async exists(): Promise<boolean> {
    return fileExists(this.configPath);
  }
}
