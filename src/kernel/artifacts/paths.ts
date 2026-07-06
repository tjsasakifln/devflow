import path from "node:path";
import type { ArtifactPaths } from "../types/artifacts.js";

export function resolvePaths(rootPath: string): ArtifactPaths {
  const dotDevflow = path.join(rootPath, ".devflow");
  const devArtifacts = path.join(rootPath, "_devflow");

  return {
    dotDevflow,
    devArtifacts,
    stateFile: path.join(dotDevflow, "state.json"),
    configFile: path.join(dotDevflow, "config.json"),
    activeFeatureFile: path.join(dotDevflow, "active-feature.json"),
    cockpitFile: path.join(rootPath, "DEVFLOW.md"),
    claudeMdFile: path.join(rootPath, "CLAUDE.md"),
    featureDir: path.join(devArtifacts, "features"),
    specsDir: path.join(devArtifacts, "specs"),
    discoveryDir: path.join(devArtifacts, "discovery"),
  };
}

export function featurePath(
  rootPath: string,
  featureId: string,
  fileName: string
): string {
  return path.join(rootPath, "_devflow", "features", featureId, fileName);
}
