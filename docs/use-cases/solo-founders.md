# Devflow for Solo Founders — Shipping Fast Without Accumulating Technical Debt

> Solo founders are the most vulnerable to AI-generated code quality issues. You move fast, you depend heavily on AI to accelerate development, and there is no one to review your code. Devflow gives solo founders a compensating control: automated governance that catches dangerous patterns, surfaces evidence gaps, and generates documentation as a natural byproduct — without slowing you down.

---

## The Challenge

**Building alone with AI, with no reviewer, and worried about quality.**

As a solo founder, AI coding tools are a superpower. You can generate more code in a day than a team of three could write in a week. But that power comes with hidden costs:

- **No second pair of eyes**: When you are the only developer, every bug you introduce reaches production. AI-generated code amplifies this — errors look plausible and slip through easily.
- **Technical debt accumulates silently**: AI writes code that works today but is hard to change tomorrow. Without a reviewer to flag structural concerns, you build on a foundation of increasing fragility.
- **"What was I thinking?" moments**: Solo codebases are full of mysterious code. When AI wrote it six months ago and you have not touched it since, understanding the intent takes as long as rewriting it.
- **Testing gets deprioritized**: When you are shipping features to find product-market fit, writing tests feels optional. AI-generated code makes this worse — it passes the type checker but has no test coverage.
- **No audit trail**: When something breaks in production, there is no record of what was changed, why it was approved, or what evidence existed at the time.

---

## What Devflow Provides

Devflow's relaxed mode and solo-hardened review mode are specifically designed for solo founders.

- **Solo-hardened mode**: `devflow config set reviewMode solo-hardened` allows self-approval — the implementer can also be the approver — but requires compensating evidence: adversarial review must pass, and dangerous patterns must be addressed.
- **Adversarial review as compensating control**: When you have no reviewer, the 12-vector adversarial review acts as an automated second opinion. It checks for bypass attempts, hallucination patterns, architecture violations, and security risks.
- **Evidence trail for future you**: Every governance decision is logged with content hashes, timestamps, and context. Six months from now, you can run `devflow status` and understand what was done, why, and whether it passed checks.
- **Documentation as a side effect**: `devflow feature prompt` generates structured implementation prompts. The feature workspace accumulates requirements, design decisions, and test plans. When you revisit the code, the context is in the artifacts.
- **Configurable rigor**: Set `riskTolerance relaxed` to make lint and coverage advisory while keeping adversarial review and type checking blocking. You stay fast without flying blind.

---

## Key Benefits

- **Catches dangerous patterns before deploy**: The dangerous pattern detector flags eval(), hardcoded secrets, insecure deserialization, and other AI-common anti-patterns — even when you are the only person reviewing the code.
- **Generates documentation as a natural side effect**: You need implementation prompts for AI agents anyway. Devflow structures them and preserves them as artifacts. Documentation happens as a byproduct of governance, not as an extra task.
- **Prevents "what was I thinking?" moments**: The feature workspace contains requirements, design decisions, implementation logs, and review results. When you come back to a feature in three months, the context is in the artifacts — not in your memory.
- **Self-approval with guardrails**: Solo-hardened mode allows you to approve your own work, but requires that adversarial review passes and dangerous patterns are addressed. You ship fast, but not recklessly.
- **Local-first means no cost**: Devflow is open source (MIT) and runs entirely locally. No subscription fees, no API costs, no usage limits.

---

## Recommended Flow

```
1. Install with solo profiles:
   devflow install
   devflow config set riskTolerance relaxed
   devflow config set reviewMode solo-hardened

2. Feature workflow:
   devflow feature new my-feature
   devflow next                         # Follow guidance for artifacts
   devflow feature prompt my-feature    # Generate AI implementation prompt

3. Implement with AI agent (Claude Code, Cursor, Copilot)

4. Governance checks:
   devflow audit --risk-tolerance relaxed
   devflow feature complete my-feature
   devflow adversarial-review my-feature   # Must pass — compensating control

5. Self-approval:
   devflow gatekeep my-feature --approve --actor "$(whoami)"
```

---

## What You Get

| Artifact | Description |
|----------|-------------|
| Risk report | Pre-deploy governance snapshot — dangerous patterns, evidence gaps |
| Evidence trail | Full history of checks, approvals, and decisions — hashed and timestamped |
| Feature workspace | Requirements, design, test plan, implementation log — all in the repo |
| Adversarial review | 12-vector automated review — your CI-based code reviewer |
| Configuration | Relaxed risk tolerance — fast but not reckless |

---

## Practical Example

A solo founder building an internal dashboard:

1. Creates a feature workspace: `devflow feature new payment-dashboard`
2. Fills in requirements and design artifacts (5 minutes each)
3. Generates AI prompt: `devflow feature prompt payment-dashboard --copy`
4. Pastes into Claude Code — gets working code in 3 iterations
5. Runs `devflow audit` — catches an `eval()` that the AI used for dynamic config parsing
6. Fixes it, runs `devflow adversarial-review` — passes all 12 vectors
7. Self-approves: `devflow gatekeep payment-dashboard --approve --actor myself`
8. Ships

The audit trail and feature workspace remain in the repository. If the dashboard breaks in six months, the context is preserved.

---

## Limitations

- Self-approval is inherently weaker than independent review. Solo-hardened mode compensates with adversarial review, but cannot replace the perspective of a second developer.
- Adversarial review is deterministic — it checks known vectors. It will not catch novel security vulnerabilities or architectural issues that require human judgment.
- Documentation as a side effect only works if you fill in the artifacts. Empty requirements produce empty analysis.

---

> **Next**: [Guide: Solo founder quick start](../guides/solo-founder-quickstart.md) (coming soon)
