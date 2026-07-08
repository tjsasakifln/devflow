import path from "node:path";
import { fileExists, isDirectory } from "../../kernel/utils/fs.js";

export interface ScannerResult {
  hasPackageJson: boolean;
  hasSrcDir: boolean;
  hasTestDir: boolean;
  hasTsConfig: boolean;
  packageManager: "npm" | "yarn" | "pnpm" | null;
  detectedFramework: string | null;
  language: string | null;
  fileCount: number;
}

export async function scanFiles(rootPath: string): Promise<ScannerResult> {
  // Parallelize independent file existence checks
  const [hasPackageJson, hasSrcDir, hasTestDir, hasTsConfig, pkgMgrResult, frameworkResult, langResult] = await Promise.all([
    fileExists(path.join(rootPath, "package.json")),
    isDirectory(path.join(rootPath, "src")),
    isDirectory(path.join(rootPath, "test")),
    fileExists(path.join(rootPath, "tsconfig.json")),
    detectPackageManager(rootPath),
    detectFramework(rootPath),
    detectLanguage(rootPath),
  ]);

  const packageManager = pkgMgrResult;
  const detectedFramework = frameworkResult;
  const language = langResult;

  // approximate file count (non-recursive for perf) — run directory checks in parallel
  const dirChecks = await Promise.all(
    ["src", "lib", "app", "components", "pages"].map(async (dir) => {
      const dirPath = path.join(rootPath, dir);
      const exists = await isDirectory(dirPath);
      return exists ? countFilesShallow(dirPath) : 0;
    })
  );
  let fileCount = dirChecks.reduce((sum, c) => sum + c, 0);

  return {
    hasPackageJson,
    hasSrcDir,
    hasTestDir,
    hasTsConfig,
    packageManager,
    detectedFramework,
    language,
    fileCount,
  };
}

async function detectPackageManager(
  rootPath: string
): Promise<"npm" | "yarn" | "pnpm" | null> {
  if (await fileExists(path.join(rootPath, "pnpm-lock.yaml"))) return "pnpm";
  if (await fileExists(path.join(rootPath, "yarn.lock"))) return "yarn";
  if (await fileExists(path.join(rootPath, "package-lock.json"))) return "npm";
  if (await fileExists(path.join(rootPath, "package.json"))) return "npm";
  return null;
}

async function detectFramework(rootPath: string): Promise<string | null> {
  if (await fileExists(path.join(rootPath, "next.config.js"))) return "nextjs";
  if (await fileExists(path.join(rootPath, "next.config.ts"))) return "nextjs";
  if (await fileExists(path.join(rootPath, "next.config.mjs"))) return "nextjs";
  if (await fileExists(path.join(rootPath, "nuxt.config.ts"))) return "nuxt";
  if (await fileExists(path.join(rootPath, "svelte.config.js"))) return "svelte";
  if (await fileExists(path.join(rootPath, "astro.config.mjs"))) return "astro";
  if (await fileExists(path.join(rootPath, "remix.config.js"))) return "remix";
  if (await fileExists(path.join(rootPath, "vite.config.ts"))) return "vite";
  if (await fileExists(path.join(rootPath, "vite.config.js"))) return "vite";
  if (await fileExists(path.join(rootPath, "angular.json"))) return "angular";
  if (await fileExists(path.join(rootPath, "nest-cli.json"))) return "nestjs";
  if (await fileExists(path.join(rootPath, "Dockerfile"))) return "dockerized";
  return null;
}

async function detectLanguage(rootPath: string): Promise<string | null> {
  if (await fileExists(path.join(rootPath, "tsconfig.json")))
    return "typescript";
  if (await fileExists(path.join(rootPath, "package.json")))
    return "javascript";
  if (await fileExists(path.join(rootPath, "pyproject.toml"))) return "python";
  if (await fileExists(path.join(rootPath, "requirements.txt"))) return "python";
  if (await fileExists(path.join(rootPath, "setup.py"))) return "python";
  if (await fileExists(path.join(rootPath, "Cargo.toml"))) return "rust";
  if (await fileExists(path.join(rootPath, "go.mod"))) return "go";
  if (await fileExists(path.join(rootPath, "Gemfile"))) return "ruby";
  return null;
}

async function countFilesShallow(dirPath: string): Promise<number> {
  // count only top-level files — fast for detection
  let count = 0;
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) count++;
      if (entry.isDirectory()) count += await countFilesShallow(
        path.join(dirPath, entry.name)
      );
    }
  } catch {
    // ignore
  }
  return count;
}
