/**
 * Devflow kernel constants.
 *
 * Single source of truth for all hardcoded numbers that appear in
 * documentation, CLI help text, cockpit, and Claude Code integration.
 * Change the value here — everything else follows.
 */

/** Number of attack vectors in the adversarial review (Phase 1: was 8, now 12). */
export const ADVERSARIAL_VECTOR_COUNT = 12;

/** Number of Definition of Done checks run by `feature complete`. */
export const DOD_CHECK_COUNT = 25;

/** Names of all supported adversarial attack vectors. */
export const SUPPORTED_ATTACK_VECTORS: readonly string[] = [
  "Hidden Coupling",
  "Weak Tests",
  "Abstraction Failure",
  "Layer Violation",
  "Security",
  "Spec-Code Gap",
  "Uncovered Requirements",
  "Code Duplication",
  "State Tampering (Devflow bypass)",
  "Log Forgery (Devflow bypass)",
  "False Completion (Devflow bypass)",
  "Same-Actor Bypass (Devflow bypass)",
] as const;

/** Number of constitution rules (C1–C12). */
export const CONSTITUTION_RULE_COUNT = 12;
