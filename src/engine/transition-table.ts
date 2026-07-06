import type { DevflowState } from "../types/state.js";
import type { NextActionEntry } from "../types/engine.js";

export const TRANSITION_TABLE: Record<DevflowState, DevflowState[]> = {
  "no-project": ["greenfield-idea"],
  "greenfield-idea": ["greenfield-specified", "feature-empty"],
  "greenfield-specified": ["feature-empty"],
  "brownfield-unknown": ["brownfield-discovered", "feature-empty"],
  "brownfield-discovered": ["brownfield-specified", "feature-empty"],
  "brownfield-specified": ["feature-empty"],
  "feature-empty": ["feature-requirements"],
  "feature-requirements": [
    "feature-clarification-needed",
    "feature-requirements-audited",
  ],
  // New spec-driven states
  "feature-requirements-reviewed": ["feature-design"],
  "feature-design": ["feature-design-reviewed"],
  "feature-design-reviewed": ["feature-test-plan"],
  "feature-test-plan": ["feature-test-plan-ready"],
  "feature-test-plan-ready": ["feature-pre-code-audit"],
  "feature-verification": ["feature-ci-verified", "feature-review", "feature-coding-in-progress"],
  "feature-ci-verified": ["feature-review"],
  "feature-review": ["feature-adversarial-review", "feature-done", "feature-coding-in-progress"],
  "feature-adversarial-review": ["feature-done", "feature-coding-in-progress"],
  // Legacy states (kept for backward compatibility)
  "feature-clarification-needed": [
    "feature-requirements-reviewed",
    "feature-requirements",
  ],
  "feature-requirements-audited": ["feature-design"],
  "feature-planning": ["feature-planned"],
  "feature-planned": ["feature-todo", "feature-pre-code-audit"],
  "feature-todo": ["feature-pre-code-audit"],
  "feature-validation": [
    "feature-done",
    "feature-coding-in-progress",
    "drift-detected",
  ],
  "feature-pre-code-audit": ["feature-coding-ready", "feature-empty"],
  "feature-coding-ready": ["feature-coding-in-progress"],
  "feature-coding-in-progress": [
    "feature-verification",
    "drift-detected",
    "blocked",
  ],
  "feature-done": ["feature-empty", "drift-detected"],
  "drift-detected": ["blocked", "feature-empty", "feature-verification"],
  blocked: ["feature-empty", "feature-coding-in-progress", "feature-done"],
};

export const ACTION_MAP: Record<DevflowState, NextActionEntry> = {
  "no-project": {
    sourceState: "no-project",
    targetStates: ["greenfield-idea"],
    primaryAction: {
      id: "init-project",
      description: "Run `devflow init` to initialize the Devflow project structure",
      why: "No project scaffolding detected. Devflow needs to create .devflow/ and _devflow/ directories and initialize the cockpit.",
      agentOrWorkflow: "orchestrator",
      writes: [".devflow/config.json", ".devflow/state.json", "DEVFLOW.md"],
      reads: ["<current directory>"],
    },
    alternativeActions: [
      {
        description: "Create a new project from scratch (npm init, git init)",
        whenToChoose: "Starting completely fresh with no existing code",
      },
      {
        description: "Point Devflow to an existing project directory",
        whenToChoose: "You have existing code in another directory",
      },
    ],
  },
  "greenfield-idea": {
    sourceState: "greenfield-idea",
    targetStates: ["greenfield-specified", "feature-empty"],
    primaryAction: {
      id: "write-specs",
      description:
        "Write project specifications in _devflow/specs/ — document architecture, domain, and constraints",
      why: "A greenfield project needs foundational specs before features can be built. Without specs, features lack direction and consistency.",
      agentOrWorkflow: "analyst",
      writes: ["_devflow/specs/*"],
      reads: ["package.json", "existing README"],
    },
    alternativeActions: [
      {
        description: "Jump straight to feature creation",
        whenToChoose: "Project vision is already clear and documented elsewhere",
      },
      {
        description: "Use AI-assisted requirements generation",
        whenToChoose: "You have a product idea but need help structuring it",
      },
    ],
  },
  "greenfield-specified": {
    sourceState: "greenfield-specified",
    targetStates: ["feature-empty"],
    primaryAction: {
      id: "new-feature",
      description:
        'Run `devflow feature new "<feature-name>"` to start the first feature',
      why: "Specifications exist but no active feature has been created. The next step is to decompose the specs into implementable features.",
      agentOrWorkflow: "orchestrator",
      writes: ["_devflow/features/<id>/requirements.md"],
      reads: ["_devflow/specs/*"],
    },
    alternativeActions: [
      {
        description: "Review and refine existing specifications",
        whenToChoose: "Specs need improvement before starting features",
      },
      {
        description: "Import external specification documents",
        whenToChoose: "Specifications exist in another format or tool",
      },
    ],
  },
  "brownfield-unknown": {
    sourceState: "brownfield-unknown",
    targetStates: ["brownfield-discovered", "feature-empty"],
    primaryAction: {
      id: "init-discover",
      description:
        "Run `devflow init` to discover and map the existing project structure",
      why: "Code exists but Devflow hasn't been initialized. The project needs discovery to understand its structure, stack, and current state before any changes.",
      agentOrWorkflow: "cartographer",
      writes: [".devflow/config.json", ".devflow/state.json", "DEVFLOW.md"],
      reads: ["<project files>"],
    },
    alternativeActions: [
      {
        description: "Manually create discovery specs without init",
        whenToChoose: "You prefer to document the project manually",
      },
      {
        description: "Skip discovery and start a feature directly",
        whenToChoose: "Project is well-understood by the team",
      },
    ],
  },
  "brownfield-discovered": {
    sourceState: "brownfield-discovered",
    targetStates: ["brownfield-specified", "feature-empty"],
    primaryAction: {
      id: "write-discovery-specs",
      description:
        "Generate discovery specifications — architecture, domain, and dependency maps in _devflow/discovery/",
      why: "Project has been mapped but specifications haven't been written. Discovery specs are needed before safe evolution of brownfield code.",
      agentOrWorkflow: "cartographer",
      writes: [
        "_devflow/discovery/architecture.md",
        "_devflow/discovery/domain.md",
      ],
      reads: ["<project source files>"],
    },
    alternativeActions: [
      {
        description: "Auto-generate specs from project structure analysis",
        whenToChoose: "Project is large and you want automated discovery",
      },
      {
        description: "Start a feature without full discovery specs",
        whenToChoose: "URGENT: bug fix or small change with well-understood scope",
      },
    ],
  },
  "brownfield-specified": {
    sourceState: "brownfield-specified",
    targetStates: ["feature-empty"],
    primaryAction: {
      id: "new-feature-brownfield",
      description:
        'Run `devflow feature new "<feature-name>"` to start work on a new feature',
      why: "Discovery specs are complete. The project is ready for feature work with full understanding of existing architecture.",
      agentOrWorkflow: "orchestrator",
      writes: ["_devflow/features/<id>/requirements.md"],
      reads: ["_devflow/discovery/*", "_devflow/specs/*"],
    },
    alternativeActions: [
      {
        description: "Analyze existing architecture for improvement opportunities",
        whenToChoose: "You want to understand and improve the current system first",
      },
      {
        description: "Document known technical debt",
        whenToChoose: "Legacy systems need debt cataloging before new features",
      },
    ],
  },
  "feature-empty": {
    sourceState: "feature-empty",
    targetStates: ["feature-requirements"],
    primaryAction: {
      id: "write-requirements",
      description:
        "Write requirements.md for the active feature — what problem does it solve, what are the success criteria?",
      why: "An active feature exists but has no requirements. Requirements are the foundation — without them, there's no definition of done.",
      agentOrWorkflow: "analyst",
      writes: ["_devflow/features/<id>/requirements.md"],
      reads: ["_devflow/specs/*", "_devflow/discovery/*"],
    },
    alternativeActions: [
      {
        description: "Review the requirements template before writing",
        whenToChoose: "New to Devflow and want to understand the format",
      },
    ],
  },
  "feature-requirements": {
    sourceState: "feature-requirements",
    targetStates: [
      "feature-clarification-needed",
      "feature-requirements-audited",
    ],
    primaryAction: {
      id: "review-requirements",
      description:
        "Review requirements.md for completeness. Check for [DOUBT] markers, missing sections, and measurable success criteria.",
      why: "Requirements exist but haven't been audited. Review ensures quality before investing time in planning.",
      agentOrWorkflow: "auditor",
      writes: [],
      reads: ["_devflow/features/<id>/requirements.md"],
    },
    alternativeActions: [
      {
        description: "Start resolving [DOUBT] markers if present",
        whenToChoose: "Requirements have known ambiguities that need clarification",
      },
      {
        description: "Auto-format and expand requirements with AI assistance",
        whenToChoose: "Requirements are rough and need structure",
      },
    ],
  },
  // New spec-driven states
  "feature-requirements-reviewed": {
    sourceState: "feature-requirements-reviewed",
    targetStates: ["feature-design"],
    primaryAction: {
      id: "create-design",
      description: "Create architectural roadmap — define components, patterns, layers, and interfaces",
      why: "Requirements are reviewed and clear. Now design the solution before writing any code.",
      agentOrWorkflow: "architect",
      writes: ["_devflow/features/<id>/roadmap.md"],
      reads: ["_devflow/features/<id>/requirements.md"],
    },
    alternativeActions: [],
  },
  "feature-design": {
    sourceState: "feature-design",
    targetStates: ["feature-design-reviewed"],
    primaryAction: {
      id: "review-design",
      description: "Submit the architectural design for independent review. Verify against constitution and coupling risks.",
      why: "Design must be reviewed before proceeding to test planning. Separates creator from reviewer.",
      agentOrWorkflow: "architecture-reviewer",
      writes: [],
      reads: ["_devflow/features/<id>/roadmap.md", ".devflow/constitution.md"],
    },
    alternativeActions: [],
  },
  "feature-design-reviewed": {
    sourceState: "feature-design-reviewed",
    targetStates: ["feature-test-plan"],
    primaryAction: {
      id: "create-test-plan",
      description: "Create test-plan.md — define test strategy, unit tests per contract, integration tests per flow, edge cases, and coverage targets",
      why: "Architecture is approved. Now define how to verify the implementation before coding starts. Test-first: plan tests, then implement.",
      agentOrWorkflow: "test-planner",
      writes: ["_devflow/features/<id>/test-plan.md"],
      reads: ["_devflow/features/<id>/roadmap.md"],
    },
    alternativeActions: [],
  },
  "feature-test-plan": {
    sourceState: "feature-test-plan",
    targetStates: ["feature-test-plan-ready"],
    primaryAction: {
      id: "review-test-plan",
      description: "Review test-plan.md for completeness — verify all contracts are covered, edge cases documented, and coverage targets set",
      why: "Test plan exists but must be reviewed for completeness before coding.",
      agentOrWorkflow: "test-reviewer",
      writes: [],
      reads: ["_devflow/features/<id>/test-plan.md"],
    },
    alternativeActions: [],
  },
  "feature-test-plan-ready": {
    sourceState: "feature-test-plan-ready",
    targetStates: ["feature-pre-code-audit"],
    primaryAction: {
      id: "pre-code-audit",
      description: "Run pre-code audit — verify all artifacts (requirements, design, test-plan, actions) are consistent and complete",
      why: "All planning artifacts are ready. Final audit gate before coding begins.",
      agentOrWorkflow: "auditor",
      writes: ["_devflow/features/<id>/quality-audit.md", "_devflow/features/<id>/legacy-impact.md", "_devflow/features/<id>/regression-watch.md"],
      reads: ["_devflow/features/<id>/requirements.md", "_devflow/features/<id>/roadmap.md", "_devflow/features/<id>/test-plan.md"],
    },
    alternativeActions: [],
  },
  "feature-verification": {
    sourceState: "feature-verification",
    targetStates: ["feature-ci-verified", "feature-review", "feature-coding-in-progress"],
    primaryAction: {
      id: "run-verification",
      description: "Run deterministic verification suite: tests, typecheck, lint, coverage, circular deps, forbidden deps, constitution check",
      why: "Coding is complete. Deterministic checks must pass before review. No human 'looks good to me' — verification is objective.",
      agentOrWorkflow: "gatekeeper",
      writes: ["_devflow/features/<id>/qa-report.md"],
      reads: ["<source files>", "implementation-log.jsonl"],
    },
    alternativeActions: [
      { description: "Fix failing checks and re-verify", whenToChoose: "Verification revealed issues" },
    ],
  },
  "feature-ci-verified": {
    sourceState: "feature-ci-verified",
    targetStates: ["feature-review"],
    primaryAction: {
      id: "ci-verified",
      description: "CI verification complete — remote pipeline confirms all checks pass. Proceed to independent review.",
      why: "CI serves as external source of truth. Remote verification confirms that what passes locally also passes on a clean environment.",
      agentOrWorkflow: "gatekeeper",
      writes: [],
      reads: ["CI workflow run", "qa-report.md"],
    },
    alternativeActions: [
      { description: "Check CI logs for details", whenToChoose: "Understanding CI results" },
    ],
  },
  "feature-review": {
    sourceState: "feature-review",
    targetStates: ["feature-adversarial-review", "feature-done", "feature-coding-in-progress"],
    primaryAction: {
      id: "independent-review",
      description: "Submit feature for independent review — gatekeeper verifies all checks passed and approves completion",
      why: "Separates implementer from approver. Gatekeeper verifies: constitution compliance, DoD completeness, evidence integrity.",
      agentOrWorkflow: "gatekeeper",
      writes: [],
      reads: ["_devflow/features/<id>/qa-report.md", "implementation-log.jsonl", ".devflow/constitution.md"],
    },
    alternativeActions: [
      { description: "Return to coding for fixes", whenToChoose: "Review found issues that need code changes" },
    ],
  },
  "feature-adversarial-review": {
    sourceState: "feature-adversarial-review",
    targetStates: ["feature-done", "feature-coding-in-progress"],
    primaryAction: {
      id: "adversarial-review",
      description: "Adversarial reviewer attempts to break the feature — seeks hidden coupling, weak tests, abstraction failures, uncovered behavior",
      why: "Standard review looks for correctness. Adversarial review looks for failure modes. Both are required before completion.",
      agentOrWorkflow: "adversarial-reviewer",
      writes: [".devflow/audits/adversarial-review.md"],
      reads: ["<source files>", "requirements.md", "roadmap.md", "test-plan.md"],
    },
    alternativeActions: [
      { description: "Return to coding for fixes", whenToChoose: "Adversarial review found critical issues" },
    ],
  },
  "feature-clarification-needed": {
    sourceState: "feature-clarification-needed",
    targetStates: ["feature-requirements-reviewed", "feature-requirements"],
    primaryAction: {
      id: "resolve-doubts",
      description:
        "Resolve all [DOUBT] markers in requirements.md by answering focused clarification questions in clarification.md",
      why: "Ambiguous requirements block safe planning. Each [DOUBT] marker must be resolved before proceeding.",
      agentOrWorkflow: "clarifier",
      writes: ["_devflow/features/<id>/clarification.md"],
      reads: ["_devflow/features/<id>/requirements.md"],
    },
    alternativeActions: [
      {
        description: "Rewrite requirements from scratch",
        whenToChoose: "Too many doubts — requirements may need a fresh start",
      },
    ],
  },
  "feature-requirements-audited": {
    sourceState: "feature-requirements-audited",
    targetStates: ["feature-planning"],
    primaryAction: {
      id: "create-roadmap",
      description:
        "Create architectural-roadmap.md — define implementation order, architecture decisions, files to create/modify, and risk assessment",
      why: "Audited requirements need a technical plan. The roadmap bridges the gap between what and how.",
      agentOrWorkflow: "architect",
      writes: [
        "_devflow/features/<id>/roadmap.md",
        "_devflow/features/<id>/investigation.md",
        "_devflow/features/<id>/data-delta.md",
      ],
      reads: [
        "_devflow/features/<id>/requirements.md",
        "_devflow/features/<id>/quality-audit.md",
        "_devflow/discovery/*",
      ],
    },
    alternativeActions: [
      {
        description: "Create a quick/minimal plan for simple features",
        whenToChoose: "Feature is small and well-understood",
      },
      {
        description: "Create a detailed plan with diagrams",
        whenToChoose: "Feature is complex and needs thorough architecture",
      },
    ],
  },
  "feature-planning": {
    sourceState: "feature-planning",
    targetStates: ["feature-planned"],
    primaryAction: {
      id: "create-actions",
      description:
        "Decompose the roadmap into atomic, dependency-ordered actions in actions.md",
      why: "The roadmap exists but hasn't been broken down into actionable steps. Actions are the executable units of work.",
      agentOrWorkflow: "tasksmith",
      writes: ["_devflow/features/<id>/actions.md"],
      reads: ["_devflow/features/<id>/roadmap.md"],
    },
    alternativeActions: [
      {
        description: "Use AI to auto-decompose roadmap into actions",
        whenToChoose: "Roadmap is clear and you want fast decomposition",
      },
      {
        description: "Manual task breakdown with team review",
        whenToChoose: "Complex feature requiring team alignment on approach",
      },
    ],
  },
  "feature-planned": {
    sourceState: "feature-planned",
    targetStates: ["feature-todo", "feature-pre-code-audit"],
    primaryAction: {
      id: "complete-actions",
      description:
        "Review and complete any remaining action items in actions.md. All actions should be planned before audit.",
      why: "Actions exist but may not all be complete. Finish planning before the pre-code audit.",
      agentOrWorkflow: "tasksmith",
      writes: [],
      reads: ["_devflow/features/<id>/actions.md"],
    },
    alternativeActions: [
      {
        description: "Start pre-code audit immediately",
        whenToChoose: "Actions are fully defined and just need audit sign-off",
      },
      {
        description: "Review and adjust priorities",
        whenToChoose: "Need to reorder actions based on dependencies or risk",
      },
    ],
  },
  "feature-todo": {
    sourceState: "feature-todo",
    targetStates: ["feature-pre-code-audit"],
    primaryAction: {
      id: "pre-code-audit",
      description:
        "Run pre-code audit: verify consistency between requirements, roadmap, and actions. Document legacy-impact.md.",
      why: "All artifacts are ready for audit. The pre-code audit is the final gate before coding begins — it catches inconsistencies that would waste implementation effort.",
      agentOrWorkflow: "auditor",
      writes: [
        "_devflow/features/<id>/quality-audit.md",
        "_devflow/features/<id>/legacy-impact.md",
        "_devflow/features/<id>/regression-watch.md",
      ],
      reads: [
        "_devflow/features/<id>/requirements.md",
        "_devflow/features/<id>/roadmap.md",
        "_devflow/features/<id>/actions.md",
      ],
    },
    alternativeActions: [
      {
        description: "Review existing requirements before audit",
        whenToChoose: "Requirements may have drifted since last review",
      },
      {
        description: "Add missing test coverage before coding",
        whenToChoose: "Existing test suite needs expansion for regression safety",
      },
    ],
  },
  "feature-pre-code-audit": {
    sourceState: "feature-pre-code-audit",
    targetStates: ["feature-coding-ready", "feature-empty"],
    primaryAction: {
      id: "pass-audit",
      description:
        "Verify the pre-code audit passes all checks. Address any audit findings before coding.",
      why: "The pre-code audit has findings that need resolution. Coding before audit passes risks building on an inconsistent foundation.",
      agentOrWorkflow: "auditor",
      writes: [],
      reads: [
        "_devflow/features/<id>/quality-audit.md",
        "_devflow/features/<id>/legacy-impact.md",
      ],
    },
    alternativeActions: [
      {
        description: "Request architecture review",
        whenToChoose: "Audit reveals architectural concerns needing expert input",
      },
      {
        description: "Start over with fresh requirements",
        whenToChoose: "Audit reveals fundamental issues with the requirements",
      },
    ],
  },
  "feature-coding-ready": {
    sourceState: "feature-coding-ready",
    targetStates: ["feature-coding-in-progress"],
    primaryAction: {
      id: "start-coding",
      description:
        "Execute the first action from actions.md. Begin implementation with full artifact support.",
      why: "All gates passed. Requirements, roadmap, actions, audit, and legacy impact are complete. Safe to begin coding.",
      agentOrWorkflow: "developer",
      writes: ["<source files>", "implementation-log.jsonl"],
      reads: [
        "_devflow/features/<id>/actions.md",
        "_devflow/features/<id>/roadmap.md",
        "_devflow/features/<id>/legacy-impact.md",
      ],
    },
    alternativeActions: [
      {
        description: "Review coding standards and conventions",
        whenToChoose: "New to the project or team conventions",
      },
      {
        description: "Set up test environment and fixtures",
        whenToChoose: "Test infrastructure needs preparation",
      },
    ],
  },
  "feature-coding-in-progress": {
    sourceState: "feature-coding-in-progress",
    targetStates: ["feature-validation", "drift-detected", "blocked"],
    primaryAction: {
      id: "continue-coding",
      description:
        "Continue executing actions from actions.md. Log each completed action to implementation-log.jsonl.",
      why: "Coding is in progress. Focus on completing the remaining actions while watching for drift and blockers.",
      agentOrWorkflow: "developer",
      writes: ["<source files>", "implementation-log.jsonl"],
      reads: ["_devflow/features/<id>/actions.md"],
    },
    alternativeActions: [
      {
        description: "Run QA validation on completed actions",
        whenToChoose: "Significant portion of actions are complete",
      },
      {
        description: "Request code review on current progress",
        whenToChoose: "Need feedback before continuing",
      },
    ],
  },
  "feature-validation": {
    sourceState: "feature-validation",
    targetStates: [
      "feature-done",
      "feature-coding-in-progress",
      "drift-detected",
    ],
    primaryAction: {
      id: "qa-validation",
      description:
        "Run full QA validation: verify all acceptance criteria, generate qa-report.md, and review regression-watch.md",
      why: "Implementation is complete but hasn't been validated. QA ensures the feature meets requirements and doesn't break existing functionality.",
      agentOrWorkflow: "qa",
      writes: [
        "_devflow/features/<id>/qa-report.md",
        "_devflow/features/<id>/regression-watch.md",
      ],
      reads: [
        "_devflow/features/<id>/actions.md",
        "_devflow/features/<id>/requirements.md",
        "implementation-log.jsonl",
      ],
    },
    alternativeActions: [
      {
        description: "Fix issues found during validation",
        whenToChoose: "QA reveals bugs that need fixing before release",
      },
      {
        description: "Roll back if feature is fundamentally broken",
        whenToChoose: "Validation reveals major issues requiring re-think",
      },
    ],
  },
  "feature-done": {
    sourceState: "feature-done",
    targetStates: ["feature-empty", "drift-detected"],
    primaryAction: {
      id: "start-next-feature",
      description:
        'Generate release-notes.md and start the next feature with `devflow feature new "<name>"`',
      why: "Feature is complete and validated. Time to document the release and move to the next piece of work.",
      agentOrWorkflow: "release-scribe",
      writes: [
        "_devflow/features/<id>/release-notes.md",
        "_devflow/features/<new-id>/requirements.md",
      ],
      reads: [
        "_devflow/features/<id>/qa-report.md",
        "implementation-log.jsonl",
      ],
    },
    alternativeActions: [
      {
        description: "Finalize changelog and release notes",
        whenToChoose: "Preparing for a release or deployment",
      },
      {
        description: "Update regression watch for ongoing monitoring",
        whenToChoose: "Feature touches critical paths needing extended monitoring",
      },
    ],
  },
  "drift-detected": {
    sourceState: "drift-detected",
    targetStates: ["blocked", "feature-empty", "feature-validation"],
    primaryAction: {
      id: "reconcile-drift",
      description:
        "Compare code changes against specifications. Update either the code or the specs to reconcile the drift.",
      why: "Code has diverged from specifications. Drift is an emergency — continuing without reconciliation leads to unreliable specs and untraceable code.",
      agentOrWorkflow: "drift-detector",
      writes: ["<spec files or source files>"],
      reads: [
        "_devflow/specs/*",
        "_devflow/features/<id>/*",
        "<modified source files>",
      ],
    },
    alternativeActions: [
      {
        description: "Rollback recent changes",
        whenToChoose: "Recent changes caused the drift and should be reverted",
      },
      {
        description: "Run devflow doctor for diagnosis",
        whenToChoose: "Unsure what caused the drift",
      },
    ],
  },
  blocked: {
    sourceState: "blocked",
    targetStates: [
      "feature-empty",
      "feature-coding-in-progress",
      "feature-done",
    ],
    primaryAction: {
      id: "resolve-blockers",
      description:
        "Resolve the blocking issues listed in the status. Check .devflow/state.json for specific blockers.",
      why: "Progress is blocked. Blockers must be resolved before any forward progress can be made.",
      agentOrWorkflow: "orchestrator",
      writes: [],
      reads: [".devflow/state.json"],
    },
    alternativeActions: [
      {
        description: "Start a new feature while blocked",
        whenToChoose: "Blockers are external or long-term — switch to parallel work",
      },
      {
        description: "Explicitly override the blocked state",
        whenToChoose: "Blockers have been resolved but state hasn't updated",
      },
    ],
  },
};
