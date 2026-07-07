# How to Use Devflow in a Legacy Codebase

## The Problem

Your codebase is old, undocumented, and held together by convention. You are using AI agents to add features, but you are scared of regressions. You don't know which files are safe to modify, which areas have tests, or where architecture violations already exist. AI agents make things worse — they do not understand the implicit boundaries and undocumented dependencies. You need discovery before development.

## The Solution: `devflow discover` and Brownfield Mode

Devflow's `discover` command runs a brownfield analysis that produces four reports about your existing codebase. Use these reports to understand your project before you let AI agents touch it.

```bash
# Run brownfield discovery
devflow discover
```

Then, for each feature, create a `legacy-impact.md` that documents how the change affects existing code.

## Step-by-Step

### 1. Install Devflow

```bash
npx @tjsasakinpm/devflow install --yes
```

### 2. Run brownfield discovery

```bash
devflow discover
```

This generates four reports in `_devflow/discovery/`:

| Report | What It Contains |
|--------|-----------------|
| `system-map.md` | Entrypoints, modules, dependencies, directory tree |
| `risk-map.md` | Large files, TODO/FIXME audit, untested modules, security scan |
| `testing-baseline.md` | Test/lint/typecheck commands and current pass/fail state |
| `change-zones.md` | Safe / caution / no-touch zone classification per file |

### 3. Read the change zones report

Open `_devflow/discovery/change-zones.md`. It classifies every source file into three zones:

**Safe (green)** — has tests, moderate size, no TODO markers. Standard process applies: spec, implement, test, review.

**Caution (yellow)** — missing tests, large files, or unresolved TODOs. Extra review and regression testing required.

**No-Touch (red)** — no tests, large, AND has TODOs. Requires an Architecture Decision Record (ADR) before any modification.

### 4. Create a feature with legacy impact analysis

```bash
devflow feature new migrate-payment-gateway
```

When working in a legacy codebase, always fill in `legacy-impact.md`:

```markdown
# Legacy Impact Analysis — 001-migrate-payment-gateway

## Affected Modules
- src/payments/legacy-processor.ts (no-touch zone — ADR required)
- src/payments/transaction.ts (caution — missing tests)
- src/database/payment-queries.ts (safe)

## Regression Risks
- Legacy processor uses raw SQL — new gateway must match transaction behavior
- No tests exist for refund edge cases
- Payment retry logic undocumented

## Rollback Strategy
1. Feature flag: NEW_PAYMENT_GATEWAY
2. Toggle off reverts to legacy processor
3. Monitor error rates for 48 hours post-deploy
```

### 5. Generate the AI prompt

```bash
devflow feature prompt 001-migrate-payment-gateway --save
```

The prompt includes the legacy impact analysis so the AI agent knows which files are sensitive.

### 6. Run adversarial review before merging

```bash
devflow adversarial-review 001-migrate-payment-gateway
```

The legacy-specific attack vectors (hidden coupling, layer violations, spec-code gap) are especially important for brownfield work.

## Example Discovery Output

```
Devflow Discover — Brownfield Analysis

Scanning project structure, risks, tooling, and change safety...

→ Generating system-map.md...
→ Generating risk-map.md...
→ Generating testing-baseline.md...
→ Generating change-zones.md...

✅ Discovery complete!

Reports generated in: _devflow/discovery/
  → system-map.md       — structure, entrypoints, modules
  → risk-map.md         — sensitive files, coupling, risks
  → testing-baseline.md  — test/lint/typecheck commands & state
  → change-zones.md     — safe / caution / no-touch classification

Next: devflow feature new <name> to start a brownfield feature.
      The feature will reference these discovery reports.
```

### Sample change-zones.md excerpt:

```
## 🟢 Safe to Change

- src/utils/formatting.ts — tested, moderate size, no TODOs
- src/api/health.ts — tested, simple handler

## 🟡 Change with Caution

- src/payments/legacy-processor.ts — no tests, 780 lines
- src/database/connection.ts — critical infrastructure, no tests

## 🔴 Do Not Touch Without ADR

- src/auth/session-manager.ts — no tests, 1200 lines, 5 TODO markers
- src/core/event-bus.ts — no tests, 900 lines, coupling to 12 modules
```

## Configuring for Legacy Safety

```bash
# Strict mode for legacy — catches everything
devflow config set riskTolerance strict

# Enable constitution checks to catch architecture drift
# Edit .devflow/config.json:
#   "constitution": { "enabled": true, "blockingGates": true }
```

## Legacy-Specific Workflow

For each brownfield feature, the workflow is:

1. `devflow discover` — understand the codebase (one-time, re-run after major changes)
2. `devflow feature new <name>` — create workspace
3. Fill `requirements.md` + `roadmap.md` + `legacy-impact.md`
4. `devflow feature prompt <id> --save` — generate AI prompt
5. AI implements with logging
6. `devflow review-pr --base main` — audit changes
7. `devflow adversarial-review <id>` — check for regressions
8. `devflow feature complete <id>` — DoD verification
9. `devflow gatekeep <id> --approve --actor <reviewer>`

## Next Steps

- Re-run `devflow discover` after each major release to keep the discovery reports current.
- Create ADRs in `.devflow/decisions/` for every change to no-touch zone files.
- Use `devflow doctor` to check if your legacy project has common setup issues.
- Set up CI governance (see GitHub Actions guide) to catch legacy regressions automatically.

Devflow is local-first. Discovery runs on your machine. The evidence trail documents your legacy codebase as it evolves.
