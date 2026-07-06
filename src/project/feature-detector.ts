import path from "node:path";
import { fileExists, listDir, safeReadFile } from "../utils/fs.js";
import type { FeatureInfo, ActiveFeatureData } from "../types/index.js";

export async function detectFeatures(
  _rootPath: string,
  devArtifactsPath: string
): Promise<FeatureInfo[]> {
  const featuresDir = path.join(devArtifactsPath, "features");
  const entries = await listDir(featuresDir);
  const features: FeatureInfo[] = [];

  for (const entry of entries) {
    const dir = path.join(featuresDir, entry);
    if (
      !(await import("node:fs/promises").then((fs) =>
        fs.stat(dir).then((s) => s.isDirectory()).catch(() => false)
      ))
    ) {
      continue;
    }

    const feature = await scanFeature(dir, entry);
    features.push(feature);
  }

  return features;
}

export async function getActiveFeature(
  rootPath: string,
  features: FeatureInfo[]
): Promise<FeatureInfo | null> {
  const activeFile = path.join(rootPath, ".devflow", "active-feature.json");
  const raw = await safeReadFile(activeFile);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as ActiveFeatureData;
    return features.find((f) => f.id === data.featureId) ?? null;
  } catch {
    return null;
  }
}

export async function scanFeature(
  featureDir: string,
  id: string
): Promise<FeatureInfo> {
  const [
    hasRequirements,
    hasClarification,
    hasQualityAudit,
    hasRoadmap,
    hasActions,
    hasInvestigation,
    hasDataDelta,
    hasQaReport,
    hasLegacyImpact,
    hasRegressionWatch,
    hasReleaseNotes,
    hasImplementationLog,
    hasTestPlan,
  ] = await Promise.all([
    fileExists(path.join(featureDir, "requirements.md")),
    fileExists(path.join(featureDir, "clarification.md")),
    fileExists(path.join(featureDir, "quality-audit.md")),
    fileExists(path.join(featureDir, "roadmap.md")),
    fileExists(path.join(featureDir, "actions.md")),
    fileExists(path.join(featureDir, "investigation.md")),
    fileExists(path.join(featureDir, "data-delta.md")),
    fileExists(path.join(featureDir, "qa-report.md")),
    fileExists(path.join(featureDir, "legacy-impact.md")),
    fileExists(path.join(featureDir, "regression-watch.md")),
    fileExists(path.join(featureDir, "release-notes.md")),
    fileExists(path.join(featureDir, "implementation-log.jsonl")),
    fileExists(path.join(featureDir, "test-plan.md")),
  ]);

  let requirementsDoubts = false;
  let actionsCompletionRatio = 0;

  if (hasRequirements) {
    const content = await safeReadFile(
      path.join(featureDir, "requirements.md")
    );
    if (content) {
      requirementsDoubts = content.includes("[DOUBT]");
    }
  }

  if (hasActions) {
    const content = await safeReadFile(path.join(featureDir, "actions.md"));
    if (content) {
      const total = (content.match(/\[ \]/g) || []).length;
      const done = (content.match(/\[X\]/g) || []).length;
      const all = total + done;
      actionsCompletionRatio = all > 0 ? done / all : 0;
    }
  }

  return {
    id,
    directory: featureDir,
    hasRequirements,
    hasClarification,
    hasQualityAudit,
    hasRoadmap,
    hasActions,
    hasInvestigation,
    hasDataDelta,
    hasQaReport,
    hasLegacyImpact,
    hasRegressionWatch,
    hasReleaseNotes,
    hasImplementationLog,
    hasTestPlan,
    requirementsDoubts,
    actionsCompletionRatio,
    isActive: false,
  };
}
