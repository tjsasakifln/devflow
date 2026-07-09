/**
 * Devflow path constants.
 *
 * Single source of truth for all hardcoded directory and file paths
 * used across the codebase. Import these constants instead of
 * hardcoding path strings.
 *
 * @module
 */

// ── Audit Directory ──

/** Base directory for audit logs, relative to project root. */
export const AUDITS_DIR = ".devflow/audits";

/** Bypass event log (JSONL — records gate-avoidance events). */
export const BYPASS_LOG_RELPATH = ".devflow/audits/bypass-log.jsonl";

/** Git hook bypass log (JSONL — records git-hook bypass events). */
export const HOOK_BYPASS_LOG_RELPATH = ".devflow/audits/hook-bypass.jsonl";

/** Gatekeep approval log (JSONL — records gatekeep approvals and rejections). */
export const GATEKEEP_LOG_RELPATH = ".devflow/audits/gatekeep-log.jsonl";

/** Adversarial review report filename (MD — written per feature under AUDITS_DIR). */
export const ADVERSARIAL_REVIEW_FILENAME = "adversarial-review.md";

// ── Feature Artifacts ──

/** Base directory for feature artifacts, relative to project root. */
export const FEATURES_DIR = "_devflow/features";

/** Discovery directory (brownfield analysis). */
export const DISCOVERY_DIR = "_devflow/discovery";

/** Specs directory (greenfield specifications). */
export const SPECS_DIR = "_devflow/specs";

// ── Config & State ──

/** Dot-devflow directory for runtime config and state. */
export const DOT_DEVFLOW_DIR = ".devflow";

/** Constitution document path. */
export const CONSTITUTION_RELPATH = ".devflow/constitution.md";

/** State file path. */
export const STATE_FILE_RELPATH = ".devflow/state.json";

/** Config file path. */
export const CONFIG_FILE_RELPATH = ".devflow/config.json";

/** DEVFLOW.md cockpit file (project root). */
export const COCKPIT_FILENAME = "DEVFLOW.md";
