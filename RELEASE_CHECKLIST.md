# Release Checklist — v1.0.0

## Intended Validation (run before publishing)

### BLOCKING — must pass
- [ ] `npm ci` — clean install
- [ ] `npm run typecheck` — zero errors
- [ ] `npm test` — all 813 tests pass
- [ ] `npm run test:coverage` — coverage >= 80%
- [ ] `npm run build` — build succeeds
- [ ] `node dist/main.js --version` — returns 1.0.0

### Audit Command
- [ ] `node dist/main.js audit --format markdown` — valid report, includes scope description
- [ ] `node dist/main.js audit --format html --output /tmp/audit.html` — writes valid HTML
- [ ] `node dist/main.js audit --format json 2>/dev/null | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` — pipe-safe JSON
- [ ] `node dist/main.js audit --staged` — audits staged only
- [ ] `node dist/main.js audit --working-tree` — audits working tree only

### Review-PR Command
- [ ] `node dist/main.js review-pr --format markdown` — valid report
- [ ] `node dist/main.js review-pr --risk-tolerance strict --format json 2>/dev/null | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` — accepts flag, pipe-safe
- [ ] `node dist/main.js review-pr --format html --output /tmp/pr.html` — writes valid HTML

### Feature Commands
- [ ] `node dist/main.js feature new test-release --actor test --non-interactive` — creates workspace
- [ ] `node dist/main.js feature prompt test-release --copy` — generates implementation prompt
- [ ] `node dist/main.js feature complete test-release` — runs 25 DoD checks
- [ ] `node dist/main.js gatekeep test-release --approve --actor reviewer` — independent approval
- [ ] `node dist/main.js adversarial-review test-release` — 12 attack vectors

### Stable Commands (ex-PREVIEW)
- [ ] `node dist/main.js analyze --help` — shows usage
- [ ] `node dist/main.js trace --help` — shows usage
- [ ] `node dist/main.js promote --help` — shows usage
- [ ] `node dist/main.js drift-check --help` — shows usage
- [ ] `node dist/main.js design-review --help` — shows usage
- [ ] `node dist/main.js tests-review --help` — shows usage
- [ ] `node dist/main.js requirements-audit --help` — shows usage
- [ ] `node dist/main.js ai-init --help` — shows usage
- [ ] `node dist/main.js actions-generate --help` — shows usage

### Doctor
- [ ] `node dist/main.js doctor` — shows all checks, no false positives

### Meta
- [ ] `node dist/main.js --help` — all commands listed without PREVIEW prefix
- [ ] `grep "sending code to the cloud" README.md` — returns nothing
- [ ] `grep "no code ever leaves" README.md` — returns nothing
- [ ] `ls docs/local-first.md` — exists (linked from README)

### CI
- [ ] GitHub Actions CI passes on main branch
- [ ] workflow covers: npm ci, typecheck, test, test:coverage, build, version check

### Documentation
- [ ] CHANGELOG.md updated for this version
- [ ] ARCHITECTURE.md reflects current layer structure
- [ ] README.md privacy language is precise
- [ ] action.yml inputs match CLI (no decorative inputs)
- [ ] action.yml outputs are complete (verdict, json-report-path, human-report-path, all severity counts)

---

## Validation Performed

| Date | Commit | Typecheck | Tests | Build | Audit JSON | Review-pr | CI | Notes |
|------|--------|-----------|-------|-------|------------|-----------|----|-------|
| YYYY-MM-DD | abc1234 | ✅ 0 errors | ✅ NNN passed | ✅ OK | ✅ pipe-safe | ✅ flag OK | ✅ green | |

### CI Status Verification
- Check: https://github.com/tjsasakifln/devflow/actions
- Workflow: "CI -- Devflow Harness"
- Trigger: push to main, PR to main
- If CI is not running: verify Actions are enabled in repository Settings > Actions > General > Allow all actions
