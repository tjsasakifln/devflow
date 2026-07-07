# Changelog

## v0.4.0 -- Local PR Risk Reports for AI-Generated Code

**Why this matters for AI-generated code:** Teams using Claude Code, Cursor, and Copilot now have a zero-friction entry point to audit AI-generated changes before they reach a PR. No feature setup required. The `devflow audit` command scans local changes for dangerous patterns and generates a professional risk report in markdown, HTML, or JSON.

### New Commands

- `devflow audit` -- audit local changes for AI-generated code risks (no feature setup required)
  - Options: `--staged`, `--working-tree`, `--base <branch>`, `--format markdown|html|json`, `--output <file>`, `--risk-tolerance relaxed|moderate|strict`

### Enhanced

- `devflow review-pr` -- now supports `--format markdown|html|json` for professional report output
  - HTML reports: standalone, dark/light mode, collapsible sections, copy-to-clipboard
  - Markdown reports: enhanced with severity matrix, executive summary, what-could-have-shipped-broken, Devflow Governed badge
  - JSON reports: machine-readable for CI integration

### Architecture

- Core/CLI separation: business logic extracted to `src/core/`, command wrappers in `src/cli/`
- Renderers: markdown, HTML, JSON, and badge rendering extracted to `src/renderers/`
- Stack adapters: `StackAdapter` interface with TypeScript, Python, Go, Rust implementations
- Git adapter: enhanced with diff model, exclusion rules, hook bypass logging

### Integration

- GitHub Actions: `action.yml` for CI-based PR auditing with `$GITHUB_STEP_SUMMARY` support
- Example workflow: `.github/workflows/devflow-example.yml`
- Git hooks: enhanced pre-commit and pre-push with bypass logging

### Documentation

- Comparison pages: Devflow vs CodeRabbit, Copilot Code Review, linters, CI, Cursor Rules, Claude Code
- How-to guides: 9 guides covering Claude Code audit, Cursor review, PR risk reports, GitHub Actions, legacy codebases, solo founders, FastAPI
- Use-case pages: Engineering Managers, Tech Leads, Staff Engineers, Platform Engineers, Security Teams, Solo Founders, Open Source Maintainers
- FAQ: 15 questions covering common adoption concerns

### Under the Hood

- Expanded npm keywords (23 terms) for discovery
- Rewritten README for organic search (AI code review, governance, Claude Code, Cursor, Copilot)
- "Devflow Governed" badge for PR reports
- Professionalized repository: CONTRIBUTING.md, ARCHITECTURE.md, SECURITY.md, CODE_OF_CONDUCT.md
- Issue and PR templates

---

## v0.3.0 -- Governance Engine, Adversarial Review, and Professional Reports

- Full feature lifecycle: `feature new`, `feature complete`, `gatekeep`, `adversarial-review`
- 25 Definition of Done checks across 7 languages
- 12 adversarial attack vectors for feature review
- Constitution C12 enforcement: implementer cannot be approver
- Professional HTML and markdown PR risk reports
- GitHub Actions integration via `action.yml`
- Execution modes: local, experimental, strict, release
- Risk tolerance levels: relaxed, moderate, strict
- `devflow discover` for brownfield analysis (EXPERIMENTAL)
- Stack detection for TypeScript, Python, Go, Rust
- Git exclusion rules and hook bypass logging
- Example CI workflow

---

## v0.2.0 -- Init, Install, and Project Scaffolding

- `devflow init` and `devflow install` for project setup
- `devflow status` for project health overview
- `devflow next` for action recommendations
- `devflow index` for project structure mapping
- `devflow config` for execution mode settings
- `devflow doctor` for diagnostics and auto-fix
- DEVFLOW.md cockpit generation
- Basic feature artifact templates
- Pre-commit and pre-push Git hooks
- Initial CLI structure with Commander.js

---

## v0.1.0 -- Initial Release

- Project scaffolding and CLI skeleton
- Basic command registration
- Package published to npm
