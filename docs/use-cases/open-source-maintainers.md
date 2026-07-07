# Devflow for Open Source Maintainers — Reviewing AI-Generated Contributions

> Open source maintainers face a surge of pull requests from contributors who use AI coding agents. These PRs often look correct at first glance but lack test coverage, ignore project conventions, or introduce subtle architectural issues. With limited review bandwidth, maintainers need automated filtering to separate well-governed contributions from those that need significant rework. Devflow provides pre-PR governance checks that reduce review burden and surface quality signals before human review.

---

## The Challenge

**PRs from contributors using AI, hard to assess quality, limited review time.**

Open source maintainers report a growing share of contributions that are AI-generated — sometimes disclosed, often not. These contributions share common characteristics:

- **Plausible but shallow**: The code compiles and addresses the issue superficially, but edge cases, error handling, and integration with the rest of the codebase are missing.
- **No test evidence**: The vast majority of AI-generated contributions include no tests or include tests that pass trivially (e.g., testing only the happy path with no assertions).
- **Project convention violations**: AI agents do not read CONTRIBUTING.md or observe project-specific patterns. Generated code uses the contributor's style, not the project's.
- **Hard to assess quickly**: Reading a 500-line AI-generated diff to determine quality takes as long as writing the code yourself. Maintainers cannot scale this.
- **No evidence of validation**: There is no way to know whether the contributor ran tests, checked for regressions, or reviewed their own code before opening the PR.

---

## What Devflow Provides

Devflow gives open source maintainers a standardized governance signal on every contribution, regardless of which AI agent generated the code.

- **Risk report as PR comment**: `devflow review-pr --format markdown` generates a governance report that can be posted as a PR comment. It lists evidence gaps, failed checks, and risk level — giving maintainers a quick assessment of contribution quality.
- **Automated checks before human review**: Run Devflow in CI on every PR. If governance checks fail, the maintainer can decide whether to request fixes or close the PR — without reading the full diff.
- **Agent-agnostic**: Devflow audits the code, not the tool. It does not matter whether the contributor used Claude Code, Cursor, Copilot, or wrote the code manually. The same governance checks apply.
- **No cloud dependency**: Devflow runs in CI on the contributor's PR. No code is sent to external services. This is important for projects with security-conscious contributor bases.
- **Evidence validation**: Checks whether the contribution includes test evidence, implementation documentation, and proof of validation. Missing evidence is surfaced in the PR report.

---

## Key Benefits

- **Filters low-quality AI PRs**: Before you spend 30 minutes reviewing a 400-line diff, Devflow can flag it as high-risk within seconds. You prioritize reviews based on governance signal.
- **Surfaces missing tests and evidence**: If a PR has no test changes, no implementation log, and no evidence of validation, the risk report flags each gap. You know what is missing before you start reading.
- **Reduces review burden**: The risk report handles the first pass: checking for dangerous patterns, evidence completeness, and spec alignment. You focus on the substantive architectural and design questions.
- **Sets contributor expectations**: Including a Devflow badge in the README and a `.devflow/constitution.md` in the repository signals that this project expects governed contributions. Contributors self-select.
- **Works with existing CI**: Add the Devflow GitHub Action to your CI workflow. No new infrastructure, no API keys, no cloud services.

---

## Recommended Flow

### GitHub Actions on Every PR

```yaml
name: Devflow Governance Check
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
      - run: devflow review-pr --format markdown --output pr-report.md
      - name: Post PR comment
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('pr-report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Devflow Governance Report\n\n${report}`
            });
```

### Repository Setup

```bash
# Initialize Devflow in the repository
npx @tjsasakinpm/devflow init

# Configure for open source — moderate risk tolerance
devflow config set riskTolerance moderate

# Generate the project cockpit
devflow update-cockpit

# Commit .devflow/ configuration to the repository
git add .devflow/ DEVFLOW.md
git commit -m "chore: add Devflow governance configuration"
```

---

## What You Get

| Artifact | Description |
|----------|-------------|
| PR risk report | Automated governance assessment — posted as PR comment |
| Evidence gap analysis | Missing tests, documentation, validation evidence |
| Dangerous pattern detection | Security and anti-pattern flags specific to AI-generated code |
| Governance score | Quantitative measure of contribution quality |
| Historical record | Governance results for every PR — searchable in CI logs |

---

## Practical Workflow

1. Contributor opens a PR.
2. GitHub Actions runs Devflow governance checks.
3. A PR comment appears with the risk report: "Risk level: high. Missing test evidence. Contains 1 dangerous pattern (hardcoded secret found)."
4. Maintainer reads the 5-line summary instead of the 400-line diff.
5. Decision: request fixes (high risk) or begin human review (low risk).
6. Maintainer focuses human review on the substantive changes, skipping basic governance checks.

---

## Limitations

- Devflow cannot enforce that contributors run governance checks locally before pushing. CI-based checks are reactive. Consider adding a CONTRIBUTING.md section that recommends local checks.
- The risk report is based on heuristics. A PR that passes all governance checks can still contain bugs, design issues, or architectural problems that require human judgment.
- Contributors may not have Node.js installed and cannot run Devflow locally. CI-based governance ensures coverage without requiring local setup.

---

> **Next**: [Guide: Setting up Devflow for open source projects](../guides/open-source-governance.md) (coming soon)
