# Devflow

> fool-resistant, evidence-driven, engineered-by-default: state-aware workflow harness for AI-assisted software development

[![npm version](https://img.shields.io/npm/v/@tjsasakinpm/devflow)](https://www.npmjs.com/package/@tjsasakinpm/devflow)
[![npm install](https://img.shields.io/badge/npx_install-@tjsasakinpm/devflow-blue)](https://www.npmjs.com/package/@tjsasakinpm/devflow)
[![node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Devflow** is a process governance CLI: it reduces error probability through explicit state transitions, raises the cost of skipping engineering steps, and produces an auditable trail of evidence. It does **not** eliminate the need for qualified human review.

**Enforcement model:** Devflow blocks happen when developers voluntarily run Devflow commands. For mandatory enforcement, install the optional git hooks during `devflow install`. Devflow is not a sandbox, not an external policy engine, and cannot prevent deliberate bypass. It creates an audit trail that makes bypass visible.

## What Devflow Does

- Detects project state across 22 states (greenfield, brownfield, feature phases)
- Enforces a spec-driven workflow with explicit state transitions
- Runs 25 Definition of Done checks before feature completion (including 1 integrity consolidation gate)
- Generates structured implementation prompts for AI agents (Claude Code, Cursor)
- Provides independent gatekeeper review (implementer ≠ approver, Constitution C12)
- Generates auditable evidence (logs with actor identity, hashes, git context)
- Adversarial review across 12 attack vectors (including devflow bypass attempts)
- Pre-action guards prevent coding without prerequisite artifacts
- 4 execution modes: local, experimental, strict, release
- Stack-adaptive validation: TypeScript, JavaScript, Python, Go, Rust, PHP, Java

## What Devflow Does NOT Do

- Does **not** guarantee bug-free code
- Does **not** replace human code review
- Does **not** prevent deliberate process bypass
- Does **not** guarantee production-readiness from passing checks
- Does **not** automatically detect all code-spec drift (heuristic checks only)
- Does **not** eliminate the need for qualified engineering judgment
- Does **not** write code for you — it prepares the ground so code is correct by construction
- Does **not** enforce anything outside of voluntary CLI execution (unless git hooks are installed)

## First Use — Three Paths

### Path 1: Greenfield (New Project)

Starting from scratch or a minimal codebase.

```bash
# 1. Install Devflow in your project
npx @tjsasakinpm/devflow install

# 2. Check your project state
devflow status

# 3. See what to do next
devflow next

# 4. Create your first feature workspace
devflow feature new "user-authentication"

# 5. Fill in the requirements interactively (or edit requirements.md directly)
#    The wizard asks: problem, users, affected areas, constraints, out-of-scope

# 6. Check what's still needed
devflow next --diagnose

# 7. Fill remaining artifacts: roadmap.md, actions.md, test-plan.md
#    Use devflow next after each to see what's still missing

# 8. When state reaches feature-coding-ready, generate the AI prompt
devflow feature prompt 001-user-authentication

# 9. Give the prompt to your AI agent (Claude Code, Cursor, etc.)
#    The agent now has: goals, architecture, actions, tests, forbidden files

# 10. After implementation, verify
devflow feature complete 001-user-authentication
devflow adversarial-review 001-user-authentication
devflow gatekeep 001-user-authentication --approve --actor "reviewer-name"
```

**Key rule**: Do not start coding before `feature-coding-ready` state. The system blocks premature implementation.

### Path 2: Brownfield (Existing Codebase)

Working with an existing project that was not built with Devflow.

```bash
# 1. Install Devflow in the existing project
npx @tjsasakinpm/devflow install

# 2. Discover and map the existing codebase
devflow discover
# Generates reports in _devflow/discovery/:
#   system-map.md    — structure, entrypoints, modules, dependencies
#   risk-map.md      — sensitive files, coupling, TODO/FIXME, untested areas
#   testing-baseline.md — how to run tests/lint/typecheck, current state
#   change-zones.md  — safe / caution / do-not-touch zone classification

# 3. Read the discovery reports before touching any code
#    Understand what exists, what's risky, what's untested

# 4. Create a feature workspace
devflow feature new "add-payment-integration"

# 5. The feature workspace references discovery reports automatically
#    Fill requirements.md considering existing architecture constraints

# 6. Before coding, create legacy-impact.md
#    Document what existing code will be affected, migration strategy, rollback plan

# 7. Proceed through the same pipeline as greenfield from here
devflow next --diagnose
```

**Key rule**: In brownfield, you must understand the terrain before digging. Discovery reports prevent breaking existing behavior.

### Path 3: With an AI Agent (Claude Code, Cursor, etc.)

When using an AI coding assistant together with Devflow.

```bash
# 1. Tell your agent to read DEVFLOW.md first
#    Every Devflow project has a DEVFLOW.md cockpit file
#    Section: "Mandatory Context for Any Agent Before Modifying Code"

# 2. The agent must check the current coding state
#    CAN CODE / CANNOT CODE / CODE COMPLETE — stated at the top

# 3. If state is NOT feature-coding-ready, the agent must refuse to write code
#    Instead, help fill artifacts: requirements, roadmap, actions, test-plan

# 4. When ready, use the implementation prompt
devflow feature prompt 001-my-feature --copy
#    Paste into Claude Code / Cursor with the full context

# 5. The agent works action-by-action, logging each step
#    Updates implementation-log.jsonl after every action
#    Runs validation commands after every action
```

**Key rule**: An agent that writes code before `feature-coding-ready` produces output with conviction but no correctness guarantee. Devflow exists to prevent exactly that.

## Commands

### STABLE — Fully implemented and tested

| Command | Description |
|---------|-------------|
| `devflow init` | Initialize Devflow in current directory |
| `devflow status [--json] [--verbose]` | Show project state, confidence, evidence |
| `devflow next [--json] [--diagnose]` | Recommend next best action |
| `devflow feature new <name> [--actor] [--non-interactive]` | Create feature workspace |
| `devflow feature complete <id>` | Run 25 Definition of Done checks |
| `devflow feature prompt <id> [--copy] [--save] [--output]` | Generate AI implementation prompt |
| `devflow gatekeep <id> --approve\|--reject [--actor]` | Independent gatekeeper review |
| `devflow adversarial-review <id>` | Adversarial review — 12 attack vectors |
| `devflow doctor [--fix] [--dry-run]` | Diagnose and fix common issues |
| `devflow update-cockpit` | Regenerate DEVFLOW.md cockpit |
| `devflow index` | Map project structure and build search index |

### EXPERIMENTAL — Partial implementation, may have rough edges

| Command | Description |
|---------|-------------|
| `devflow discover` | Discover and document brownfield project structure |
| `devflow eval run` | Run evaluation suite and generate report |

### PREVIEW — Placeholder stubs, print intention only (no real execution)

These commands are not yet implemented. They display a structured placeholder message describing what the command will do when built. Use the manual alternatives listed.

| Command | Manual Alternative |
|---------|-------------------|
| `devflow ai init` | Set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` env vars directly |
| `devflow requirements audit <id>` | Review `_devflow/features/<id>/requirements.md` against pedagogical criteria |
| `devflow design review <id>` | Review `_devflow/features/<id>/roadmap.md` for architectural soundness |
| `devflow tests review <id>` | Review `_devflow/features/<id>/test-plan.md` for coverage gaps |
| `devflow actions generate <id>` | Use the actions template in `_devflow/features/<id>/` |
| `devflow drift check <id>` | Compare requirements.md acceptance criteria against implementation-log.jsonl |
| `devflow adversarial-review-ai <id>` | Use `devflow adversarial-review` (deterministic, 12 vectors, fully implemented) |
| `devflow trace <runId>` | Run artifacts will be in `.devflow/ai/runs/` when available |
| `devflow promote <proposalId>` | Copy artifacts manually from `.devflow/ai/runs/` to `_devflow/features/` |

### Global Options

```bash
devflow --mode strict gatekeep my-feature --approve --actor "reviewer"
```

Modes: `local` (default), `experimental`, `strict`, `release`

| Mode | CI missing | CI failed | Unknown actors | Inconclusive review |
|------|-----------|-----------|---------------|-------------------|
| local | advisory | advisory | advisory | advisory |
| experimental | advisory | blocking | advisory | advisory |
| strict | blocking | blocking | blocking | blocking |
| release | blocking | blocking | blocking | blocking |

## Project States (22-state engine)

### Project Detection
`no-project` → `greenfield-idea` → `greenfield-specified`
`brownfield-unknown` → `brownfield-discovered` → `brownfield-specified`

### Feature Pipeline
`feature-empty` → `feature-requirements` → `feature-clarification-needed`
→ `feature-design` → `feature-design-reviewed`
→ `feature-test-plan` → `feature-test-plan-ready`
→ `feature-pre-code-audit` → `feature-coding-ready`
→ `feature-coding-in-progress`
→ `feature-verification` → `feature-ci-verified`
→ `feature-review` → `feature-adversarial-review`
→ `feature-done`

### Anomaly States
`drift-detected` — code-spec divergence detected
`blocked` — explicit blocker prevents progress

## Output Files

| File | Purpose |
|------|---------|
| `.devflow/state.json` | Current state, confidence, blockers |
| `.devflow/config.json` | Configuration (execution mode, gates, CI) |
| `.devflow/constitution.md` | Engineering constitution (12 rules, C1-C12) |
| `.devflow/audits/gatekeep-log.jsonl` | Gatekeep decisions with actor, hash, git context |
| `.devflow/audits/adversarial-review.md` | Per-vector adversarial review report |
| `.devflow/audits/dod-summary.md` | Definition of Done summary |
| `_devflow/features/<id>/` | Feature workspace (artifacts, logs) |
| `_devflow/discovery/` | Brownfield discovery reports |
| `DEVFLOW.md` | Project cockpit — auto-generated, read by AI agents before any action |
| `CLAUDE.md` | Devflow section for Claude Code integration |

## Dangerous Path (What NOT to Do)

```bash
# Editing .devflow/state.json manually — bypasses all gates
git add . && git commit -m "done"  # No state transition, no DoD, no review

# Gatekeep without flags — BLOCKED (requires explicit --approve or --reject)
devflow gatekeep my-feature

# Same actor implementing and approving — BLOCKED (Constitution C12)
devflow gatekeep my-feature --approve  # If actor matches implementer

# Coding without artifacts — BLOCKED (pre-action guard)
# Missing: requirements.md, roadmap.md, actions.md, test-plan.md, etc.

# Using devflow feature prompt before requirements are complete
# The command will refuse — missing artifacts block prompt generation
```

## Installation

The package is `@tjsasakinpm/devflow` (scoped); the binary is `devflow`. This is standard npm — the package name and the command name can differ.

### Recommended (no install needed)

```bash
npx @tjsasakinpm/devflow install
```

Guided first-run onboarding: stack detection, environment checks, project initialization.

### Optional (global install)

```bash
npm install -g @tjsasakinpm/devflow
devflow install
```

### Technical / Advanced

```bash
npx @tjsasakinpm/devflow init
```

`init` skips guided onboarding. Better for scripts and automation.

Requires Node.js >= 18.

## Development

```bash
git clone https://github.com/tjsasakifln/devflow
cd devflow
npm install
npm run build
npm test
```

## License

MIT — see [LICENSE](LICENSE).
