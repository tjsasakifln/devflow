import path from "node:path";
import { fileExists } from "../utils/fs.js";
import { scanFiles } from "./file-scanner.js";
import { inspectGit } from "./git-inspector.js";
import { detectFeatures, getActiveFeature } from "./feature-detector.js";
import type { ProjectInspection } from "../types/index.js";

export async function inspectProject(
  rootPath: string
): Promise<ProjectInspection> {
  const resolvedRoot = path.resolve(rootPath);
  const scanner = await scanFiles(resolvedRoot);
  const git = inspectGit(resolvedRoot);

  const hasDotDevflow = await fileExists(
    path.join(resolvedRoot, ".devflow", "config.json")
  );
  const devArtifactsPath = path.join(resolvedRoot, "_devflow");
  const hasDevArtifacts = await fileExists(devArtifactsPath);
  const hasDevflowMd = await fileExists(path.join(resolvedRoot, "DEVFLOW.md"));
  const hasClaudeMd = await fileExists(
    path.join(resolvedRoot, "CLAUDE.md")
  );

  const features = hasDevArtifacts
    ? await detectFeatures(resolvedRoot, devArtifactsPath)
    : [];
  const activeFeature = hasDotDevflow
    ? await getActiveFeature(resolvedRoot, features)
    : null;

  if (activeFeature) {
    features.forEach((f) => {
      f.isActive = f.id === activeFeature.id;
    });
  }

  return {
    rootPath: resolvedRoot,
    hasGit: git.hasGit,
    hasRemote: git.hasRemote,
    currentBranch: git.currentBranch,
    packageManager: scanner.packageManager,
    hasPackageJson: scanner.hasPackageJson,
    hasSrcDir: scanner.hasSrcDir,
    hasDotDevflow,
    hasDevArtifacts,
    hasDevflowMd,
    hasClaudeMd,
    activeFeature,
    features,
    detectedFramework: scanner.detectedFramework,
    language: scanner.language,
    fileCount: scanner.fileCount,
    gitStatus: git.gitStatus,
    lastModifiedTimestamp: Date.now(),
  };
}
