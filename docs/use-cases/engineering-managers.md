# Devflow for Engineering Managers — Governance for AI-Generated Code at Scale

> Engineering managers face a new challenge: teams are using AI coding agents (Claude Code, Cursor, Copilot) to generate production code at unprecedented velocity. Without governance, this velocity comes at the cost of consistency, auditability, and long-term maintainability. Devflow gives engineering managers the tooling to govern AI-generated code without becoming a bottleneck.

---

## The Challenge

**Managing quality when the team uses AI coding agents.**

When every developer on your team can generate hundreds of lines of code per hour with AI assistance, traditional code review breaks down. The volume overwhelms reviewers. The quality is inconsistent. There is no reliable way to distinguish between "code that compiles" and "code that is well-engineered."

Specific problems engineering managers report:

- **Inconsistent AI usage**: Some team members use AI as a pair programmer; others paste entire files without review.
- **No evidence of testing**: AI-generated PRs often lack test evidence, leaving reviewers to guess whether the change has been validated.
- **Rubber-stamp reviews**: When every PR looks plausible at a glance, reviewers stop digging. AI-generated code accelerates this trend.
- **Hard to quantify risk**: Managers cannot easily tell which changes carry high governance risk versus routine, low-risk changes.
- **No audit trail**: When an AI-generated change causes a production issue, there is no record of what was checked, by whom, and what was approved.

---

## What Devflow Provides

Devflow gives engineering managers visibility and control over AI-generated changes **before they reach PR**.

- **PR risk reports**: `devflow review-pr` generates a risk report (markdown or HTML) that quantifies the governance posture of every change. Attach it directly to PR descriptions.
- **Evidence trails**: Every governance decision — audit, adversarial review, gate approval — is logged with content hashes, actor identity, git context, and timestamps.
- **Asynchronous review**: The gatekeeper does not need to be online at the same time as the implementer. Review happens on the evidence trail, not on the calendar.
- **Team-wide quality metrics**: The `.devflow/state.json` and DEVFLOW.md cockpit surface project-level confidence scores, blocker counts, and state progression across all features.

---

## Key Benefits

- **Visibility into AI-generated changes**: Know which changes passed governance checks, which failed, and why — without reading every line of code.
- **Reduces rubber-stamp reviews**: Independent gatekeeper review (Constitution C12) ensures implementer and approver are different actors, forcing genuine oversight.
- **Maintains standards without bottlenecking**: Adversarial review and gatekeep checks run in minutes, not hours. The bottleneck shifts from human review time to evidence quality.
- **Local-first means no compliance issues**: Code never leaves the machine. Works in regulated environments where cloud-based review tools are not an option.
- **Configurable rigor**: Set `riskTolerance relaxed` for internal projects, `moderate` for team standard, and `strict` for release. No one-size-fits-all.

---

## Recommended Flow

```
1. Install:          devflow install [--review-mode independent]
2. Feature workflow: devflow feature new <name>
                     → fill requirements, design, test-plan artifacts
                     → devflow feature prompt <id> (generate AI prompt)
                     → implement (AI or human)
                     → devflow feature complete <id> (25 DoD checks)
3. Adversarial review: devflow adversarial-review <id> (12 vectors)
4. Gatekeep:          devflow gatekeep <id> --approve|--reject [--actor <name>]
5. PR risk report:    devflow review-pr --format markdown --output pr-report.md
```

Run step 5 in CI for every pull request to ensure no change lands without a governance report.

---

## What You Get

| Artifact | Description |
|----------|-------------|
| Risk report per PR | Quantified governance posture — evidence gaps, failed checks, risk level |
| Audit trail | Every decision logged: hashes, actor, timestamp, git SHA |
| Team-wide metrics | Confidence score, blocker count, state progression |
| Feature pipeline status | Which features are in requirements, coding, review, or done state |
| Gatekeep log | Historical record of approvals and rejections with full context |

---

## Getting Started

Three commands to establish AI governance on any project:

```bash
npx @tjsasakinpm/devflow install          # Guided setup
devflow config set reviewMode independent # Enforce implementer != approver
devflow audit                             # Scan current state
```

From there, introduce the feature workflow on the next new piece of work. No migration of existing code required.

---

## Limitations

- Devflow does not review code correctness or style — it checks governance. You still need human code review or a tool like CodeRabbit for line-level analysis.
- Evidence gaps are flagged, but Devflow cannot enforce that a developer writes good tests — only that tests exist and pass.
- The gatekeeper must be a human or a documented CI actor. Devflow does not automate approval judgment.

---

> **Next**: [Guide: Setting up a team governance pipeline](../guides/team-governance-pipeline.md) (coming soon)
