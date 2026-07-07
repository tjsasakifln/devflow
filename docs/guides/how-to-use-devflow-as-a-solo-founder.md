# How to Use Devflow as a Solo Founder

## The Problem

You ship alone. There is no reviewer. No one checks your PRs. AI agents write most of your code. You move fast because you have to. But speed without quality eventually kills momentum. Technical debt compounds. Tests become decorative. Architecture erodes. You wake up one day with a codebase you are afraid to touch. You need a governance system that works without a second person.

## The Solution: Solo-Hardened Mode

Devflow is designed for solo founders. It provides compensating controls that replace the missing independent reviewer — automated adversarial review, deterministic gates, and an auditable evidence trail.

```bash
# Configure Devflow for solo work
devflow config set reviewMode solo-hardened
devflow config set riskTolerance relaxed

# Quick workflow
devflow feature new add-billing
# ... implement with AI ...
devflow adversarial-review 001-add-billing
devflow feature complete 001-add-billing
devflow gatekeep 001-add-billing --approve --actor solo-founder
```

## Why Solo-Hardened Mode

In a team, Constitution C12 requires the implementer and approver to be different people. But you are the only person. Solo-hardened mode:

- **Waives implementer-approver separation** — you can self-approve
- **Requires compensating evidence** — adversarial review becomes mandatory
- **All deterministic checks must pass** — no skipping tests, typecheck, or lint

This is not "rubber stamp mode." It is a trade: you lose independent review, but you gain automated enforcement that is more thorough than most human reviews.

## Step-by-Step

### 1. Install and configure

```bash
npx @tjsasakinpm/devflow install --yes

# Set solo-hardened mode
devflow config set reviewMode solo-hardened

# Relax risk tolerance to avoid false positives
devflow config set riskTolerance relaxed
```

With these settings:
- Coverage and lint become advisory (non-blocking)
- Missing artifacts trigger warnings, not blocks
- CI is not required
- But adversarial review is **mandatory** for gatekeep approval

### 2. Create a feature

```bash
devflow feature new user-onboarding
```

Fill in the essentials: `requirements.md` and `actions.md`. These are your contract with yourself.

### 3. Generate the AI prompt

```bash
devflow feature prompt 001-user-onboarding --save
```

The prompt tells your AI agent to produce evidence as it codes.

### 4. Implement with AI

Your AI agent (Claude Code, Cursor, Copilot) writes the code. Each action should be logged to `implementation-log.jsonl`.

### 5. Run the adversarial review

This is your replacement for code review:

```bash
devflow adversarial-review 001-user-onboarding
```

The adversarial review checks 12 attack vectors that a human reviewer would catch:
- Weak tests (tests without assertions)
- Hidden coupling between modules
- Security issues (eval, hardcoded secrets)
- Spec-code gaps (requirements not reflected in code)
- Code duplication
- Layer violations

### 6. Run the Definition of Done

```bash
devflow feature complete 001-user-onboarding
```

In relaxed mode, this runs 25 checks with coverage and lint as non-blocking. Fix the blocking failures.

### 7. Self-approve with gatekeep

```bash
devflow gatekeep 001-user-onboarding --approve --actor solo-founder --reason "Adversarial review passed. All DoD checks passing. Self-approval in solo-hardened mode."
```

The gatekeep log records this as a solo-hardened approval with a note that independent human review did not occur.

## Example Solo Workflow Output

```
Devflow Gatekeep — 001-user-onboarding

Review mode: solo-hardened
Risk tolerance: relaxed

✓ Adversarial review: PASS (12/12 vectors)
✓ DoD checks: 22/25 passed, 0 blocking failures
✓ Implementation log: 8 entries, valid format

⚠️ Solo-Hardened Approval
  This is NOT an independent review.
  Compensating evidence: adversarial review PASS.
  Approval recorded by: solo-founder
  Git: a1b2c3d4 on feature/user-onboarding

✅ Gatekeep approved.
```

## The Solo Founder's Daily Flow

```bash
# Morning — what should I do today?
devflow next

# Before AI coding — create scoped work
devflow feature new fix-checkout-bug

# After AI coding — audit before commit
devflow review-pr --base main

# Weekly — run full governance
devflow adversarial-review 001-fix-checkout-bug
devflow feature complete 001-fix-checkout-bug
devflow gatekeep 001-fix-checkout-bug --approve --actor solo-founder
```

## What Solo-Hardened Does NOT Allow You to Skip

Even in relaxed, solo-hardened mode, Devflow enforces:

- **Adversarial review must pass** before gatekeep approval
- **Deterministic tools** (tests, typecheck, lint) are required if configured
- **Implementation log** must exist with valid entries
- **Branch must not be main** — no working on main
- **Architecture constitution** is enforced if enabled

These gates prevent the most common solo founder failure modes: skipping tests, ignoring architecture, and merging without verification.

## Risk Tolerance Comparison for Solo Founders

| Setting | Best For | Trade-off |
|---------|----------|-----------|
| Relaxed (recommended) | Early stage, MVPs, prototypes | Advisory coverage/lint — move fast |
| Moderate | Growth stage, paying customers | Standard gates — more safety |
| Strict | Production-critical features | All gates blocking — slower but safer |

Start with relaxed. Dial up as your codebase matures.

## Building an Evidence Trail

As a solo founder, your evidence trail is your reputation with future hires, investors, and auditors. Devflow automatically records:

- Every implementation action with timestamp, actor, and git commit
- Every adversarial review verdict
- Every gatekeep approval decision
- Every risk report generated

This turns "I shipped fast" into "I shipped fast with documented quality controls."

## Next Steps

- Run `devflow doctor` to verify your solo-hardened configuration is correctly applied.
- Set up the GitHub Actions workflow (see GitHub Actions guide) even as a solo founder — CI serves as your second pair of eyes.
- Consider asking a peer for occasional ad-hoc reviews through `devflow gatekeep` even in solo mode.
- Revisit your risk tolerance quarterly as your project grows.

Devflow is local-first. Solo-hardened mode gives you engineering governance without a team. No cloud dependency. No API keys. Just auditable evidence.
