# How to Create a PR Risk Report

## The Problem

Your PR description says "this adds user authentication." A human reviewer has no idea what evidence exists, what risks are present, or whether the AI agent that wrote the code skipped critical steps. Reviewers waste time rediscovering what should have been documented. PR descriptions need a standardized risk assessment so reviewers know exactly what to look at.

## The Solution: `devflow review-pr`

Devflow generates a structured risk report comparing your branch against its base. You paste the output directly into your PR description on GitHub, GitLab, or any platform that supports markdown.

```bash
# Generate a markdown risk report
devflow review-pr --base main

# Save to a file for attaching to the PR
devflow review-pr --base main --output pr-risk-report.md

# Generate JSON for CI or programmatic consumption
devflow review-pr --base main --json --output pr-risk-report.json
```

## Step-by-Step

### 1. Switch to your feature branch

```bash
git checkout feature/add-user-auth
```

### 2. Generate the risk report

```bash
devflow review-pr --base main
```

Devflow compares your branch against main, inspects feature artifacts, checks gates, and prints a markdown report.

### 3. Save the report to a file

```bash
devflow review-pr --base main --output devflow-risk-report.md
```

### 4. Paste into your PR description

Open your PR on GitHub or GitLab and paste the contents of `devflow-risk-report.md` into the description field. The markdown renders as a structured table with verdict, evidence summary, and risk list.

### 5. Use the JSON format for CI pipelines

```bash
devflow review-pr --base main --json --output risk-report.json
```

The JSON format is designed for automated consumption — CI scripts can parse the verdict field and fail the pipeline on BLOCKED status.

## Example Markdown Output (Truncated)

When you run `devflow review-pr`, the output is ready to paste:

```
# PR Risk Report — feature/add-user-auth → main

> **Generated:** 2026-07-07T16:00:00.000Z | **Commit:** `c3d4e5f6` | **Devflow:** v0.3.0

## Verdict: ⚠️ NEEDS EVIDENCE

> No implementation log entries. Adversarial review not run. Gatekeep not approved.

## What Changed

| Status | File |
|--------|------|
| ✏️ modified | src/auth/login.ts |
| ➕ added | src/auth/session.ts |
| ➕ added | src/__tests__/login.test.ts |
| ➕ added | src/__tests__/session.test.ts |

## Artifact Health

| Artifact | Present | Risk if Missing |
|----------|---------|-----------------|
| requirements.md | ✅ | — |
| actions.md | ✅ | — |
| test-plan.md | ❌ | No test strategy — tests may be decorative |
| implementation-log.jsonl | ✅ | — |

## Evidence Summary

| Evidence | Status |
|----------|--------|
| Implementation log | ✅ 12 entries |
| Adversarial review | ❌ Not run |
| Gatekeep approved | ❌ No |
| Test framework | ✅ vitest |
| Type checker | ✅ typescript |

## Risks Remaining

- 🔴 Adversarial review not run — bypass vectors not checked
- 🔴 Gatekeep not approved — no independent review

## Gates Checklist

| Gate | Status |
|------|--------|
| Feature declared | ✅ |
| Requirements exist | ✅ |
| Actions exist | ✅ |
| Implementation logged | ✅ |
| Adversarial review | ❌ |
| Gatekeep approved | ❌ |
```

## How to Paste into GitHub / GitLab

**GitHub PRs:**
1. Create a new PR — GitHub shows the PR description editor.
2. Paste the entire report from `devflow-risk-report.md`.
3. Add your own notes above or below the report.
4. The verdict banner, table, and risk list render as formatted markdown.

**GitLab MRs:**
1. Open a new merge request.
2. Paste the report into the description field.
3. GitLab renders the same markdown tables.

**PR Comment (after PR exists):**
1. Generate the report with `devflow review-pr`.
2. Copy the markdown and paste it as a PR comment.
3. Tag your reviewers explaining that the risk report is attached.

## JSON Format

The JSON format is useful for CI automation and programmatic risk tracking:

```json
{
  "branch": "feature/add-user-auth",
  "base": "main",
  "timestamp": "2026-07-07T16:00:00.000Z",
  "featureId": "002-add-user-auth",
  "changedFiles": [
    { "path": "src/auth/login.ts", "status": "modified" },
    { "path": "src/auth/session.ts", "status": "added" }
  ],
  "risks": [
    "Adversarial review not run — bypass vectors not checked",
    "Gatekeep not approved — no independent review"
  ],
  "verdict": "NEEDS EVIDENCE",
  "verdictReason": "Adversarial review not run; Gatekeep not approved."
}
```

## HTML Format

For environments that support HTML, Devflow can also render the report with styled verdict banners. The markdown output is the primary format designed for pasting into PR descriptions across all platforms.

## CI Automation Option

You can automate risk report generation in CI so every PR gets an automatic audit comment. See the [GitHub Actions guide](./how-to-use-devflow-with-github-actions.md) for a full workflow. The CI workflow:

1. Runs `devflow review-pr` on every pull request
2. Posts the report as a PR comment
3. Uploads the report as a build artifact
4. Fails the pipeline if verdict is BLOCKED

## Next Steps

- Run `devflow adversarial-review <feature-id>` to add adversarial findings to the report.
- Run `devflow gatekeep <feature-id> --approve --actor <reviewer>` to clear the gate status.
- Configure `devflow config set riskTolerance strict` to make the report more thorough.
- See the full governance workflow: `devflow next` for your project's next action.

Devflow is local-first. No code leaves your machine. The PR risk report is self-contained evidence you control.
