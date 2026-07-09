/**
 * Discovery Renderers
 *
 * Extracted report generators from discover.ts command.
 * Each renderer produces a markdown report string from raw analysis data.
 *
 * Story 1.2 — Extrair Logica de Comandos Grandes
 *
 * TODO(STORY-1.2): Extract buildSystemMap, buildRiskMap, buildTestingBaseline,
 * buildChangeZones, and buildExecutiveSummary from src/commands/discover.ts
 * into individual renderer modules in this directory.
 */

// Barrel — individual renderer modules will be added as extraction proceeds.
export type { SystemMapInput, RiskMapInput, TestingBaselineInput, ChangeZonesInput, ExecutiveSummaryInput } from "./types.js";
