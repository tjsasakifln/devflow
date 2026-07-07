# How to Enforce Definition of Done for AI-Generated Code

## The Problem

AI agents mark tasks as done when the code compiles and the tests pass. But compiling is not done. AI-generated code routinely skips documentation, test plans, architecture review, security validation, and evidence logging. The agent says "done" but the feature is not ready for production. You need a machine-enforceable Definition of Done that catches everything a human reviewer would check.

## The Solution: `devflow feature complete`

Devflow's `feature complete` command runs 25 Definition of Done checks against any feature workspace. It verifies artifacts, runs deterministic tools, checks process compliance, and reports every failure with remediation guidance.

```bash
# Run all 25 DoD checks
devflow feature complete 001-add-payments

# The gatekeep command runs DoD checks internally before approving
devflow gatekeep 001-add-payments --approve --actor <reviewer>
```

## The 25 DoD Checks by Category

### Artifact Completeness (Checks 1-4)

| ID | Check | What It Verifies |
|----|-------|-----------------|
| 1 | Requirements clear and complete | All 15 sections in requirements.md filled |
| 2 | Design documented | roadmap.md with architecture, layers, patterns |
| 3 | Actions complete with evidence | All `[X]` tasks in actions.md have evidence |
| 4 | Architecture respects constitution | Layer rules pass dependency checks |

### Deterministic Tools (Checks 5-9)

| ID | Check | What It Verifies |
|----|-------|-----------------|
| 5 | Tests pass | Test suite exits with zero failures |
| 6 | Typecheck passes | TypeScript `tsc --noEmit` succeeds |
| 7 | Lint passes | Linter reports zero violations |
| 8 | Coverage >= 80% | Line/branch/function coverage meets threshold |
| 9 | Zero circular imports | `madge --circular` reports no cycles |

### Process Quality (Checks 10-14)

| ID | Check | What It Verifies |
|----|-------|-----------------|
| 10 | Legacy impact analyzed | `legacy-impact.md` exists |
| 11 | Regressions covered | `regression-watch.md` exists |
| 12 | Branch is not main | Cannot complete on protected branch |
| 13 | No unlinked TODO/FIXME | All TODOs link to issue numbers |
| 14 | ADRs registered | Architecture decisions documented |

### Review Gates (Checks 15-21)

| ID | Check | What It Verifies |
|----|-------|-----------------|
| 15 | Independent review approved | Gatekeep log shows approval |
| 16 | CI verification (moderate/strict) | CI workflow passed |
| 17 | OO design quality | Coupling, cohesion, complexity within limits |
| 18 | Verifiable acceptance criteria | >= 3 Gherkin scenarios with error paths |
| 19 | Implementer != approver | Constitution C12 — different actors |
| 20 | Adversarial review completed | Attack vectors all checked |
| 21 | Loop validation | Completed actions match implementation log |

### Integrity Verification (Checks 22-25)

| ID | Check | What It Verifies |
|----|-------|-----------------|
| 22 | Implementation log integrity | Log entries valid JSON with required fields |
| 23 | Semantic quality | Requirements-action-code alignment |
| 24 | Test plan exists | test-plan.md with coverage strategy |
| 25 | All blocking checks passed | Checks 1-24 blocking gates must pass |

## Step-by-Step

### 1. Create the feature and fill artifacts

```bash
devflow feature new add-payments
# Edit _devflow/features/002-add-payments/requirements.md
# Edit _devflow/features/002-add-payments/roadmap.md
# Edit _devflow/features/002-add-payments/actions.md
```

### 2. Generate the AI prompt

```bash
devflow feature prompt 002-add-payments --save
```

### 3. Implement with AI agent

The AI creates code and logs each action to `implementation-log.jsonl`.

### 4. Run the Definition of Done

```bash
devflow feature complete 002-add-payments
```

### 5. Fix failures and re-run

Devflow reports each failed check with remediation guidance. Fix the issues and run again until all blocking checks pass.

### 6. Complete the gatekeep

```bash
devflow gatekeep 002-add-payments --approve --actor <reviewer>
```

## Example Output

```
Devflow Feature Complete — 002-add-payments

Verifying Definition of Done (25 checks)...

┌─────────────────────────────────────────────────────────────┐
│ ID  Check                          Status    Evidence       │
├─────────────────────────────────────────────────────────────┤
│  1  Requirements clear & complete  ✅ PASS  All sections OK │
│  2  Design documented              ✅ PASS  roadmap.md OK   │
│  3  Actions with evidence          ✅ PASS  All [X] done    │
│  4  Constitution compliance        ✅ PASS  12 rules pass   │
│  5  Tests pass                     ✅ PASS  vitest OK       │
│  6  Typecheck passes               ✅ PASS  tsc --noEmit    │
│  7  Lint passes                    ✅ PASS  eslint clean    │
│  8  Coverage >= 80%                ❌ FAIL  67% coverage    │
│  9  Zero circular imports          ✅ PASS  No cycles       │
│ 10  Legacy impact analyzed         ❌ FAIL  File missing    │
│ 11  Regressions covered            ❌ FAIL  File missing    │
│ 12  Branch is not main             ✅ PASS  feature/002     │
│ 13  No unlinked TODO/FIXME         ✅ PASS  Clean           │
│ 14  ADRs registered                ✅ PASS  1 ADR found     │
│ 15  Independent review approved    ❌ FAIL  Gatekeep needed │
│ 16  CI verification                ⚠️ SKIP  Not configured  │
│ 17  OO design quality              ✅ PASS  OK              │
│ 18  Verifiable acceptance criteria ❌ FAIL  No Gherkin      │
│ 19  Implementer != approver        ✅ PASS  2 actors        │
│ 20  Adversarial review completed   ❌ FAIL  Not run         │
│ 21  Loop validation                ✅ PASS  Match OK        │
│ 22  Implementation log integrity   ✅ PASS  Valid JSON      │
│ 23  Semantic quality               ✅ PASS  Score 85/100    │
│ 24  Test plan exists               ✅ PASS  Found           │
│ 25  All blocking checks passed     ❌ FAIL  5 blockers      │
└─────────────────────────────────────────────────────────────┘

Result: 17 passed / 25 total
Blocking failures: 5
  - Check  8: Coverage >= 80% (67%)
  - Check 10: Legacy impact analyzed (missing)
  - Check 11: Regressions covered (missing)
  - Check 15: Independent review (gatekeep not approved)
  - Check 18: Verifiable acceptance criteria (no Gherkin scenarios)
```

## Risk Tolerance Tuning

The Definition of Done adapts to your project's risk posture:

**Relaxed mode** (solo founders):
- Coverage and lint become advisory (non-blocking)
- Missing artifacts trigger warnings, not failures
- CI verification skipped

```bash
devflow config set riskTolerance relaxed
```

**Moderate mode** (default, team projects):
- All standard gates blocking
- CI is advisory
- Implementer-approver separation enforced

**Strict mode** (release-critical):
- All 25 checks blocking
- CI required and blocking
- Unknown actors blocked
- Full audit trail mandatory

```bash
devflow config set riskTolerance strict
```

## Stack Adaptation

Devflow auto-detects your stack and adjusts checks accordingly:

- **TypeScript:** Full typecheck, lint, coverage via vitest/tsc/eslint
- **JavaScript:** Typecheck is advisory (non-blocking)
- **Python:** Tests via pytest, coverage via pytest-cov
- **Go/Rust:** Type checking via compiler, tests via go test/cargo test
- **Unknown stack:** Diagnostic messages with setup guidance

## Next Steps

- Run `devflow adversarial-review <feature-id>` to cover attack vectors the DoD might miss.
- Run `devflow doctor` to pre-check your project setup before running feature complete.
- Integrate `devflow feature complete` into your CI pipeline.
- Configure `reviewMode solo-hardened` if you work alone and need waive implementer-approver separation.

Devflow is local-first. The DoD checks run on your machine. No code ever leaves your repository.
