# Devflow Architecture -- Local AI Coding Governance

> This document describes the architecture after the Cycle 1 refactor, in which business logic was extracted from command wrappers into a layered core/adapters/renderers structure.

---

## 1. Overview

Devflow is a local-first CLI tool that governs AI-generated code through auditable evidence, risk reports, and engineering guardrails. The architecture follows a layered pipeline:

```
CLI (src/cli/)            -- parameter parsing, user interaction
  |
  v
Core (src/core/)          -- business logic, risk engine, policy
  |
  v
Adapters (src/adapters/)  -- git, stacks, integrations
  |
  v
Renderers (src/renderers/) -- markdown, HTML, JSON output
  |
  v
Kernel (src/kernel/)      -- state machine, evidence, guards, types
```

Each layer has a single responsibility. Dependencies flow downward: CLI depends on Core, Core depends on Adapters and Renderers, and all layers depend on Kernel types and utilities.

---

## 2. Layer Diagram

```
  +------------------------------------------------------------+
  |                    CLI Layer (src/cli/)                     |
  |  audit.ts, review-pr.ts, index.ts (command registration)   |
  |  Thin wrappers. No business logic. Imports from commands/  |
  |  or calls core functions directly.                         |
  +----------------------------+-------------------------------+
                               |
                               v
  +------------------------------------------------------------+
  |                   Core Layer (src/core/)                    |
  |  audit-engine.ts    -- main audit logic                    |
  |  report-model.ts    -- unified AuditReport type            |
  |  policy-engine.ts   -- risk tolerance, verdict computation |
  |  evidence-engine.ts -- evidence gathering and validation   |
  |  dod-engine.ts      -- 25 Definition of Done checks       |
  +----------------------------+-------------------------------+
                               |
              +----------------+----------------+
              |                |                |
              v                v                v
  +-------------+   +---------------+   +---------------+
  |  Adapters   |   |   Renderers   |   |   Commands    |
  | (src/       |   | (src/         |   | (src/         |
  |  adapters/) |   |  renderers/)  |   |  commands/)   |
  |  git/       |   |  markdown.ts  |   |  init.ts      |
  |  stacks/    |   |  html.ts      |   |  install.ts   |
  |  integration|   |  json.ts      |   |  gatekeep.ts  |
  |  models/    |   |  badges.ts    |   |  ...          |
  +------+------+   +-------+-------+   +-------+-------+
         |                   |                   |
         +-------------------+-------------------+
                             |
                             v
  +------------------------------------------------------------+
  |                   Kernel Layer (src/kernel/)                |
  |  state/     -- state machine, transitions                  |
  |  evidence/  -- confidence scoring, evidence gathering      |
  |  guards/    -- pre-action and refusal guards               |
  |  types/     -- shared TypeScript types                     |
  |  utils/     -- fs, git, hash, logger, version, markdown    |
  |  dod/       -- check registry and individual checks        |
  |  config/    -- AI config, default config, config manager   |
  |  validators/ -- loop, structural, semantic, OO validators  |
  +------------------------------------------------------------+
```

---

## 3. Key Modules

### `src/core/audit-engine.ts`

The zero-friction entry point for auditing AI-generated changes. It:

1. Captures the git context (branch, commit SHA, working tree state).
2. Detects the project's technology stack (TypeScript, Python, Go, Rust).
3. Runs `git diff` against the base branch (default: `main`) to collect changed files.
4. Filters excluded files (build artifacts, lock files, generated code).
5. Scans each changed file for dangerous patterns (eval, hardcoded secrets, empty catches, debug flags).
6. Attempts feature detection (requirements, roadmap, test plan, adversarial review, gatekeep).
7. Collects evidence (test framework, type checker, linter, CI configuration).
8. Computes a severity matrix and verdict (PASS / WARN / FAIL / BLOCKED).
9. Returns a fully populated `AuditReport` for the renderers.

### `src/core/report-model.ts`

Single source of truth for all audit and review report shapes. Exports TypeScript interfaces for:

- `AuditReport` -- the complete report object consumed by all renderers
- `AuditOptions` -- parameters accepted by the audit engine
- `ChangedFile`, `Risk`, `Evidence`, `SeverityMatrix`, `AuditMetadata`
- Type unions: `Severity`, `Verdict`, `RiskCategory`, `EvidenceType`

### `src/core/policy-engine.ts`

Computes verdicts based on risk tolerance and execution mode:

- **relaxed**: Self-approval OK. Coverage and lint are advisory.
- **moderate** (default): Standard gates. Team review expected.
- **strict**: All gates blocking. CI required. Unknown actors blocked.

Handles severity escalation based on tolerance -- a LOW finding in strict mode may block the verdict that would pass in relaxed mode.

### `src/core/evidence-engine.ts`

Gathers and validates evidence from the project. Evidence types include:

- Artifact presence (requirements.md, roadmap.md, test-plan.md)
- Tool detection (test framework, type checker, linter, CI configuration)
- Process evidence (implementation log, adversarial review, gatekeep approval)

### `src/core/dod-engine.ts`

Runs 25 Definition of Done checks covering requirements, architecture, actions, constitution, tests, typecheck, lint, and coverage. Used by `devflow feature complete`.

### `src/adapters/stacks/`

The `StackAdapter` interface (defined in `src/adapters/stacks/types.ts`) provides a language-agnostic contract for running tools, detecting dangerous patterns, and parsing reports. Implementations exist for:

| Adapter | File                          | Key Tools              |
|---------|-------------------------------|------------------------|
| TypeScript | `stacks/typescript/index.ts` | vitest, tsc, eslint  |
| Python  | `stacks/python/index.ts`      | pytest, mypy, ruff    |
| Go      | `stacks/go/index.ts`          | go test, go vet       |
| Rust    | `stacks/rust/index.ts`        | cargo test, cargo clippy, cargo check |

The stack detection module (`src/kernel/detection/stack.ts`) auto-detects which adapter to load by scanning for configuration files (tsconfig.json, pyproject.toml, go.mod, Cargo.toml).

### `src/adapters/git/`

- **`diff-model.ts`**: Models git diffs with change type classification, module detection, and file-level metadata.
- **`exclusion-rules.ts`**: Pattern-based file exclusion (dist/, node_modules/, generated files).
- **`index.ts`**: Consolidated git operations used by the audit engine.

### `src/renderers/markdown.ts`

Produces professional PR risk reports with severity matrix, executive summary, "what could have shipped broken" section, evidence table, and a "Devflow Governed" badge. Includes a compact PR snippet for pasting into PR descriptions.

### `src/renderers/html.ts`

Generates standalone HTML reports with dark/light mode, collapsible sections, and copy-to-clipboard support. Designed for CI artifacts and sharing with non-technical stakeholders.

### `src/renderers/json.ts`

Machine-readable JSON output for CI integration. Includes all raw audit data for downstream processing.

### `src/renderers/badges.ts`

Generates "Devflow Governed" badge in markdown, HTML, and SVG formats.

---

## 4. Design Principles

### Thin CLI, Thick Core

Command wrappers in `src/cli/` and `src/commands/` are responsible for parsing arguments, calling core functions, and displaying results. Business logic lives in `src/core/`. No command file contains audit logic or policy computation.

### Logic in Core

The three core modules -- `audit-engine.ts`, `evidence-engine.ts`, `policy-engine.ts` -- contain the project's intellectual property: risk detection algorithms, verdict computation, and evidence validation.

### Adapters for Extensibility

Every external system (git, programming language, AI model, CI tool) communicates through an adapter interface. Adding support for a new language means implementing `StackAdapter` -- no core changes required.

### Renderers for Output

Output format is a renderer concern. Adding a new format (PDF, Slack message, Jira comment) requires adding a renderer, not modifying core logic.

### Evidence-First

Every decision is logged with actor identity, content hashes, git context, and timestamps. The `Evidence` type in `report-model.ts` tracks what was checked, whether it passed, and what was found.

---

## 5. State Machine

The kernel state machine tracks project and feature lifecycle through 22 states:

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
Legacy states: feature-clarification-needed, feature-planning, feature-planned,
               feature-todo, feature-pre-code-audit (deprecated, backward-compatible)
```

Transitions are defined in `src/kernel/state/transitions.ts`. Guard conditions in `src/kernel/guards/` validate each transition.

---

## 6. StackAdapter Interface

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

## 7. Adding a New Language

To add support for a new programming language:

1. **Create the adapter directory**: `src/adapters/stacks/<language>/index.ts`
2. **Implement `StackAdapter`**: Provide implementations for all methods in the interface. At minimum:
   - `language` (string identifier)
   - `runTests()` -- invoke the language's test runner
   - `runLint()` -- invoke the linter
   - `runTypecheck()` -- invoke the type checker
   - `detectDangerousPatterns()` -- language-specific security scan
3. **Add language detection**: Update `src/kernel/detection/stack.ts` to detect your language's project files (e.g., `Gemfile` for Ruby, `Cargo.toml` for Rust).
4. **Add dangerous patterns**: Extend `UNIVERSAL_PATTERNS` in `audit-engine.ts` if the language has common pitfalls (e.g., `unsafe` blocks in Rust, `eval` in Ruby).
5. **Export from barrel**: Add your adapter to `src/adapters/stacks/index.ts`.
6. **Test**: Create tests under `test/unit/adapters/stacks/<language>/`.
7. **Document**: Update this file and add a how-to guide under `docs/`.

---

## 8. Future

- **Monorepo support**: Enhanced `detectChangedModules()` to identify which packages changed and scope evidence checks accordingly.
- **AI-assisted review**: Automated adversarial review using LangGraph pipeline (preview state, planned).
- **Web dashboard**: Render findings to a local web dashboard for visual exploration of audit history.
- **SAST/DAST integration**: Pluggable security scanning through the adapter interface.
- **CI-native output**: JUnit XML, SARIF, and GitHub Annotations for deeper CI integration.
- **Plugin system**: Third-party adapters loaded at runtime from npm packages.
