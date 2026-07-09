/**
 * Shared types for discovery renderers.
 *
 * Story 1.2 — Extrair Logica de Comandos Grandes
 */

import type { StackProfile } from "../../detection/stack.js";
import type { ScoutReport } from "../scout.js";

/** Input for buildSystemMap renderer. */
export interface SystemMapInput {
  rootPath: string;
  stack: StackProfile;
  files: Array<{ path: string; size: number }>;
  entrypoints: string[];
}

/** Input for buildRiskMap renderer. */
export interface RiskMapInput {
  rootPath: string;
  stack: StackProfile;
  scout: ScoutReport;
  fileCount: number;
  totalLines: number;
}

/** Input for buildTestingBaseline renderer. */
export interface TestingBaselineInput {
  rootPath: string;
  stack: StackProfile;
  testFiles: string[];
  hasTestScript: boolean;
  coverageAvailable: boolean;
}

/** Input for buildChangeZones renderer. */
export interface ChangeZonesInput {
  rootPath: string;
  files: Array<{ path: string; complexity: number; churn: number }>;
  topHotspots: Array<{ path: string; score: number }>;
}

/** Input for buildExecutiveSummary renderer. */
export interface ExecutiveSummaryInput {
  rootPath: string;
  stack: StackProfile;
  fileCount: number;
  totalLines: number;
  testCount: number;
  issueCount: number;
}
