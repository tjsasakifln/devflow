# Changelog

## [1.0.0] — 2026-07-08 — Quality Hardening & v1.0 Release

**Epic 4 culminates in the v1.0.0 stable release.** All PREVIEW/EXPERIMENTAL commands graduate to STABLE. Every module has test coverage, zero security advisories, and documented performance baselines.

### Epic 4: PREVIEW Commands — All STABLE

#### New Commands

- `devflow ai init` — Configure AI provider integration (Claude Code, Cursor, Copilot)
- `devflow actions-generate` — Generate actions from requirements and roadmap artifacts
- `devflow tests-review` — Review test plan against requirements with coverage analysis
- `devflow drift-check` — Detect drift between requirements and implementation via evidence comparison
- `devflow design-review` — Review roadmap and design artifacts for structural completeness
- `devflow requirements-audit` — Audit requirements quality, consistency, and [DOUBT] detection
- `devflow adversarial-review-ai` — AI-assisted adversarial review (LLM-powered, 12 attack vectors)
- `devflow analyze` — Analyze project for specified architectural concern
- `devflow trace` — Trace requirements through design, implementation, and verification
- `devflow promote` — Promote feature artifact to next pipeline stage

### Kernel Restructuring — Epic 4

- Moved `src/artifacts/` into `src/kernel/artifacts/` with consolidated imports and redirect shims
- Removed deprecated `src/constitution/`, `src/cockpit/`, `src/engine/` files reused from kernel equivalents
- **orchestration module** (`src/kernel/orchestration/`): parallel agent spawning, adversarial verification, completeness critic, result merger
- **workflow module** (`src/kernel/workflow/`): engine, agent delegation, authority enforcement, handoff protocol, persistence, loader
- **discovery module** (`src/kernel/discovery/`): archaeologist, architect, detective, orchestrator, schema extractor, scout, writer
- Consolidated types, utils, config, detection, errors under `src/kernel/` tree

### Quality Hardening — Story 4.4

#### Test Coverage

- `src/kernel/validators/structural.ts` — **100% lines**, 93.93% branches
- `src/kernel/evidence/confidence.ts` — 82.58% lines, 80.95% branches
- `src/kernel/evidence/gatherer.ts` — 96.52% lines, 81.03% branches
- `src/kernel/audit/chain-verifier.ts` — hash computation, chain validation, machine fingerprint
- `src/kernel/audit/generator.ts` — engineering review and release audit report generation
- `src/kernel/ci/verifier.ts` — pure functions: `isCIRequired`, `isCIGreen`, `isCIUnavailableBlocking`
- New test files: `validators-structural.test.ts`, `audit-chain.test.ts`, `ci-verifier.test.ts`, `evidence-confidence.test.ts`, `evidence-gatherer.test.ts`, `utils.test.ts`, `logger.test.ts`, `version.test.ts`, `remediation.test.ts`, `dimensions.test.ts`
- 38 test files, 655 tests — all passing

#### Security

- Updated vitest from 2.x to 4.x (vite 5.x → 8.x, esbuild 0.21.5 → 0.28.1)
- Resolved 2 critical, 1 high, 3 moderate advisories
- **Zero vulnerabilities** in `npm audit`

#### Performance

- Optimized git status detection: replaced `git status --porcelain` (~1.25s) with parallel `git diff --quiet + git ls-files --others` (~0.4s)
- `devflow status`: **~1.5s** (target: <2s)
- `devflow next`: **~1.5s** (target: <3s)
- Parallelized file existence checks in project scanner and inspector

#### Documentation

- README: complete 27-command table with descriptions
- All commands now listed as STABLE (no PREVIEW/EXPERIMENTAL badges)
- Roadmap section replaced with future directions
- Performance baseline documented in README

### CLI & Integration

- `/devflow` slash command now resolves CLI invocation correctly for both local and npx temp installations
- Claude Code SKILL.md replaces deprecated settings.json integration
- Pipe-safe JSON output for all CLI commands (`--format json`)
- Banner in stderr, JSON in stdout — safe for `| jq` pipelines

### Breaking Changes

- **Removed deprecated paths**: `src/artifacts/`, `src/constitution/`, `src/cockpit/`, `src/engine/` files deleted. If importing directly from these paths, update to `src/kernel/` equivalents. Deprecated re-exports were maintained for one minor version and are now removed.

---

## [0.4.6] — 2026-07-08

### Fixes

- Reject npx temp binaries in resolver to prevent invocation errors
- Create `/devflow` slash command for Claude Code integration
- Correct CLI invocation command for accurate onboarding messages
- Replace `settings.json` with `SKILL.md` for Claude Code integration

---

## [0.4.5] — 2026-07-08

### Fixes

- Continuous iteration on CI reliability and CLI validation

---

## [0.4.3] — 2026-07-08

### Fixes

- Replace settings.json with SKILL.md for Claude Code integration
- Resolve CLI invocation command for accurate onboarding messages
- Make CLI validation blocking in CI — no silent skips
- Skip JSON pipe-safe tests when dist/ not yet built
- Correct audit scope model and release blockers
- Harden v0.4.0 audit and GitHub Action reliability

---

## [0.4.0] — Local PR risk reports for AI-generated code

### Features

- `devflow review-pr` — Generate PR risk report with markdown, HTML, and JSON formats
- `devflow risk-tolerance` — Configurable risk profiles (relaxed, moderate, strict)
- Full GitHub Actions CI workflow for PR governance
- Pipe-safe JSON output for all CLI commands
- Adversarial review across 12 attack vectors
- Independent gatekeeper review with Constitution C12 enforcement

### Infrastructure

- 25 Definition of Done checks with integrity consolidation
- Stack-adaptive gates (TypeScript, JavaScript, Python, Go, Rust, PHP, Java)
- Opt-in git hook installation
- Doctor command with 4 self-diagnosis checks

---

## [0.3.0] — AI PR Governance

### Features

- `devflow init` with tool configs and readiness checklist
- `devflow doctor` — Diagnose and fix common issues
- `devflow review-pr` — PR risk report generation (initial)
- Risk tolerance framework with gate behavior tables
- Solo-hardened review mode for independent developers

### Improvements

- Brownfield discovery with four reports (architecture, DB, UX, QA)
- Feature prompt generator for AI agents
- End-to-end flow tests for greenfield and brownfield
- Deprecated re-export shims for backward compatibility

---

## [0.2.0] — Engineering Governance Kernel

### Features

- `devflow gatekeep` — Independent gatekeeper review
- `devflow feature complete` — 25 DoD checks
- `devflow adversarial-review` — Deterministic adversarial review
- `devflow next` — Recommends next best action
- `devflow status` — Project state, confidence, evidence
- `devflow index` — Map project structure

### Architecture

- State machine with 22 states across 3 domains
- Evidence-based confidence scoring
- Constitutional enforcement (C1-C12)
- Brownfield discovery system

---

## [0.1.0] — Initial MVP

### Features

- `devflow audit` — Pre-commit risk snapshot
- `devflow feature new` — Feature workspace creation
- `devflow install` — Guided onboarding
- Basic spec-driven workflow enforcement
- Claude Code integration via `/devflow` command

[1.0.0]: https://github.com/tjsasakifln/devflow/releases/tag/v1.0.0
[0.4.6]: https://github.com/tjsasakifln/devflow/releases/tag/v0.4.6
[0.4.5]: https://github.com/tjsasakifln/devflow/releases/tag/v0.4.5
[0.4.3]: https://github.com/tjsasakifln/devflow/releases/tag/v0.4.3
[0.4.0]: https://github.com/tjsasakifln/devflow/releases/tag/v0.4.0
[0.3.0]: https://github.com/tjsasakifln/devflow/releases/tag/v0.3.0
[0.2.0]: https://github.com/tjsasakifln/devflow/releases/tag/v0.2.0
[0.1.0]: https://github.com/tjsasakifln/devflow/releases/tag/v0.1.0
