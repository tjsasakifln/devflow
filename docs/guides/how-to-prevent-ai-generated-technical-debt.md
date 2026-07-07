# How to Prevent AI-Generated Technical Debt

## The Problem

Every PR from an AI agent adds technical debt. Tests are decorative — they pass but test nothing meaningful. Architecture violations pile up because the AI does not understand your layer boundaries. Error handling is shallow. Security is an afterthought. Without structural enforcement, AI agents produce code that works today and costs you tomorrow. You need a systematic way to catch debt before it compounds.

## The Solution: `devflow adversarial-review` and `devflow feature complete`

Devflow provides two gates that specifically target the failure modes of AI-generated code:

```bash
# Run 12 attack vectors on a feature
devflow adversarial-review 001-add-payments

# Verify all 25 Definition of Done checks
devflow feature complete 001-add-payments
```

The quick command for debt detection is `devflow adversarial-review <feature-id>` — it runs 12 attack vectors designed to find the patterns that create technical debt.

## Step-by-Step

### 1. Create a feature workspace

```bash
devflow feature new add-payments
```

Fill in `requirements.md`, `roadmap.md`, and `actions.md` in `_devflow/features/001-add-payments/`.

### 2. Generate the AI prompt

```bash
devflow feature prompt 001-add-payments --save
```

The prompt tells the AI what evidence to produce, preventing shallow work from the start.

### 3. Let the AI implement the feature

The AI creates files and logs each action to `implementation-log.jsonl`.

### 4. Run the adversarial review

```bash
devflow adversarial-review 001-add-payments
```

This tests 12 attack vectors against the feature:

| Attack Vector | What It Checks |
|---|---|
| Hidden Coupling | New implicit dependencies between modules |
| Weak Tests | Tests without assertions (decorative tests) |
| Abstraction Failure | Concrete dependencies where interfaces should exist |
| Layer Violation | Domain code importing infrastructure directly |
| Security | Hardcoded secrets, eval(), unsafe patterns |
| Spec-Code Gap | Requirements not reflected in tests or code |
| Uncovered Requirements | Functional requirements missing test coverage |
| Code Duplication | Duplicated logic that should be abstracted |
| State Tampering | Devflow state modified without audit log |
| Log Forgery | Implementation log entries missing required fields |
| False Completion | Actions marked done without log evidence |
| Same-Actor Bypass | Actor name variants trying to bypass segregation |

### 5. Run the complete Definition of Done

```bash
devflow feature complete 001-add-payments
```

This runs 25 checks across seven categories: artifact completeness, deterministic tools (tests, typecheck, lint, coverage), circular dependencies, process quality, git hygiene, review gates, and CI verification.

### 6. Gatekeep for independent approval

```bash
devflow gatekeep 001-add-payments --approve --actor <reviewer>
```

## Example Adversarial Review Output

```
Devflow Adversarial Review — 001-add-payments
Mode: local | Adversarial review: the reviewer tries to REJECT the feature.

  🔍 Hidden Coupling: Does this feature create implicit dependencies between modules?
    ✓ PASS
  🔍 Weak Tests: Are tests merely decorative (testing nothing)?
    ✖ FAIL: Test cases without assertions found:
      src/__tests__/payment.test.ts: it('processes payment') — no expect() found
      src/__tests__/payment.test.ts: it('handles refund') — no expect() found
  🔍 Abstraction Failure: Are there concrete deps where interfaces should exist?
    ✖ FAIL: Direct instantiation in potentially wrong layer:
      src/payment/stripe-handler.ts: const client = new StripeClient(...)
  🔍 Layer Violation: Does domain code import infrastructure directly?
    ✓ PASS
  🔍 Security: Hardcoded secrets, eval(), or unsafe patterns?
    ✓ PASS
  🔍 Spec-Code Gap: Requirements not reflected in code or tests?
    ? INCONCLUSIVE: requirements.md not found — cannot check spec-code gap
  🔍 Uncovered Requirements: Requirements missing test coverage?
    ? INCONCLUSIVE: requirements.md not found
  🔍 Code Duplication: Duplicated logic that should be abstracted?
    ✓ PASS
  🔍 State Tampering: Has state.json been modified without gatekeep log?
    ✓ PASS
  🔍 Log Forgery: Implementation log entries missing required fields?
    ✓ PASS
  🔍 False Completion: Actions marked [X] without log evidence?
    ✓ PASS
  🔍 Same-Actor Bypass: Same actor with name variants?
    ✓ PASS

Adversarial Review Verdict: FAIL
  Pass: 8 | Fail: 2 | Inconclusive: 2

✖ FAILED — 2 finding(s). Fix before proceeding.
```

## Preventing Debt by Risk Tolerance

Configure how aggressively Devflow catches debt:

```bash
# Solo project: relaxed checks, advisory coverage/lint
devflow config set riskTolerance relaxed

# Team project: standard gates, CI advisory
devflow config set riskTolerance moderate

# Release-critical: all gates blocking, CI required
devflow config set riskTolerance strict
```

## What Each Gate Prevents

| Debt Type | Gate | Mechanism |
|---|---|---|
| Architecture erosion | Constitution check (DoD #4) | Layer rules enforced |
| Shallow tests | Weak tests (adversarial #2) | Detects tests without assertions |
| Hidden coupling | Hidden Coupling (adversarial #1) | Dependency cruiser violations |
| Untested code | Coverage gate (DoD #8) | Fails below 80% coverage |
| Skipped review | Independent review (DoD #15) | Blocks without gatekeep |
| Forgotten TODOs | TODO check (DoD #13) | Blocks unlinked markers |
| Spec drift | Spec-code gap (adversarial #6) | Requirements-to-code mapping |

## Next Steps

- Run `devflow doctor` to audit your current project for existing technical debt.
- Set `riskTolerance` to `strict` for release-critical features.
- Integrate `devflow adversarial-review` into your CI pipeline (see GitHub Actions guide).
- Run `devflow feature complete <id>` before every merge to enforce the full Definition of Done.

Devflow is local-first. No cloud dependency. No API keys. The evidence trail prevents compounding debt where it starts — before the merge.
