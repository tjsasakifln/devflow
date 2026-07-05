import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw err;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function atomicWrite(
  filePath: string,
  content: string
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function listDir(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

export async function countFiles(dirPath: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += await countFiles(path.join(dirPath, entry.name));
      } else {
        count++;
      }
    }
  } catch {
    // directory doesn't exist — return 0
  }
  return count;
}

export async function getLastModified(dirPath: string): Promise<number> {
  let latest = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subLatest = await getLastModified(fullPath);
        latest = Math.max(latest, subLatest);
      } else {
        const stat = await fs.stat(fullPath);
        latest = Math.max(latest, stat.mtimeMs);
      }
    }
  } catch {
    // ignore
  }
  return latest;
}
