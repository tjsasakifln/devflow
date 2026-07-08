# Devflow — Local AI Coding Governance

> Engineer AI-generated code with auditable evidence, pre-PR risk reports, and engineering guardrails. Runs locally. No LLM API keys required. No third-party review SaaS.

[![npm version](https://img.shields.io/npm/v/@tjsasakinpm/devflow)](https://www.npmjs.com/package/@tjsasakinpm/devflow)
[![npm install](https://img.shields.io/badge/npx_install-@tjsasakinpm/devflow-blue)](https://www.npmjs.com/package/@tjsasakinpm/devflow)
[![node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![local-first](https://img.shields.io/badge/local--first-no--cloud-7B61FF)](https://github.com/tjsasakifln/devflow)

---

## Use Devflow if…

- **You're receiving AI-generated PRs with no evidence of testing or review** — Devflow makes the invisible visible before code lands.
- **You use Claude Code, Cursor, or Copilot and want guardrails** before code reaches PR — audit locally, fail fast, fix before push.
- **You need a risk report to paste into a PR** before asking for human review — `devflow review-pr` generates markdown you can attach.
- **You work in a legacy codebase and AI agents keep breaking architecture boundaries** — Devflow enforces spec-driven coding and catches architectural drift.
- **You're a solo founder who ships fast but worries about accumulating technical debt** — relaxed mode keeps you moving without losing the audit trail.
- **You want CI/CD integration for AI code governance** without sending code to LLM providers or third-party review SaaS; when run on GitHub Actions, code is processed inside the configured CI runner — Devflow runs locally and also works in GitHub Actions.
- **Your team confuses "the tests pass" with "the code is well-engineered"** — Devflow checks evidence, not just green CI.
- **You need an audit trail to show compliance**, not just a green CI checkmark — every decision is logged with hashes, actor identity, and git context.

---

## Quick Commands Per Use Case

| You Need This | Run That |
|---|---|
| **Audit AI-generated changes before commit** | `npx devflow audit` |
| **Generate a PR risk report** | `npx devflow review-pr --format markdown` |
| **Full AI governance workflow** | `npx devflow feature new` → `feature complete` → `gatekeep` |
| **Run AI code audit in CI** | See [GitHub Actions section](#github-actions) |
| **Adversarial review of a feature** | `npx devflow adversarial-review <id>` |

---

## What Devflow Does

- **Audits AI-generated changes** before they reach a PR — `devflow audit` scans local changes, checks against evidence requirements, and produces a pre-commit risk snapshot.
- **Enforces a spec-driven workflow** before AI agents write code — no code before requirements, no merge before review.
- **Runs 25 Definition of Done checks** including integrity consolidation across TypeScript, JavaScript, Python, Go, Rust, PHP, and Java.
- **Generates structured implementation prompts** for AI agents so they produce traceable, governed output.
- **Adversarial review across 12 attack vectors** — including bypass attempts, hallucination detection, and architecture boundary violation checks.
- **Independent gatekeeper review** — implementer cannot be approver (Constitution C12).
- **Generates PR risk reports** in HTML or markdown format that you can paste into any pull request.
- **Integrates with CI** via GitHub Actions — gates run automatically on every PR.
- **Produces auditable evidence** — every decision logged with actor identity, content hashes, git context, and timestamps.
- **Configurable risk tolerance**: relaxed (solo builder), moderate (team), strict (release).

---

## What Devflow Does NOT Do

- Does **not** guarantee bug-free code
- Does **not** replace human code review
- Does **not** prevent deliberate process bypass
- Does **not** write code for you — it prepares the ground so AI-generated code has evidence
- Does **not** require LLM API keys or third-party review SaaS accounts — **runs fully local by default; when used in GitHub Actions, code is processed inside the CI runner. Devflow has no SaaS backend, no telemetry, and never sends code to LLM providers or third-party review services.**

> **Privacy:** Devflow has no SaaS backend, collects no telemetry, and never sends your code to external services. CI artifact upload is optional and controlled by your workflow configuration. See [docs/local-first.md](docs/local-first.md) for details.

---

## How Devflow Compares

| Tool | Cloud Required? | Evidence Enforcement? | Pre-PR Risk Report? | Adversarial Review? |
|---|---|---|---|---|
| **Devflow** | No — fully local | Yes | Yes | Yes (12 vectors) |
| ESLint / Biome | No | No — style only | No | No |
| CodeRabbit | Yes | No — post-hoc | Partial | No |
| Cursor Rules | No | No — advisory | No | No |
| Claude Code alone | No | No — trusts output | No | No |
| CI-only checks | No | No — green check only | No | No |

Devflow is not a linter. It is not a CI pipeline. It is an **engineering governance framework** that makes AI-generated code auditable, evidence-backed, and ready for human review.

---

## Quick Start

### Recommended: Install as project dependency

Devflow is a recurring governance tool — install it locally so it's always available:

```bash
npm install --save-dev @tjsasakinpm/devflow
npx devflow install

# Then use via npx:
npx devflow audit
npx devflow feature new "my-feature"
npx devflow next
npx devflow doctor
```

### Set up npm scripts (optional but recommended)

After installing, add to your `package.json` scripts for even shorter commands:

```json
"scripts": {
  "devflow": "devflow",
  "devflow:status": "devflow status",
  "devflow:doctor": "devflow doctor",
  "devflow:audit": "devflow audit",
  "devflow:next": "devflow next"
}
```

Then: `npm run devflow:status`, `npm run devflow:audit`, etc.

### Try without installing (one-off evaluation)

For a single evaluation run without modifying `package.json`:

```bash
npx -y @tjsasakinpm/devflow@latest install
npx -y @tjsasakinpm/devflow@latest audit
npx -y @tjsasakinpm/devflow@latest feature new "my-feature"
```

Every command must use the full `npx -y @tjsasakinpm/devflow@latest` prefix — the bare `devflow` command is only available after local or global install.

[Full demo ->](examples/ai-pr-governance-demo/)

---

## Three Setup Paths

### Solo Builder

Working alone? Devflow becomes your second pair of eyes.

```bash
npx devflow config set riskTolerance relaxed
npx devflow config set reviewMode solo-hardened
```

Self-approval OK. Adversarial review compensates for missing reviewer. Lint and coverage become advisory — still visible, not blocking.

### Team

Standard team setup with role segregation.

```bash
npx devflow install --review-mode independent
```

Implementer != approver enforced (Constitution C12). Independent gatekeep required before merge.

### Strict / Release

CI required. All gates blocking. Full audit trail.

```bash
npx devflow config set executionMode strict
npx devflow config set riskTolerance strict
```

Unknown actors blocked. Every check must pass. Implementation log must be complete.

---

## Commands

### STABLE — Fully implemented and tested

| Command | Description |
|---------|-------------|
| `npx devflow audit` | Audit AI-generated changes before they reach a PR |
| `npx devflow install` | Guided first-run setup |
| `npx devflow init` | Initialize Devflow (script-friendly) |
| `npx devflow status [--json] [--verbose]` | Show project state, confidence, evidence |
| `npx devflow next [--json] [--diagnose]` | Recommend next best action |
| `npx devflow feature new <name>` | Create feature workspace |
| `npx devflow feature complete <id>` | Run 25 Definition of Done checks |
| `npx devflow feature prompt <id> [--copy] [--save]` | Generate AI implementation prompt |
| `npx devflow gatekeep <id> --approve\|--reject` | Independent gatekeeper review |
| `npx devflow adversarial-review <id>` | Adversarial review — 12 attack vectors |
| `npx devflow review-pr [--base <branch>] [--output <file>] [--format <format>]` | Generate PR risk report |
| `npx devflow doctor [--fix]` | Diagnose and fix common issues |
| `npx devflow update-cockpit` | Regenerate DEVFLOW.md cockpit |
| `npx devflow index` | Map project structure |
| `npx devflow config set <key> <value>` | Configure reviewMode, executionMode, riskTolerance |

### EXPERIMENTAL — Partial implementation

| Command | Description |
|---------|-------------|
| `npx devflow discover` | Discover and document brownfield project structure |
| `npx devflow eval run` | Run evaluation suite |

---

## Configuration

```bash
# Review mode
npx devflow config set reviewMode independent      # Different actor required (default)
npx devflow config set reviewMode solo-hardened    # Self-approval with compensating evidence

# Execution mode
npx devflow config set executionMode local         # Default
npx devflow config set executionMode strict        # CI required, all gates blocking

# Risk tolerance
npx devflow config set riskTolerance relaxed       # Solo: advisory gates, self-approval OK
npx devflow config set riskTolerance moderate      # Team: standard gates (default)
npx devflow config set riskTolerance strict        # Release: all gates blocking, CI mandatory
```

The `audit` command supports a `--risk-tolerance` flag to override the project default for a single run:

```bash
npx devflow audit --risk-tolerance strict
```

### Risk Tolerance Behavior

| Gate | relaxed | moderate | strict |
|------|---------|----------|--------|
| Typecheck | blocking | blocking | blocking |
| Tests | blocking | blocking | blocking |
| Coverage | advisory | blocking | blocking |
| Lint | advisory | blocking | blocking |
| Implementer != approver | advisory | blocking | blocking |
| Adversarial review | blocking | blocking | blocking |
| CI | ignored | advisory | blocking |
| Missing artifacts | advisory | advisory | blocking |

---

## GitHub Actions

Devflow runs fully in CI without sending code to LLM providers or third-party review SaaS — processing is inside the CI runner. Example workflow:

```yaml
name: Devflow PR Governance
on: [pull_request]
jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx @tjsasakinpm/devflow init
      - run: npx @tjsasakinpm/devflow feature complete feature-id
      - run: npx @tjsasakinpm/devflow adversarial-review feature-id
      - run: npx @tjsasakinpm/devflow gatekeep feature-id --approve --actor github-actions
```

---

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

---

## Project States

Devflow tracks 22 states across project detection (5), feature pipeline (15), and anomaly states (2). States progress: `feature-empty` -> `feature-requirements` -> `feature-design` -> `feature-test-plan` -> `feature-pre-code-audit` -> `feature-coding-ready` -> `feature-coding-in-progress` -> `feature-verification` -> `feature-review` -> `feature-done`.

**Key rule:** AI agents must not write code before `feature-coding-ready` state. Devflow blocks premature implementation.

---

## Installation

```bash
npm install --save-dev @tjsasakinpm/devflow  # Local install (recommended)
npx devflow install                           # Guided onboarding
npx devflow init                              # Script-friendly (no onboarding)

# Or install globally:
npm install -g @tjsasakinpm/devflow
```

Requires Node.js >= 18.

---

## Development

```bash
git clone https://github.com/tjsasakifln/devflow
cd devflow
npm install
npm run build
npm test
```

---

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

---

## License

MIT — see [LICENSE](LICENSE).

---

> `[!NOTE]`
> Built for teams who treat AI-generated code with the same rigor as human-written code.
> Devflow Governed — [docs site](https://github.com/tjsasakifln/devflow) (coming soon).
