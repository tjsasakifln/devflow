# Devflow for Platform Engineers — Integrating AI Governance into Developer Workflows

> Platform Engineers build the infrastructure and tooling that developers use every day. As AI coding agents become part of the development workflow, Platform Engineers are responsible for integrating AI governance into that infrastructure — without creating friction that drives developers to bypass the tooling. Devflow is designed for this: CLI-first, CI-native, and git-aware.

---

## The Challenge

**Providing governance tooling that developers actually use.**

Developers will not use a governance tool that adds friction to their workflow. Platform Engineers know this well. The best governance framework is invisible — it integrates into existing workflows, fails fast with clear messages, and does not require developers to learn a new platform.

Specific challenges Platform Engineers face:

- **Adoption resistance**: Developers skip governance steps if they require context-switching to a web dashboard or a separate tool.
- **CI integration complexity**: Governance checks must run alongside existing CI pipelines without duplicating work or slowing builds.
- **Multi-repo standardization**: Organizations have dozens or hundreds of repositories. A governance tool must work consistently across them without per-repo configuration.
- **Local vs CI parity**: Checks that pass locally must produce the same results in CI. Discrepancies erode trust in the tooling.
- **Agent awareness**: Developers use Claude Code, Cursor, and Copilot. Governance tooling must work regardless of which AI agent generated the code.

---

## What Devflow Provides

Devflow is built for the platform engineering use case from the ground up.

- **CLI-first**: Every command works in a terminal. No web dashboard required. `npx @tjsasakinpm/devflow install` is the entire setup.
- **CI-ready**: The same commands work locally and in CI. `devflow feature complete`, `devflow adversarial-review`, and `devflow gatekeep` run identically in both environments.
- **Git hooks**: Devflow integrates with git hooks to run pre-commit checks, ensuring governance violations are caught before they reach a branch.
- **GitHub Actions integration**: The `action.yml` at the repository root provides a ready-to-use GitHub Action. Add it to any workflow file for PR-time governance checks.
- **Stateful across environments**: Devflow tracks project state in `.devflow/state.json`, which is checked into the repository. CI runs read and write the same state as local runs.
- **Zero API keys**: Everything runs locally. No cloud service to configure, no API tokens to rotate, no network dependencies.

---

## Key Benefits

- **Zero-friction adoption**: `npx @tjsasakinpm/devflow install` is a single command. No account creation, no OAuth flow, no configuration management.
- **Integrates with existing git workflow**: Devflow respects `.gitignore`, operates on the working tree, and produces artifacts that live in the repository alongside the code.
- **CI-native**: Governance checks run as a step in the existing CI pipeline. No separate service, no webhook configuration, no new credentials.
- **Agent-agnostic**: Devflow does not care which AI agent generated the code. It audits the output, not the tool.
- **Deterministic and reproducible**: The same input produces the same governance result, regardless of environment. No AI model variability in checking.

---

## Recommended Flow

### GitHub Actions Workflow

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
      - name: Install Devflow
        run: npx @tjsasakinpm/devflow init
      - name: Run governance checks
        run: |
          devflow feature complete feature-id
          devflow adversarial-review feature-id
      - name: Gate approval
        run: devflow gatekeep feature-id --approve --actor github-actions
      - name: Generate PR risk report
        run: devflow review-pr --format markdown --output $GITHUB_WORKSPACE/pr-report.md
      - name: Post PR comment
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('${{ github.workspace }}/pr-report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
```

### Git Hooks

```bash
# pre-commit hook — audit AI-generated changes before commit
npx @tjsasakinpm/devflow audit
```

Add this to `.git/hooks/pre-commit` or manage it through the team's hook distribution mechanism.

### Team Onboarding

```bash
# Each developer runs this once per repo
npx @tjsasakinpm/devflow install

# Verify setup
devflow status --verbose
```

---

## What You Get

| Integration | Description |
|-------------|-------------|
| GitHub Action | Ready-to-use action.yml — add to any workflow |
| Pre-commit hook | Optional hook for pre-commit governance checks |
| State file | `.devflow/state.json` — shared between local and CI environments |
| Audit logs | `.devflow/audits/*.jsonl` — machine-parseable governance records |
| Configuration | `.devflow/config.json` — consistency across all environments |

---

## Limitations

- The GitHub Action requires `fetch-depth: 0` for git context. This adds marginal overhead to checkout times.
- Git hooks must be distributed through the team's existing mechanism. Devflow does not manage hooks centrally.
- CI integration assumes Node.js 18+ is available in the runner. This is standard for most CI environments but may require configuration for specialized runners.

---

> **Next**: [Guide: GitHub Actions integration](../guides/github-actions-integration.md) (coming soon)
