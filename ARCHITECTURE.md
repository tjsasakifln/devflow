# Devflow Architecture — v1.0.0

> Local AI Coding Governance with workflow engine, multi-agent orchestration, and brownfield discovery pipeline.

---

## 1. Overview

Devflow is a local-first CLI tool that governs AI-generated code through auditable evidence, risk reports, and engineering guardrails. Version 1.0.0 consolidates the kernel, introduces a universal workflow engine, multi-agent orchestration patterns, and stabilizes 9 PREVIEW commands.

The architecture follows a layered pipeline:

```
CLI (src/cli/)            — parameter parsing, user interaction
  |
  v
Commands (src/commands/)  — feature workflows, adversarial review, discovery, analysis
  |
  v
Core (src/core/)          — audit engine, policy, evidence, DoD engine
  |
  v
Adapters (src/adapters/)  — git, stacks, integrations, models, process, crew
  |
  v
Renderers (src/renderers/) — markdown, HTML, JSON, badges
  |
  v
Kernel (src/kernel/)      — state machine, workflow engine, orchestration, discovery,
                             validators, evidence, guards, constitution, cockpit, config
```

Each layer has a single responsibility. Dependencies flow downward: CLI depends on Commands, Commands depend on Core and Kernel, Core depends on Adapters and Renderers, all layers depend on Kernel types and utilities.

---

## 2. Layer Diagram

```
  +--------------------------------------------------------------------+
  |                    CLI Layer (src/cli/)                             |
  |  index.ts (command registration), audit.ts, review-pr.ts           |
  |  Thin wrappers. No business logic. Delegates to commands/ or core. |
  +--------------------------------+-----------------------------------+
                                   |
                                   v
  +--------------------------------------------------------------------+
  |                 Commands Layer (src/commands/)                      |
  |  feature.ts, gatekeep.ts, discover.ts, next.ts, status.ts          |
  |  analyze.ts, trace.ts, promote.ts, drift-check.ts                  |
  |  design-review.ts, tests-review.ts, requirements-audit.ts          |
  |  ai-init.ts, adversarial-review-ai.ts, actions-generate.ts         |
  |  adversarial-review.ts, feature-complete.ts, doctor.ts, init.ts    |
  +--------------------------------+-----------------------------------+
                                   |
                                   v
  +--------------------------------------------------------------------+
  |                     Core Layer (src/core/)                          |
  |  audit-engine.ts    — main audit logic                             |
  |  report-model.ts    — unified AuditReport type                     |
  |  policy-engine.ts   — risk tolerance, verdict computation          |
  |  evidence-engine.ts — evidence gathering and validation            |
  |  dod-engine.ts      — 25 Definition of Done checks                |
  +--------------------------------+-----------------------------------+
                                   |
              +-------------------+-------------------+
              |                   |                   |
              v                   v                   v
  +-------------+   +---------------+   +---------------+
  |  Adapters   |   |   Renderers   |   |   Intelligence|
  | (src/       |   | (src/         |   | (src/         |
  |  adapters/) |   |  renderers/)  |   |  intelligence/)|
  |  git/       |   |  markdown.ts  |   |  langgraph/   |
  |  stacks/    |   |  html.ts      |   |  rag/         |
  |  integration|   |  json.ts      |   |  tools/       |
  |  models/    |   |  badges.ts    |   +---------------+
  |  process/   |   +-------+-------+
  |  project/   |           |
  |  crew/      |           |
  +------+------+           |
         |                  |
         +------------------+-------------------+
                            |                   |
                            v                   v
  +--------------------------------------------------------------------+
  |                    Kernel Layer (src/kernel/)                       |
  |                                                                     |
  |  ┌─ workflow/      — engine, agent-delegation, authority-enforcer, |
  |  │                   handoff, loader, persistence, agent-spawner   |
  |  ├─ orchestration/ — parallel-spawner, adversarial-verify,         |
  |  │                   completeness-critic, agent-runner,             |
  |  │                   result-merger, dimensions                     |
  |  ├─ discovery/     — scout, archaeologist, detective, architect,   |
  |  │                   writer, schema-extractor, orchestrator        |
  |  ├─ state/         — state machine, detector, transitions          |
  |  ├─ evidence/      — confidence scoring, gatherer, schema          |
  |  ├─ guards/        — pre-action guards, refusal, pipeline          |
  |  ├─ validators/    — loop, structural, semantic, OO validators     |
  |  ├─ dod/           — check registry, 8 individual DoD checks       |
  |  ├─ constitution/  — checker, loader, defaults                     |
  |  ├─ audit/         — chain-verifier, generator                     |
  |  ├─ cockpit/       — generator, sections                           |
  |  ├─ config/        — AI config, defaults, config manager           |
  |  ├─ artifacts/     — manager, validator, paths, templates          |
  |  ├─ actors/        — actor schema                                  |
  |  ├─ ci/            — CI verifier                                   |
  |  ├─ detection/     — stack detection                               |
  |  ├─ errors/        — error types, remediation                      |
  |  ├─ types/         — shared TypeScript types                       |
  |  └─ utils/         — fs, git, hash, logger, version, markdown,     |
  |                      prompts, cli-resolver                         |
  +--------------------------------------------------------------------+
```

---

## 3. Key Modules

### 3.1 Workflow Engine (`src/kernel/workflow/`)

The universal workflow engine (v1.0.0) provides:

- **engine.ts** — Core state machine execution with task loading, phase progression, and agent-driven development workflows
- **agent-delegation.ts** — Agent authority matrix; enforces which agent owns which operation
- **authority-enforcer.ts** — Constitutional enforcement of agent boundaries; blocks unauthorized operations
- **agent-spawner.ts** — Spawns sub-agents for parallel task execution with isolation
- **handoff.ts** — Agent-to-agent context handoff protocol with compaction
- **loader.ts** — Task and workflow definition loading from `.aiox-core/development/tasks/`
- **persistence.ts** — Workflow state persistence and resume capability
- **parallel-analysis-integration.ts** — Integrates parallel analysis results into workflow artifacts
- **types.ts** — Workflow type definitions (WorkflowState, TaskDefinition, AgentRole, etc.)

### 3.2 Multi-Agent Orchestration (`src/kernel/orchestration/`)

Production-grade multi-agent patterns (v1.0.0):

- **parallel-spawner.ts** — Spawns N agents concurrently for fan-out analysis, review, or implementation
- **adversarial-verify.ts** — Adversarial review with N independent skeptics per finding; majority-vote refutation
- **completeness-critic.ts** — "What's missing?" agent that identifies gaps and triggers additional rounds
- **agent-runner.ts** — Unified agent execution with timeout, retry, and isolation
- **result-merger.ts** — Deduplicates and merges results from parallel agent runs
- **dimensions.ts** — Review dimension definitions (correctness, security, performance, etc.)
- **types.ts** — Orchestration type definitions

### 3.3 Brownfield Discovery (`src/kernel/discovery/`)

Automated legacy system analysis pipeline (v1.0.0):

- **orchestrator.ts** — 10-phase brownfield discovery coordinator
- **scout.ts** — Surface mapping: folder structure, languages, frameworks, entry points
- **archaeologist.ts** — Deep module analysis: algorithms, control flow, data structures
- **detective.ts** — Business knowledge extraction: rules, state machines, permissions, ADRs
- **architect.ts** — C4 diagrams, ERD, integration maps, Spec Impact Matrix
- **writer.ts** — Executable specs as per-folder contracts (requirements.md, design.md, tasks.md)
- **schema-extractor.ts** — Database schema extraction from DDL, migrations, ORM models

### 3.4 Commands (`src/commands/`)

All 25+ commands live here:

| Category | Commands |
|----------|----------|
| **Feature Workflow** | feature.ts, feature-prompt.ts, feature-complete.ts, gatekeep.ts |
| **Discovery** | discover.ts, index-project.ts, analyze.ts, trace.ts |
| **Quality** | design-review.ts, tests-review.ts, requirements-audit.ts, drift-check.ts |
| **Adversarial** | adversarial-review.ts, adversarial-review-ai.ts |
| **Operations** | init.ts, install.ts, doctor.ts, status.ts, next.ts, update-cockpit.ts |
| **Agent** | ai-init.ts, actions-generate.ts, promote.ts |
| **CI** | audit.ts (via cli/audit.ts), review-pr.ts (via cli/review-pr.ts), eval-run.ts |

### 3.5 Core Engine (`src/core/`)

- **audit-engine.ts** — Zero-friction audit entry point. Captures git context, detects stack, scans changed files for dangerous patterns, collects evidence, computes severity matrix and verdict.
- **report-model.ts** — Single source of truth for AuditReport, AuditOptions, ChangedFile, Risk, Evidence, SeverityMatrix types.
- **policy-engine.ts** — Verdict computation based on risk tolerance (relaxed/moderate/strict) and execution mode (local/experimental/strict/release).
- **evidence-engine.ts** — Gathers and validates evidence: artifact presence, tool detection, process evidence.
- **dod-engine.ts** — 25 Definition of Done checks: requirements, architecture, actions, constitution, tests, typecheck, lint, coverage.

### 3.6 Adapters (`src/adapters/`)

| Adapter | Path | Purpose |
|---------|------|---------|
| Git | `git/` | diff-model, exclusion-rules, consolidated operations |
| Stacks | `stacks/` | TypeScript, Python, Go, Rust adapters (StackAdapter interface) |
| Integration | `integration/` | Claude Code integration, Claude commands |
| Models | `models/` | Anthropic, OpenAI, Ollama model adapters |
| Process | `process/` | Safe subprocess execution with timeout |
| Project | `project/` | File scanner, git inspector, feature detector |
| Crew | `crew/` | Crew-based agent runner |

### 3.7 Renderers (`src/renderers/`)

- **markdown.ts** — PR risk reports with severity matrix, executive summary, evidence table, Devflow badge
- **html.ts** — Standalone HTML reports with dark/light mode, collapsible sections
- **json.ts** — Machine-readable output for CI integration
- **badges.ts** — "Devflow Governed" badge in markdown, HTML, SVG

---

## 4. Design Principles

### Thin CLI, Thick Kernel

Command wrappers in `src/cli/` and `src/commands/` parse arguments, call kernel functions, and display results. Business logic lives in `src/kernel/`. No command file contains audit logic, policy computation, or workflow state management.

### Workflow Engine

All multi-step processes (feature development, brownfield discovery, QA loops, spec pipeline) run through the workflow engine in `src/kernel/workflow/engine.ts`. Tasks are defined in `.aiox-core/development/tasks/` and loaded declaratively.

### Agent Authority

The authority enforcer (`src/kernel/workflow/authority-enforcer.ts`) blocks unauthorized agent operations. The delegation matrix in `src/kernel/workflow/agent-delegation.ts` defines which agent owns each operation (e.g., only @devops can `git push`, only @pm can create epics).

### Adapters for Extensibility

Every external system (git, programming language, AI model, CI tool) communicates through an adapter interface. Adding support for a new language means implementing `StackAdapter` — no core changes required.

### Renderers for Output

Output format is a renderer concern. Adding a new format (PDF, Slack message, Jira comment) requires adding a renderer, not modifying core logic.

### Evidence-First

Every decision is logged with actor identity, content hashes, git context, and timestamps. The `Evidence` type in `report-model.ts` tracks what was checked, whether it passed, and what was found.

---

## 5. State Machine

The kernel state machine tracks project and feature lifecycle through 22+ states:

```
no-project
  -> greenfield-idea -> greenfield-specified -> feature-empty
  -> brownfield-unknown -> brownfield-discovered -> brownfield-specified -> feature-empty

feature-empty -> feature-requirements -> feature-design -> feature-design-reviewed
  -> feature-test-plan -> feature-test-plan-ready -> feature-pre-code-audit
  -> feature-coding-ready -> feature-coding-in-progress

feature-coding-in-progress -> feature-verification -> feature-ci-verified -> feature-review
  -> feature-adversarial-review -> feature-done

Drift states: drift-detected, blocked
Legacy/backward-compatible: feature-clarification-needed, feature-planning, feature-planned,
                             feature-todo
```

Transitions are defined in `src/kernel/state/transitions.ts`. Guard conditions in `src/kernel/guards/` validate each transition.

---

## 6. Multi-Agent Orchestration Patterns

### Parallel Spawner

Fan-out N agents for independent analysis. Used for: multi-dimensional code review, parallel test generation, simultaneous file audits.

### Adversarial Verify

Spawn N independent skeptics per finding, each prompted to REFUTE. Kill if ≥ majority refute. Prevents plausible-but-wrong findings from surviving.

### Completeness Critic

A final agent that asks "what's missing — modality not run, claim unverified, source unread?" Its findings become the next round of work (loop-until-dry pattern).

---

## 7. StackAdapter Interface

```typescript
interface StackAdapter {
  readonly language: string;

  /** Detect which modules/packages were changed */
  detectChangedModules(files: string[]): Promise<string[]>;

  /** Run the project's test suite */
  runTests(cwd: string): Promise<CommandResult>;

  /** Run the project's linter */
  runLint(cwd: string): Promise<CommandResult>;

  /** Run the project's type checker */
  runTypecheck(cwd: string): Promise<CommandResult>;

  /** Scan a single file for dangerous patterns */
  detectDangerousPatterns(file: string, content: string): Promise<DangerousPattern[]>;

  /** Parse coverage output */
  parseCoverage(output: string): Promise<CoverageReport>;

  /** Parse test output */
  parseTestReport(output: string): Promise<TestReport>;

  /** Render stack-specific risk hints */
  renderRiskHints(risks: Risk[]): string[];
}
```

---

## 8. Adding a New Language

To add support for a new programming language:

1. **Create the adapter directory**: `src/adapters/stacks/<language>/index.ts`
2. **Implement `StackAdapter`**: Provide implementations for all methods in the interface.
3. **Add language detection**: Update `src/kernel/detection/stack.ts` to detect your language's project files.
4. **Add dangerous patterns**: Extend language-specific pattern detection.
5. **Export from barrel**: Add your adapter to `src/adapters/stacks/index.ts`.
6. **Test**: Create tests under `test/unit/adapters/stacks/<language>/`.
7. **Document**: Update this file and add a how-to guide under `docs/`.

---

## 9. Current Metrics (v1.0.0)

- **Tests:** 813 passing
- **Type errors:** 0
- **Coverage:** ≥ 80% lines, 100% domain branches
- **Vulnerabilities:** 0 (npm audit)
- **Status check:** < 2s
- **Source files:** ~170 TypeScript files
- **Commands:** 25+ (9 stabilized from PREVIEW)

---

## 10. Future

- **Monorepo support**: Enhanced `detectChangedModules()` to identify which packages changed and scope evidence checks accordingly.
- **Web dashboard**: Render findings to a local web dashboard for visual exploration of audit history.
- **SAST/DAST integration**: Pluggable security scanning through the adapter interface.
- **CI-native output**: JUnit XML, SARIF, and GitHub Annotations for deeper CI integration.
- **Plugin system**: Third-party adapters loaded at runtime from npm packages.
- **LangGraph pipeline**: AI-assisted review with LangGraph state machine (infrastructure present in `src/intelligence/`).
