/**
 * Shared severity emoji mapping.
 *
 * Aligned with GitHub Alert conventions:
 * - CRITICAL → 🔴
 * - HIGH     → 🟠
 * - MEDIUM   → 🟡
 * - LOW      → ⚪
 *
 * Story 1.8 — Padronizar Emojis e Consistencia Visual nos Renderers
 */

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export const SEVERITY_ICONS: Record<Severity, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "⚪",
};
