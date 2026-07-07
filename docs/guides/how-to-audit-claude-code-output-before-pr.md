# How to Audit Claude Code Output Before Creating a PR

## The Problem

Claude Code generates code fast. It implements features in minutes that would take a human hours. But speed is not safety. AI agents ship code with no verification — no tests, no architecture checks, no security scan. When you run `claude` and watch files appear, you get a sinking feeling: *can I trust this?* You shouldn't have to guess. You need a verifiable pre-PR audit before any code reaches a pull request.

## The Solution: `devflow review-pr`

Devflow's audit command scans every changed file against evidence requirements and produces a machine-readable risk report **before** you open a PR. It checks what changed, what evidence exists (tests, logs, reviews), and what risks remain.

```bash
# Quick audit against the main branch
devflow review-pr --base main

# Save the report as markdown to paste into your PR
devflow review-pr --base main --output pr-risk-report.md

# Get a JSON report for programmatic consumption
devflow review-pr --base main --json --output report.json
```

The quick command is `devflow audit` — a mental shorthand that maps directly to `devflow review-pr`, the pre-PR risk report.

## Step-by-Step

### 1. Install Devflow in your project

```bash
npx @tjsasakinpm/devflow install --yes
```

This creates `.devflow/config.json` and the `_devflow/` workspace.

### 2. Create a feature for Claude Code to implement

```bash
devflow feature new add-user-auth
```

Devflow creates a workspace at `_devflow/features/001-add-user-auth/` with templates for requirements, roadmap, and actions.

### 3. Fill in the requirements before AI coding

Edit `_devflow/features/001-add-user-auth/requirements.md` with what Claude should build. This is your spec — without it, you have no contract to verify against.

### 4. Generate the implementation prompt for Claude

```bash
devflow feature prompt 001-add-user-auth --save
```

This produces a prompt that tells Claude what to build, what evidence to produce, and how to log its work.

### 5. Let Claude Code implement the feature

Paste the prompt into Claude Code. Claude will create files and log each action to `implementation-log.jsonl`.

### 6. Audit before creating a PR

```bash
devflow review-pr --base main
```

Devflow compares your branch against main and produces a risk report.

### 7. Fix risks, re-audit, then create the PR

```bash
# After fixing issues, re-audit to confirm
devflow review-pr --base main
# Only create the PR when verdict is RECOMMENDED
```

## Example Output

```
📋 Devflow PR Review

Comparing feature-add-user-auth against main...

# PR Risk Report — feature-add-user-auth → main

> **Generated:** 2026-07-07T14:30:00.000Z | **Commit:** `a1b2c3d4` | **Devflow:** v0.3.0

## Verdict: 🚫 BLOCKED

> Core artifacts missing (requirements.md or actions.md). No implementation log entries. Adversarial review not run.

## What Changed

| Status | File |
|--------|------|
| ✏️ modified | src/auth/user-auth.ts |
| ✏️ modified | src/auth/login-handler.ts |
| ➕ added | src/auth/session-store.ts |
| ➕ added | src/__tests__/user-auth.test.ts |

## Artifact Health

| Artifact | Present | Risk if Missing |
|----------|---------|-----------------|
| requirements.md | ✅ | — |
| actions.md | ❌ | No task breakdown — implementation ordering is arbitrary |
| implementation-log.jsonl | ❌ | No audit trail — cannot verify who did what |
| test-plan.md | ❌ | No test strategy — AI-generated tests may be decorative |

## Evidence Summary

| Evidence | Status |
|----------|--------|
| Implementation log entries | ❌ None |
| Adversarial review | ❌ Not run |
| Gatekeep approved | ❌ No |

## Risks Remaining

- 🔴 Missing 3 artifacts: actions.md, test-plan.md, legacy-impact.md
- 🔴 No implementation log entries — cannot verify what was done
- 🔴 Adversarial review not run — bypass vectors not checked

Verdict: BLOCKED
```

## What the Report Tells You

- **Verdict** — RECOMMENDED, NEEDS EVIDENCE, or BLOCKED. If blocked, do not create a PR.
- **What Changed** — every added, modified, or deleted file.
- **Artifact Health** — which governance artifacts exist and what risks their absence creates.
- **Evidence Summary** — implementation log, adversarial review, gatekeep approval, test framework.
- **Risks Remaining** — actionable items to fix before review.

The purpose is not to block you. The purpose is to make risks visible before they become PR review comments or production incidents.

## Next Steps

- Run `devflow doctor` if the audit fails with configuration errors.
- Run `devflow adversarial-review 001-add-user-auth` to run 12 attack vectors on the feature.
- Run `devflow gatekeep 001-add-user-auth --approve --actor <reviewer>` for independent approval.
- See the full Devflow workflow: `devflow next` for your project's next recommended action.

Devflow is local-first. No code leaves your machine. No API keys required. The evidence trail stays with your repository.
