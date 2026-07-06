# Devflow

> fool-resistant, evidence-driven, engineered-by-default: state-aware workflow harness for AI-assisted software development

[![npm version](https://img.shields.io/npm/v/@devflow/cli)](https://www.npmjs.com/package/@devflow/cli)
[![node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Devflow** reduces error probability, raises the cost of skipping engineering steps, produces auditable evidence, and blocks dangerous shortcuts. It does **not** eliminate the need for qualified human review.

## What Devflow Does

- Detects project state across 26 states (greenfield, brownfield, feature phases)
- Enforces a spec-driven workflow with explicit state transitions
- Runs 25 Definition of Done checks before feature completion
- Provides independent gatekeeper review (implementer ≠ approver, Constitution C12)
- Generates auditable evidence (logs with actor identity, hashes, git context)
- Adversarial review across 12 attack vectors (including devflow bypass attempts)
- Pre-action guards prevent coding without prerequisite artifacts
- 4 execution modes: local, experimental, strict, release

## What Devflow Does NOT Do

- Does **not** guarantee bug-free code
- Does **not** replace human code review
- Does **not** prevent deliberate process bypass
- Does **not** guarantee production-readiness from passing checks
- Does **not** automatically detect all code-spec drift
- Does **not** eliminate the need for qualified engineering judgment

## Guarantees

- Every gatekeep decision is logged with actor identity, commit SHA, branch, mode, and version
- Every Definition of Done check produces pass/fail with remediation guidance
- Every state transition is documented in an explicit transition table
- Every adversarial review produces a per-vector report (pass/fail/inconclusive)
- Approval requires explicit `--approve` flag — never implicit
- In strict/release mode, unknown actors and missing CI block approval

## Quick Start (Happy Path)

```bash
npx @devflow/cli init              # Initialize in current directory
devflow status                      # See current project state
devflow next                        # Recommended next action
devflow feature new "my-feature"    # Create feature workspace
# Edit artifacts: requirements.md → roadmap.md → actions.md → test-plan.md
# Implement following actions.md
devflow feature complete my-feature # Run 25 DoD checks
devflow adversarial-review my-feature # 12 attack vectors
devflow gatekeep my-feature --approve --actor "reviewer-name"
```

## Commands

| Command | Description |
|---------|-------------|
| `devflow init` | Initialize Devflow in current directory |
| `devflow status [--json] [--verbose]` | Show project state, confidence, evidence |
| `devflow next [--json]` | Recommend next best action |
| `devflow feature new <name> [--actor]` | Create feature workspace |
| `devflow feature complete <id>` | Run 25 Definition of Done checks |
| `devflow gatekeep <id> --approve\|--reject [--actor]` | Independent gatekeeper review |
| `devflow adversarial-review <id>` | Adversarial review — 12 attack vectors |
| `devflow doctor [--fix] [--dry-run]` | Diagnose and fix common issues |
| `devflow update-cockpit` | Regenerate DEVFLOW.md cockpit |

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

## Project States (26-state engine)

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

### Legacy States (deprecated)
`feature-planning`, `feature-planned`, `feature-todo`

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
| `DEVFLOW.md` | Project cockpit — auto-generated status dashboard |
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
```

## Installation

```bash
npm install -g @devflow/cli
# or
npx @devflow/cli init
```

Requires Node.js >= 18.

## Development

```bash
git clone https://github.com/devflow/devflow
cd devflow
npm install
npm run build
npm test
```

## License

MIT — see [LICENSE](LICENSE).
