/**
 * Devflow Core — Definition of Done Engine
 *
 * Defines the canonical 25 DoD check definitions and provides
 * utility functions for categorization, pass-rate calculation,
 * and tolerance-aware pass/fail determination.
 *
 * Extracted from commands/feature-complete.ts — this module is
 * the single source of truth for what checks exist. It does not
 * execute them; consumers use feature-complete.ts to run checks.
 */

// ── DoDCheck interface ──

export type DoDCategory =
  | "artifact"
  | "deterministic"
  | "git"
  | "process"
  | "review"
  | "ci"
  | "domain";

export interface DoDCheck {
  id: number;
  category: DoDCategory;
  name: string;
  description: string;
  passed: boolean;
  detail?: string;
  /** Adjusted by riskTolerance at check-run time. */
  blocking: boolean;
}

// ── Check definition (static metadata, no execution state) ──

export interface DoDCheckDefinition {
  id: number;
  category: DoDCategory;
  name: string;
  description: string;
}

// ── Public API ──

/**
 * Return the canonical 25 DoD check definitions without running them.
 *
 * These are the check names, descriptions, and categories extracted
 * from feature-complete.ts. Consumers use these to build the UI,
 * documentation, or pass them to the check runner for execution.
 */
export function getDoDCheckDefinitions(): DoDCheckDefinition[] {
  return [
    // ── Artifact checks ──
    {
      id: 1,
      category: "artifact",
      name: "Requirements claros e completos",
      description:
        "Requirements.md exists with all 15 required sections and no unresolved doubts",
    },
    {
      id: 2,
      category: "artifact",
      name: "Design documentado (roadmap.md)",
      description:
        "Roadmap.md documents architecture, layers, patterns, and interfaces",
    },
    {
      id: 3,
      category: "artifact",
      name: "Actions com evidencias (todas [X])",
      description:
        "Actions.md contains T001-format atomic tasks, all marked complete with evidence",
    },
    {
      id: 10,
      category: "artifact",
      name: "Legacy impact analisado",
      description:
        "Legacy-impact.md documents affected modules, breaking changes, and migration paths",
    },
    {
      id: 11,
      category: "artifact",
      name: "Regressoes cobertas",
      description:
        "Regression-watch.md identifies areas to monitor for regressions",
    },
    {
      id: 22,
      category: "artifact",
      name: "Heuristic semantic quality",
      description:
        "Artifacts have real content, not boilerplate or placeholder text",
    },
    {
      id: 23,
      category: "artifact",
      name: "Test plan completo com edge cases e error scenarios",
      description:
        "Test-plan.md includes unit, integration, edge cases, and error scenarios",
    },
    {
      id: 24,
      category: "artifact",
      name: "Implementation log atualizado com entradas",
      description:
        "Implementation-log.jsonl has entries recording each action execution",
    },

    // ── Deterministic checks ──
    {
      id: 4,
      category: "deterministic",
      name: "Arquitetura respeita constitution",
      description:
        "Architecture respects all constitution rules (dependency-cruiser, madge, eslint)",
    },
    {
      id: 5,
      category: "deterministic",
      name: "Testes passam",
      description:
        "All tests pass successfully via stack-detected test runner",
    },
    {
      id: 6,
      category: "deterministic",
      name: "Typecheck passa",
      description:
        "Type checking passes without errors (TypeScript projects)",
    },
    {
      id: 7,
      category: "deterministic",
      name: "Lint passa",
      description:
        "Linting passes without violations via stack-detected linter",
    },
    {
      id: 8,
      category: "deterministic",
      name: "Coverage >= 80%",
      description:
        "Test coverage meets the 80% threshold via stack-detected coverage tool",
    },
    {
      id: 9,
      category: "deterministic",
      name: "Imports circulares zero",
      description:
        "No circular imports detected (madge check on source directory)",
    },
    {
      id: 13,
      category: "deterministic",
      name: "Sem TODO/FIXME sem ticket",
      description:
        "No unlinked TODO or FIXME markers in source code — all must reference an issue",
    },
    {
      id: 17,
      category: "deterministic",
      name: "OO design quality (coupling, cohesion, complexity)",
      description:
        "Object-oriented design quality metrics meet thresholds when ooMetrics gate is enabled",
    },

    // ── Git checks ──
    {
      id: 12,
      category: "git",
      name: "Branch nao e main",
      description:
        "Working on a feature branch (not main or master) to protect the main line",
    },

    // ── Process checks ──
    {
      id: 14,
      category: "process",
      name: "ADRs registrados (decisoes relevantes)",
      description:
        "Architecture Decision Records documented when a constitution exists",
    },
    {
      id: 19,
      category: "process",
      name: "Implementer diferente de Approver (atores diferentes)",
      description:
        "Different actors for implementation and approval unless in solo-hardened mode",
    },
    {
      id: 21,
      category: "process",
      name: "Agentic loop validation",
      description:
        "Agentic loops in actions.md have explicit goal, stopCondition, maxIterations, externalCheck, evidenceLog",
    },
    {
      id: 25,
      category: "process",
      name: "Integrity consolidation",
      description:
        "Cross-check all blocking gates, implementation log consistency, adversarial review, and gatekeep log",
    },

    // ── Review checks ──
    {
      id: 15,
      category: "review",
      name: "Review independente aprovada",
      description:
        "Independent human review via devflow gatekeep — requires explicit --approve",
    },
    {
      id: 20,
      category: "review",
      name: "Adversarial review completed and passing",
      description:
        "Feature survived all 12 attack vectors in adversarial review — PASS required",
    },

    // ── CI checks ──
    {
      id: 16,
      category: "ci",
      name: "CI verification",
      description:
        "Continuous integration pipeline passes (success conclusion on configured workflow)",
    },

    // ── Domain checks ──
    {
      id: 18,
      category: "domain",
      name: "Acceptance criteria verificaveis (>=3 Gherkin, error cases)",
      description:
        "Acceptance criteria with Gherkin Given/When/Then scenarios including error paths",
    },
  ];
}

/**
 * Group DoD checks by their category.
 */
export function categorizeDoDChecks(
  checks: DoDCheck[],
): Record<DoDCategory, DoDCheck[]> {
  const categorized: Record<string, DoDCheck[]> = {};

  for (const check of checks) {
    const cat = check.category;
    if (!categorized[cat]) {
      categorized[cat] = [];
    }
    categorized[cat].push(check);
  }

  // Return with explicit DoDCategory keys for type safety
  return categorized as Record<DoDCategory, DoDCheck[]>;
}

/**
 * Compute pass/fail statistics from a set of DoD checks.
 */
export function computeDoDPassRate(
  checks: DoDCheck[],
): { total: number; passed: number; failed: number; passRate: number } {
  const total = checks.length;
  const passed = checks.filter((c) => c.passed).length;
  const failed = total - passed;

  return {
    total,
    passed,
    failed,
    passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
  };
}

/**
 * Determine whether a set of DoD checks is passing for the given tolerance.
 *
 * - `relaxed`:  all blocking checks (as flagged) must pass; non-blocking failures tolerated.
 * - `moderate`: all blocking checks must pass (stricter default blocking set).
 * - `strict`:   every single check must pass; no failures tolerated.
 */
export function isDoDPassing(
  checks: DoDCheck[],
  tolerance: "relaxed" | "moderate" | "strict",
): boolean {
  switch (tolerance) {
    case "strict":
      return checks.every((c) => c.passed);
    case "relaxed":
    case "moderate": {
      const failedBlocking = checks.filter((c) => c.blocking && !c.passed);
      return failedBlocking.length === 0;
    }
  }
}
