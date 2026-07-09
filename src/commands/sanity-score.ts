/**
 * devflow sanity-score <featureId>
 *
 * Standalone command to compute and display sanity scores for feature artifacts.
 * Also blocks feature-prompt generation when score < 50.
 *
 * Usage:
 *   devflow sanity-score <featureId>
 */

import path from "node:path";
import { ArtifactManager } from "../kernel/artifacts/manager.js";
import { ConfigManager } from "../kernel/config/index.js";
import {
  computeFeatureSanityScores,
  renderSanityScoreSummary,
} from "../kernel/checks/sanity-score.js";
import { fileExists } from "../kernel/utils/fs.js";
import pc from "picocolors";

export interface SanityScoreOptions {
  json?: boolean;
}

const REQUIRED_ARTIFACTS = [
  "requirements.md",
  "roadmap.md",
  "actions.md",
  "test-plan.md",
];

/**
 * Run sanity score check for a feature.
 * Returns the computed result for programmatic use (e.g., by feature-prompt or feature-complete).
 */
export async function runSanityScore(
  rootPath: string,
  featureId: string,
): Promise<{
  overallScore: number;
  overallPassed: boolean;
  failures: string[];
}> {
  const manager = new ArtifactManager(rootPath);
  const configMgr = new ConfigManager(rootPath);
  const config = await configMgr.load();

  if (!config.sanityScore.enabled) {
    return { overallScore: 100, overallPassed: true, failures: [] };
  }

  const featureDir = path.join(manager.paths.featureDir, featureId);
  if (!(await fileExists(featureDir))) {
    return {
      overallScore: 0,
      overallPassed: false,
      failures: [`Feature '${featureId}' not found at ${featureDir}`],
    };
  }

  // Read all artifacts
  const artifacts: Record<string, string | null> = {};
  for (const name of REQUIRED_ARTIFACTS) {
    artifacts[name] = await manager.readFeatureFile(featureId, name);
  }

  const options = {
    minContentDensity: config.sanityScore.minContentDensity / 100,
    minSectionCompletion: config.sanityScore.minSectionCompletion / 100,
    blockingThreshold: config.sanityScore.blockingThreshold,
    customPlaceholderTerms: config.sanityScore.customPlaceholderTerms,
    weights: config.sanityScore.weights,
  };

  const result = computeFeatureSanityScores(artifacts, options);
  return {
    overallScore: result.overallScore,
    overallPassed: result.overallPassed,
    failures: result.failures,
  };
}

/**
 * Main entry point for `devflow sanity-score <featureId>` CLI command.
 */
export async function sanityScoreCommand(
  cwd: string,
  featureId: string,
  options: SanityScoreOptions = {},
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const manager = new ArtifactManager(rootPath);
  const configMgr = new ConfigManager(rootPath);
  const config = await configMgr.load();

  const featureDir = path.join(manager.paths.featureDir, featureId);
  if (!(await fileExists(featureDir))) {
    console.log(pc.red(`Feature '${featureId}' not found.`));
    console.log(pc.dim(`Expected at: ${featureDir}`));
    console.log(pc.dim("Run: devflow feature new <name>"));
    return;
  }

  if (!config.sanityScore.enabled) {
    console.log(pc.yellow("Sanity score check is disabled in config."));
    console.log(pc.dim("Enable via: devflow config set sanityScore.enabled true"));
    return;
  }

  // Read all artifacts
  const artifacts: Record<string, string | null> = {};
  for (const name of REQUIRED_ARTIFACTS) {
    artifacts[name] = await manager.readFeatureFile(featureId, name);
  }

  const scoreOptions = {
    minContentDensity: config.sanityScore.minContentDensity / 100,
    minSectionCompletion: config.sanityScore.minSectionCompletion / 100,
    blockingThreshold: config.sanityScore.blockingThreshold,
    customPlaceholderTerms: config.sanityScore.customPlaceholderTerms,
    weights: config.sanityScore.weights,
  };

  const result = computeFeatureSanityScores(artifacts, scoreOptions);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // ── Terminal output ──

  console.log(pc.bold(`\nDevflow Sanity Score — ${featureId}\n`));

  const missingArtifacts = REQUIRED_ARTIFACTS.filter((name) => !artifacts[name]);
  if (missingArtifacts.length > 0) {
    console.log(pc.yellow(`⚠️  ${missingArtifacts.length} artifact(s) missing: ${missingArtifacts.join(", ")}`));
    console.log();
  }

  console.log(renderSanityScoreSummary(result));

  console.log();
  console.log(pc.dim("Thresholds from config:"));
  console.log(pc.dim(`  Content density minimum: ${config.sanityScore.minContentDensity}%`));
  console.log(pc.dim(`  Section completion minimum: ${config.sanityScore.minSectionCompletion}%`));
  console.log(pc.dim(`  Blocking threshold: ${config.sanityScore.blockingThreshold}/100`));
  console.log();

  if (result.overallPassed) {
    console.log(pc.green(`✅ Sanity score PASSED (${result.overallScore}/100)`));
  } else {
    console.log(pc.red(`❌ Sanity score FAILED (${result.overallScore}/100)`));
    console.log(pc.yellow(`   Score below blocking threshold of ${scoreOptions.blockingThreshold}.`));
    console.log(pc.yellow("   Feature prompt generation will be blocked until score improves."));
  }

  console.log();
}
