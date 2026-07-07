# Devflow

> PR governance for AI-generated code — reduce risk, enforce evidence, produce auditable trails.

[![npm version](https://img.shields.io/npm/v/@tjsasakinpm/devflow)](https://www.npmjs.com/package/@tjsasakinpm/devflow)
[![npm install](https://img.shields.io/badge/npx_install-@tjsasakinpm/devflow-blue)](https://www.npmjs.com/package/@tjsasakinpm/devflow)
[![node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Why Devflow?

AI agents (Claude Code, Cursor, Copilot) ship code fast. They also ship code without requirements, tests, evidence, review, or traceability. **Devflow exists to stop that.**

It doesn't promise bug-free code. It doesn't claim to make AI code safe. It makes AI-generated code **auditable**: every change linked to a feature, every feature backed by evidence, every merge gated by adversarial review.

**Enforcement model:** Devflow blocks when you voluntarily run its commands. Optional git hooks make it mandatory. Devflow is not a sandbox and cannot prevent deliberate bypass — but it creates an audit trail that makes bypass visible.

## What Devflow Does

- Enforces a spec-driven workflow before AI agents write code
- Runs 25 Definition of Done checks including integrity consolidation
- Generates structured implementation prompts for AI agents
- Adversarial review across 12 attack vectors (including bypass attempts)
- Independent gatekeeper review (implementer ≠ approver)
- Generates **PR risk reports** you can paste into any pull request
- Produces auditable evidence (actor identity, hashes, git context)
- Stack-adaptive validation: TypeScript, JavaScript, Python, Go, Rust, PHP, Java
- Configurable risk tolerance: relaxed (solo), moderate (team), strict (release)

## What Devflow Does NOT Do

- Does **not** guarantee bug-free code
- Does **not** replace human code review
- Does **not** prevent deliberate process bypass
- Does **not** write code for you — it prepares the ground so code has evidence
- Does **not** require API keys or SaaS accounts — runs fully local

## Quick Start

```bash
# Install Devflow in your project (30 seconds)
npx @tjsasakinpm/devflow install

# Create your first feature
devflow feature new "my-feature"

# Fill artifacts, follow guidance
devflow next

# When ready, generate AI implementation prompt
devflow feature prompt 001-my-feature --copy

# After implementation, verify
devflow feature complete 001-my-feature
devflow adversarial-review 001-my-feature
devflow gatekeep 001-my-feature --approve --actor "reviewer"

# Generate PR risk report
devflow review-pr
```

[Full demo →](examples/ai-pr-governance-demo/)

## Three Setup Paths

### 🧑‍💻 Solo Builder

Working alone? Devflow becomes your second pair of eyes.

```bash
devflow config set riskTolerance relaxed
devflow config set reviewMode solo-hardened
```

Self-approval OK. Adversarial review compensates for missing reviewer. Lint and coverage become advisory — still visible, not blocking.

### 👥 Team

Standard team setup with role segregation.

```bash
devflow install --review-mode independent
```

Implementer ≠ approver enforced (Constitution C12). Independent gatekeep required before merge.

### 🔒 Strict / Release

CI required. All gates blocking. Full audit trail.

```bash
devflow config set executionMode strict
devflow config set riskTolerance strict
```

Unknown actors blocked. Every check must pass. Implementation log must be complete.

## Commands

### STABLE — Fully implemented and tested

| Command | Description |
|---------|-------------|
| `devflow install` | Guided first-run setup |
| `devflow init` | Initialize Devflow (script-friendly) |
| `devflow status [--json] [--verbose]` | Show project state, confidence, evidence |
| `devflow next [--json] [--diagnose]` | Recommend next best action |
| `devflow feature new <name>` | Create feature workspace |
| `devflow feature complete <id>` | Run 25 Definition of Done checks |
| `devflow feature prompt <id> [--copy] [--save]` | Generate AI implementation prompt |
| `devflow gatekeep <id> --approve\|--reject` | Independent gatekeeper review |
| `devflow adversarial-review <id>` | Adversarial review — 12 attack vectors |
| `devflow review-pr [--base <branch>] [--output <file>]` | Generate PR risk report |
| `devflow doctor [--fix]` | Diagnose and fix common issues |
| `devflow update-cockpit` | Regenerate DEVFLOW.md cockpit |
| `devflow index` | Map project structure |
| `devflow config set <key> <value>` | Configure reviewMode, executionMode, riskTolerance |

### EXPERIMENTAL — Partial implementation

| Command | Description |
|---------|-------------|
| `devflow discover` | Discover and document brownfield project structure |
| `devflow eval run` | Run evaluation suite |

## Configuration

```bash
# Review mode
devflow config set reviewMode independent      # Different actor required (default)
devflow config set reviewMode solo-hardened    # Self-approval with compensating evidence

# Execution mode
devflow config set executionMode local         # Default
devflow config set executionMode strict        # CI required, all gates blocking

# Risk tolerance
devflow config set riskTolerance relaxed       # Solo: advisory gates, self-approval OK
devflow config set riskTolerance moderate      # Team: standard gates (default)
devflow config set riskTolerance strict        # Release: all gates blocking, CI mandatory
```

### Risk Tolerance Behavior

| Gate | relaxed | moderate | strict |
|------|---------|----------|--------|
| Typecheck | blocking | blocking | blocking |
| Tests | blocking | blocking | blocking |
| Coverage | advisory | blocking | blocking |
| Lint | advisory | blocking | blocking |
| Implementer ≠ approver | advisory | blocking | blocking |
| Adversarial review | blocking | blocking | blocking |
| CI | ignored | advisory | blocking |
| Missing artifacts | advisory | advisory | blocking |

## Output Files

| File | Purpose |
|------|---------|
| `.devflow/config.json` | Configuration |
| `.devflow/state.json` | Current state, confidence, blockers |
| `.devflow/constitution.md` | Engineering constitution (C1-C12) |
| `.devflow/audits/gatekeep-log.jsonl` | Gatekeep decisions with audit trail |
| `.devflow/audits/<id>/adversarial-review.md` | Per-vector adversarial review report |
| `_devflow/features/<id>/` | Feature workspace (artifacts, logs) |
| `_devflow/discovery/` | Brownfield discovery reports |
| `DEVFLOW.md` | Project cockpit — auto-generated for AI agents |

## Project States

Devflow tracks 22 states across project detection (5), feature pipeline (15), and anomaly states (2). States progress: `feature-empty` → `feature-requirements` → `feature-design` → `feature-test-plan` → `feature-pre-code-audit` → `feature-coding-ready` → `feature-coding-in-progress` → `feature-verification` → `feature-review` → `feature-done`.

**Key rule:** AI agents must not write code before `feature-coding-ready` state. Devflow blocks premature implementation.

## Installation

```bash
npx @tjsasakinpm/devflow install    # Guided onboarding (recommended)
npm install -g @tjsasakinpm/devflow # Global install
npx @tjsasakinpm/devflow init       # Script-friendly (no onboarding)
```

Requires Node.js >= 18.

## Development

```bash
git clone https://github.com/tjsasakifln/devflow
cd devflow
npm install
npm run build
npm test
```

## Roadmap

Commands planned but not yet built. Use manual alternatives until implemented.

| Planned Command | Manual Alternative Today |
|-----------------|--------------------------|
| `devflow ai init` | Set API keys as env vars |
| `devflow requirements audit` | Review requirements.md manually; use `devflow next --diagnose` |
| `devflow design review` | Review roadmap.md manually |
| `devflow tests review` | Review test-plan.md manually |
| `devflow actions generate` | Copy from templates/actions-template.md |
| `devflow drift check` | Compare requirements vs implementation-log.jsonl |
| `devflow adversarial-review-ai` | Use `devflow adversarial-review` (deterministic, 12 vectors) |
| `devflow trace` | Read .devflow/ai/runs/ artifacts directly |
| `devflow promote` | Copy artifacts manually |

Next round: CI/GitHub Actions integration for automated PR checks.

## License

MIT — see [LICENSE](LICENSE).
