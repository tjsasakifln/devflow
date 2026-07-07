# How to Review Cursor-Generated Code Before Merging

## The Problem

Cursor writes code as you type. Composer generates multi-file changes in seconds. Tab completes entire functions. It feels productive until you realize you have no idea what the AI actually produced. Did it follow your project's architecture? Did it add tests? Did it introduce security issues? You need a second opinion — a systematic, tool-enforced review — before hitting merge.

## The Solution: `devflow review-pr`

Devflow audits Cursor-generated changes the same way it audits any AI agent output: by comparing the working tree against governance requirements and producing a risk report. The quick command is `devflow audit` (mapped to `devflow review-pr`), which checks every modified file against your project's evidence standards.

```bash
# Audit all Cursor-generated changes on the current branch
devflow review-pr --base main

# Write the report to a file for attaching to the PR
devflow review-pr --base main --output cursor-audit-report.md

# Run a JSON audit for CI consumption
devflow review-pr --base main --json --output audit.json
```

## Step-by-Step

### 1. Initialize Devflow in your Cursor project

```bash
npx @tjsasakinpm/devflow install --yes --agent cursor
```

The `--agent cursor` flag configures Devflow for Cursor-specific conventions, including `.cursor/rules/` integration.

### 2. Define a feature before Cursor writes code

Cursor works best with structure. Before asking Composer to generate code, create a Devflow feature:

```bash
devflow feature new api-ratelimit
```

Fill in `_devflow/features/001-api-ratelimit/requirements.md` so there is a spec to verify against.

### 3. Let Cursor implement from the Devflow prompt

```bash
devflow feature prompt 001-api-ratelimit --save
```

This generates `implementation-prompt.md` — a structured instruction you can paste into Cursor Composer or Chat. It tells Cursor what to build and what evidence to produce.

### 4. Cursor generates the code

Cursor creates files in your project. Each changed file will be tracked by `devflow review-pr` when you audit.

### 5. Audit before committing

```bash
devflow review-pr --base main
```

This produces a PR risk report showing verdict, changed files, artifact health, and remaining risks.

### 6. Fix red flags and re-audit

If the verdict is BLOCKED or NEEDS EVIDENCE, address the issues. Common fixes:
- Add `implementation-log.jsonl` entries for each Cursor action
- Create `test-plan.md` with Gherkin scenarios
- Run `devflow adversarial-review 001-api-ratelimit`

### 7. Merge only when verdict is RECOMMENDED

```bash
devflow review-pr --base main
# Verdict: ✅ RECOMMENDED — safe to merge
```

## Example Output

```
📋 Devflow PR Review

Comparing feature-api-ratelimit against main...

# PR Risk Report — feature-api-ratelimit → main

> **Generated:** 2026-07-07T15:00:00.000Z | **Commit:** `b2c3d4e5` | **Devflow:** v0.3.0

## Verdict: ⚠️ NEEDS EVIDENCE

> Core artifacts missing (actions.md, test-plan.md). Adversarial review not run.

## What Changed

| Status | File |
|--------|------|
| ✏️ modified | src/middleware/ratelimit.ts |
| ➕ added | src/middleware/rate-limiter.ts |
| ➕ added | src/__tests__/ratelimit.test.ts |
| ➕ added | src/config/ratelimit-config.ts |

## Artifact Health

| Artifact | Present | Risk if Missing |
|----------|---------|-----------------|
| requirements.md | ✅ | — |
| actions.md | ❌ | No task breakdown — implementation ordering is arbitrary |
| test-plan.md | ❌ | No test strategy — AI-generated tests may be decorative |
| implementation-log.jsonl | ✅ | — |

## Gates Checklist

| Gate | Status |
|------|--------|
| Feature declared | ✅ |
| Requirements exist | ✅ |
| Implementation logged | ✅ |
| Adversarial review | ❌ |
| Gatekeep approved | ❌ |

Verdict: ⚠️ NEEDS EVIDENCE
This branch needs more evidence before review. Address risks above.
```

## Cursor-Specific Considerations

- **Cursor Composer generates multiple files at once** — Devflow's `review-pr` captures the full diff, not just individual files.
- **Cursor follows `.cursor/rules/`** — Devflow installs recommend `.cursor/rules/devflow-governance.mdc` to align Cursor's output with Devflow's evidence requirements.
- **Cursor Tab may auto-complete code inline** — Devflow audits catch architectural drift that inline completions might introduce.
- **Cursor's agent mode** — When Cursor runs in agent mode, it can produce `implementation-log.jsonl` entries automatically if the Devflow prompt includes logging instructions.

## What the Report Tells You

- **Verdict** — is the branch safe to merge or does it need more evidence?
- **Changed files** — every file Cursor modified, added, or deleted.
- **Gates status** — which governance gates passed and which failed.
- **Risks** — specific, actionable items to fix before merging.

The point is not to slow you down. The point is to surface what you cannot see: missing evidence, skipped verification, and architecture violations that Cursor would never flag on its own.

## Next Steps

- Run `devflow adversarial-review 001-api-ratelimit` to check 12 attack vectors including hidden coupling, weak tests, and bypass attempts.
- Run `devflow feature complete 001-api-ratelimit` to verify all 25 Definition of Done checks.
- Run `devflow gatekeep 001-api-ratelimit --approve --actor <reviewer>` for independent sign-off.
- See the full workflow: `devflow next` for your project's next action.

Devflow is local-first. Cursor never sends data to Devflow. The evidence trail stays in your repository.
