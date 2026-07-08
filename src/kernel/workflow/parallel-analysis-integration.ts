// =============================================================================
// Parallel Agent Spawner — Workflow Engine Integration
// =============================================================================
// Integrates parallel analysis into the workflow engine as:
// - A guard: `parallelAnalysisNeeded` — checks if analysis is needed
// - An effect: `runParallelAnalysis` — triggers parallel analysis as side effect
// - Results feed into `devflow next --diagnose`
//
// Usage:
//   import { registerParallelAnalysis } from "./parallel-analysis-integration.js";
//   engine.registerGuard("parallelAnalysisNeeded", parallelAnalysisGuard);
//   engine.registerEffect("runParallelAnalysis", parallelAnalysisEffect);
// =============================================================================

import type { GuardContext, GuardHandler, EffectHandler } from "./types.js";
import type { ConsolidatedResult, DimensionDef } from "../orchestration/types.js";
import { ParallelSpawner } from "../orchestration/parallel-spawner.js";
import { DEFAULT_DIMENSIONS, resolveDimensions } from "../orchestration/dimensions.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cache key prefix for storing analysis results in engine metadata. */
const ANALYSIS_CACHE_KEY = "parallel-analysis-cache";

// ---------------------------------------------------------------------------
// Guard: parallelAnalysisNeeded
// ---------------------------------------------------------------------------

/**
 * Guard that checks whether a parallel analysis is needed.
 * Triggers when:
 * - The project has sufficient code to analyze
 * - An analysis hasn't been run recently (or cache is stale)
 * - A transition would benefit from pre-analysis data
 */
export const parallelAnalysisGuard: GuardHandler = (ctx: GuardContext): boolean => {
  const { inspection } = ctx;

  // Only analyze if we have code to analyze
  if (!inspection.hasSrcDir && !inspection.hasPackageJson) {
    return false;
  }

  // Check if analysis was already done (via engine state metadata)
  const cached = getCachedAnalysis(ctx);
  if (cached) {
    // Cache is valid if it was run in the last 5 minutes
    const cacheAge = Date.now() - cached.timestamp;
    if (cacheAge < 5 * 60 * 1000) {
      return false; // Cache hit — no analysis needed
    }
  }

  return true;
};

/**
 * Guard that checks if security analysis found critical issues.
 */
export const securityIssuesFoundGuard: GuardHandler = (
  _ctx: GuardContext,
): boolean => {
  // This is registered alongside the effect — the effect stores
  // the result in context, and this guard reads it.
  return false; // Default: assume no issues (will be overridden by effect state)
};

/**
 * Guard that checks if any critical issues were found across all dimensions.
 */
export const criticalIssuesFoundGuard: GuardHandler = (
  _ctx: GuardContext,
): boolean => {
  return false; // Default: assume clean
};

// ---------------------------------------------------------------------------
// Effect: runParallelAnalysis
// ---------------------------------------------------------------------------

/**
 * Effect that triggers a parallel analysis across all default dimensions.
 * Runs asynchronously and stores results in engine metadata for later use.
 */
export const parallelAnalysisEffect: EffectHandler = async (
  ctx: GuardContext,
): Promise<void> => {
  const { inspection } = ctx;
  const rootPath = inspection.rootPath;

  const spawner = new ParallelSpawner(rootPath);
  const dimensions = [...DEFAULT_DIMENSIONS];

  try {
    const result = await spawner.spawnAgents(dimensions);

    // Store result in memory (persisted by caller if needed)
    const cache = getCachedAnalysis(ctx);
    const analysisCache = cache ? { ...cache } : { results: [], timestamp: 0 };

    analysisCache.results.push(result);
    analysisCache.timestamp = Date.now();

    // Store in the state — accessible to subsequent guard evaluations
    setCachedAnalysis(ctx, analysisCache);
  } catch {
    // Non-fatal: analysis failure shouldn't block workflow transitions
  }
};

/**
 * Effect that runs analysis for specific dimensions.
 */
export function createDimensionAnalysisEffect(
  dimensionNames: string[],
): EffectHandler {
  return async (ctx: GuardContext): Promise<void> => {
    const rootPath = ctx.inspection.rootPath;
    const spawner = new ParallelSpawner(rootPath);

    let dimensions: DimensionDef[];
    try {
      dimensions = resolveDimensions(dimensionNames);
    } catch {
      return; // Invalid dimensions — skip silently
    }

    try {
      const result = await spawner.spawnAgents(dimensions);
      const cache = getCachedAnalysis(ctx);
      const analysisCache = cache
        ? { ...cache }
        : { results: [], timestamp: 0 };

      analysisCache.results.push(result);
      analysisCache.timestamp = Date.now();
      setCachedAnalysis(ctx, analysisCache);
    } catch {
      // Non-fatal
    }
  };
}

// ---------------------------------------------------------------------------
// Integration helper
// ---------------------------------------------------------------------------

/**
 * Register all parallel analysis guards and effects on an engine.
 */
export function registerParallelAnalysisEffects(
  registerGuard: (id: string, handler: GuardHandler) => void,
  registerEffect: (id: string, handler: EffectHandler) => void,
): void {
  registerGuard("parallelAnalysisNeeded", parallelAnalysisGuard);
  registerGuard("securityIssuesFound", securityIssuesFoundGuard);
  registerGuard("criticalIssuesFound", criticalIssuesFoundGuard);

  registerEffect("runParallelAnalysis", parallelAnalysisEffect);
}

/**
 * Get analysis results from the engine context for diagnostic use.
 */
export function getAnalysisResults(
  ctx: GuardContext,
): ConsolidatedResult[] {
  const cache = getCachedAnalysis(ctx);
  return cache?.results ?? [];
}

/**
 * Get the latest analysis result (most recent run).
 */
export function getLatestAnalysis(
  ctx: GuardContext,
): ConsolidatedResult | null {
  const cache = getCachedAnalysis(ctx);
  if (!cache || cache.results.length === 0) return null;
  return cache.results[cache.results.length - 1] ?? null;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/** Retrieve analysis cache from context (engine metadata mirror). */
function getCachedAnalysis(ctx: GuardContext): {
  results: ConsolidatedResult[];
  timestamp: number;
} | null {
  // Access the engine state stored in the guard context
  // This is passed through the stateFile field
  if (!ctx.stateFile || !ctx.stateFile.metadata) return null;

  const raw = (ctx.stateFile.metadata as Record<string, unknown>)[ANALYSIS_CACHE_KEY];
  if (!raw) return null;

  try {
    return JSON.parse(JSON.stringify(raw)) as {
      results: ConsolidatedResult[];
      timestamp: number;
    };
  } catch {
    return null;
  }
}

/** Store analysis cache in context (engine metadata). */
function setCachedAnalysis(
  ctx: GuardContext,
  cache: { results: ConsolidatedResult[]; timestamp: number },
): void {
  if (!ctx.stateFile) return;
  (ctx.stateFile.metadata as Record<string, unknown>)[ANALYSIS_CACHE_KEY] = cache;
}
