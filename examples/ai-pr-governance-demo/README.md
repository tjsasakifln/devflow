# Devflow AI PR Governance Demo

End-to-end demo showing how Devflow governs AI-generated code before it reaches a pull request.

**Runs in under 10 minutes. No API keys needed.**

## Quick Start

```bash
cd examples/ai-pr-governance-demo
bash run-demo.sh
```

This will:
1. Create a minimal Node.js project
2. Install Devflow in solo-hardened mode
3. Create a feature workspace (`add-health-check`)
4. Fill artifacts (requirements, roadmap, actions, test-plan)
5. Generate an AI implementation prompt
6. Simulate AI agent implementing the feature
7. Run 25 Definition of Done checks
8. Run adversarial review (12 attack vectors)
9. Approve via gatekeep (self-approval with compensating evidence)
10. Generate a **PR risk report** → `pr-risk-report.md`

## What You'll See

The final output is `pr-risk-report.md` — a markdown report containing:

- **What changed:** files added, modified, deleted
- **Feature justification:** which feature this PR implements
- **Artifact health:** which artifacts exist, what's missing, residual risk
- **Evidence summary:** log entries, adversarial review, gatekeep status
- **Gates checklist:** which gates passed, which didn't
- **Risks remaining:** what's unverified, missing, or out of scope
- **Verdict:** RECOMMENDED / NEEDS EVIDENCE / BLOCKED

This report is designed to be pasted directly into a PR description.

## Options

```bash
bash run-demo.sh --keep          # Don't delete the temp project
bash run-demo.sh --devflow-path /path/to/devflow  # Use specific devflow path
```

## What This Demo Proves

- AI agents can be governed without slowing down development
- Evidence is generated automatically as part of the workflow
- PR reviewers get a structured risk report instead of blind trust
- The full pipeline works locally, no SaaS required
