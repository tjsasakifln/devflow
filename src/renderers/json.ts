/**
 * Devflow Renderers -- JSON Report
 *
 * Serializes an AuditReport to a formatted JSON string.
 * Adds a $schema field for forward-compatible schema validation.
 */

import type { AuditReport } from "../core/report-model.js"

const JSON_SCHEMA_URL = "https://devflow.io/schemas/audit-report-v1.json"

/**
 * Serialises an AuditReport to a pretty-printed JSON string.
 * The output includes a `$schema` property pointing to the canonical
 * Devflow audit report schema for tooling and IDE validation.
 *
 * @param report - The audit report to serialise.
 * @returns A JSON string with 2-space indentation.
 */
export function renderJsonReport(report: AuditReport): string {
  const withSchema: Record<string, unknown> & AuditReport = {
    $schema: JSON_SCHEMA_URL,
    ...report,
  }
  return JSON.stringify(withSchema, null, 2)
}
