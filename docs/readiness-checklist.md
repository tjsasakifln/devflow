# Devflow Readiness Checklist

> **Branch:** `fix/align-implementation-to-promise`
> **Date:** 2026-07-06
> **Purpose:** Verifiable acceptance criteria for the 15 corrections aligning Devflow implementation to its public promise.

## Corrective Commits & Verification

Each entry below maps to a commit on the `fix/align-implementation-to-promise` branch. Check each box by running the verification command.

### 1. CI Simplification

- [ ] `npm ci` succeeds (only installs declared devDeps)
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` succeeds (tsc --noEmit)
- [ ] `npm test` succeeds (all 73 tests pass)
- [ ] `npm run test:coverage` succeeds (vitest + @vitest/coverage-v8)
- [ ] CI workflow references only installed tools or advisory steps
- [ ] CI does not reference `.devflow/` paths (uses versioned `src/kernel/artifacts/tool-configs/`)

### 2. Version Sync

- [ ] `node dist/main.js --version` prints `0.2.1` (matches package.json)
- [ ] `grep -r '"0.1.0"' src/` returns no results (no hardcoded old versions)
- [ ] Gatekeep log entries contain `"devflowVersion":"0.2.1"`

### 3. Feature Prompt Blocks Premature Coding

- [ ] `devflow feature prompt <id>` refuses when state < feature-coding-ready
- [ ] Refusal message shows: current state, required progression, `devflow next --diagnose`
- [ ] Refusal message shows: `--preview` flag alternative
- [ ] `devflow feature prompt <id> --preview` generates prompt with PREVIEW warning
- [ ] Preview saved file is named `implementation-prompt-PREVIEW.md`

### 4. DoD Check 25 — Real Integrity Gate

- [ ] Check 25 is `blocking: true` (not decorative)
- [ ] Check 25 verifies all blocking checks 1-24 passed
- [ ] Check 25 verifies implementation log matches actions completion
- [ ] Check 25 reports adversarial review and gatekeep log status

### 5. Stack-Adaptive Pipeline Guards

- [ ] Pipeline gates 12/13 use StackProfile + package.json scripts
- [ ] Non-TypeScript stacks get diagnostic messages, not errors
- [ ] JS projects: typecheck gate is non-blocking
- [ ] Go/Rust projects: compiler handles type checking natively

### 6. Git Hooks Opt-In

- [ ] `templates/hooks/pre-commit` exists and is versioned
- [ ] `templates/hooks/pre-push` exists and is versioned
- [ ] `devflow install` offers hook installation (opt-in)
- [ ] Hooks block commits to main/master
- [ ] Hooks warn when DEVFLOW.md says CANNOT CODE
- [ ] `hooksEnabled: true` is set in config when hooks are installed

### 7. Actor Field in Log Example

- [ ] Generated implementation prompt JSON example includes `"actor"` field
- [ ] Example: `{"timestamp":"...","actor":"...","actionId":"T001",...}`

### 8. Gatekeep Log Validation (strict/release)

- [ ] In strict/release mode: gatekeep validates log entries have required fields
- [ ] Missing timestamp/actor/actionId/status triggers refusal
- [ ] Invalid JSON lines are reported with line numbers
- [ ] Empty log triggers refusal in strict/release
- [ ] In local mode: only warns (no refusal)

### 9. Doctor Self-Diagnosis

- [ ] `devflow doctor` shows 16 checks (was 12)
- [ ] Check 13: detects CI referencing gitignored .devflow/
- [ ] Check 14: detects CLI version ≠ package.json version
- [ ] Check 15: detects CI tools not in devDependencies
- [ ] Check 16: reports .devflow/ gitignore status

### 10. README Maturity Alignment

- [ ] README explicitly states enforcement requires voluntary CLI execution
- [ ] README references "does not" section from intro paragraph
- [ ] PREVIEW section labeled "placeholder stubs, no real execution"
- [ ] README tests (`test/unit/readme-validation.test.ts`) pass

### 11. Adversarial Review Per-Feature

- [ ] `devflow adversarial-review <id>` writes to `.devflow/audits/<id>/adversarial-review.md`
- [ ] feature-complete check 21 checks per-feature path
- [ ] feature-complete check 19 (solo-hardened) checks per-feature path
- [ ] gatekeep solo-hardened check validates per-feature path
- [ ] Old global path `.devflow/audits/adversarial-review.md` no longer used

### 12. Heuristic Semantic Labels

- [ ] DoD check 23 description says "Heuristic semantic quality"
- [ ] Pipeline gate 15 description says "Heuristic semantic quality check"
- [ ] Evidence strings say "Heuristic quality score" not "Semantic quality score"

### 13. End-to-End Tests

- [ ] `test/e2e/flows.test.ts` exists with 4 test cases
- [ ] Greenfield test: init → inspect → create feature → fill artifacts → verify
- [ ] Brownfield test: init with 12+ files → detect → verify cockpit
- [ ] Invalid state tests: missing artifacts → detection works, empty dir → no crash
- [ ] All 4 e2e tests pass in `npm test`

### 14. Deprecated Shim Tests

- [ ] `test/unit/deprecated-imports.test.ts` exists with 17 test cases
- [ ] All deprecated re-export paths resolve correctly
- [ ] Key exports (detectState, ConfigManager, ArtifactManager, etc.) are accessible

### 15. Scaffold + Readiness Checklist

- [ ] `devflow init` copies tool configs to `.devflow/`
- [ ] `docs/readiness-checklist.md` exists (this file)
- [ ] Tool configs included in npm package (`src/kernel/artifacts/tool-configs/`)

## Final Verification

Run these commands on the `fix/align-implementation-to-promise` branch:

```bash
# Core health
npm ci
npm run build
npm run typecheck
npm test
npm run test:coverage

# Version check
node dist/main.js --version    # must print 0.2.1

# Doctor check
node dist/main.js doctor        # must show 16 checks

# E2E tests
npx vitest run test/e2e/        # must pass 4/4

# Deprecated shim tests
npx vitest run test/unit/deprecated-imports.test.ts  # must pass 17/17

# No hardcoded old versions
! grep -rq '"0.1.0"' src/
```

## Risks Not Addressed

These items remain as known limitations:

1. **No sandbox enforcement** — Devflow cannot prevent a user from editing files directly or using `git commit --no-verify`
2. **Heuristic-only semantic checks** — Content quality detection is pattern-based, not AI-powered
3. **No external policy engine** — Constitution rules are advisory; there is no server-side enforcement
4. **PREVIEW commands** — 9 commands remain as stubs with no real logic
5. **EXPERIMENTAL commands** — `discover` and `eval run` have partial implementation
6. **Windows compatibility** — Not tested on Windows; clipboard and file permissions may differ
