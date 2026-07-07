# How to Use Devflow with GitHub Actions

## The Problem

Running `devflow review-pr` locally is fine for you. But what about the rest of the team? What about PRs opened at 2 AM by a CI-triggered AI agent? You need automated governance in CI — every PR gets audited, risk-reported, and blocked if evidence is missing. Manual gatekeeping doesn't scale.

## The Solution: Devflow GitHub Actions Workflow

Devflow provides a ready-to-use GitHub Actions workflow. Copy `.github/workflows/devflow-example.yml` from the Devflow repository into your project at `.github/workflows/devflow.yml`. Every PR then receives an automatic AI code audit with a risk report posted as a comment.

## Copy-Paste Workflow

Create `.github/workflows/devflow.yml` in your repository with this content:

```yaml
name: Devflow PR Governance

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  audit:
    name: Devflow Audit — AI Code Risk Report
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Devflow
        run: npm install -g @tjsasakinpm/devflow

      - name: Run Devflow Audit
        id: devflow
        run: |
          devflow review-pr \
            --base "origin/${{ github.base_ref }}" \
            --output devflow-report.md

          VERDICT=$(grep -oP '## Verdict:\s*\K\S+' devflow-report.md | head -1 || echo "UNKNOWN")
          echo "verdict=$VERDICT" >> $GITHUB_OUTPUT

          cat devflow-report.md >> $GITHUB_STEP_SUMMARY

      - name: Upload report artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: devflow-risk-report
          path: devflow-report.md
          retention-days: 30

      - name: Comment PR with report
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('devflow-report.md', 'utf8');
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🔍 Devflow AI Code Audit\n\n${report}`
            });

      - name: Fail on blocked verdict
        if: steps.devflow.outputs.verdict == 'BLOCKED'
        run: |
          echo "❌ Devflow audit BLOCKED this PR."
          exit 1
```

## Step-by-Step Explanation

### Checkout with full history

```yaml
uses: actions/checkout@v4
with:
  fetch-depth: 0
```

Devflow needs the full git history to compute the diff between your PR branch and the base branch. Shallow clones (`fetch-depth: 1`) produce incomplete risk reports.

### Install Devflow globally

```yaml
- name: Install Devflow
  run: npm install -g @tjsasakinpm/devflow
```

The CLI is published as `@tjsasakinpm/devflow` on npm. Global install makes `devflow` available for the rest of the job.

### Run the audit

```yaml
- name: Run Devflow Audit
  id: devflow
  run: |
    devflow review-pr \
      --base "origin/${{ github.base_ref }}" \
      --output devflow-report.md

    VERDICT=$(grep -oP '## Verdict:\s*\K\S+' devflow-report.md | head -1 || echo "UNKNOWN")
    echo "verdict=$VERDICT" >> $GITHUB_OUTPUT
```

The `--base` flag targets the PR's target branch. The report is saved to a file. The verdict is extracted and stored as a workflow output.

### Upload as artifact

```yaml
- name: Upload report artifact
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: devflow-risk-report
    path: devflow-report.md
    retention-days: 30
```

The report is preserved for 30 days even if the pipeline fails. You can download it from the Actions tab.

### Post as PR comment

The `actions/github-script` step posts the full markdown report as a PR comment so reviewers see the risk assessment without leaving GitHub.

### Block on blocked verdict

```yaml
- name: Fail on blocked verdict
  if: steps.devflow.outputs.verdict == 'BLOCKED'
  run: exit 1
```

When the verdict is BLOCKED, the pipeline fails and prevents merging.

## Fail-On Configuration

Customize when the pipeline fails:

```yaml
# Stricter — fail on any risk
if: steps.devflow.outputs.verdict != 'RECOMMENDED'
# Default — only fail on BLOCKED
if: steps.devflow.outputs.verdict == 'BLOCKED'
# Advisory — never fail
if: false
```

## Enabling CI Integration in Config

Devflow's Definition of Done checks CI status when configured:

```bash
devflow config set executionMode strict
```

Then edit `.devflow/config.json`:

```json
{
  "ciIntegration": {
    "enabled": true,
    "provider": "github_actions",
    "requiredChecks": ["test", "lint", "typecheck"],
    "timeoutSeconds": 120
  }
}
```

With CI integration enabled, `devflow feature complete` will verify that the CI workflow passed before allowing gatekeep approval.

## Multiple Workflow Strategy

For larger teams, separate visibility from enforcement: `devflow-audit.yml` posts reports on every PR (non-blocking), while `devflow-gate.yml` blocks merge if evidence is missing.

## Next Steps

- Read the full reference workflow at `.github/workflows/devflow-example.yml` in the Devflow repository.
- Combine Devflow CI with `devflow adversarial-review` scheduled runs for deeper analysis.
- Configure branch protection rules to require the Devflow audit job to pass before merging.
- Run `devflow doctor` locally to ensure your project is CI-ready.

Devflow is local-first but CI-enforceable. The same audit that runs on your machine runs in CI — consistent evidence, everywhere.
