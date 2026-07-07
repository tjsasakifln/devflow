# Release Checklist — v0.4.1

## Pre-release Validation (BLOCKING — must pass before publish)

- [ ] `npm ci` — clean install
- [ ] `npm run typecheck` — zero errors
- [ ] `npm test` — all tests pass (158+ tests)
- [ ] `npm run test:coverage` — coverage >= 80%
- [ ] `npm run build` — build succeeds
- [ ] `node dist/main.js --version` — returns 0.4.1
- [ ] `node dist/main.js --help` — audit listed as stable, no preview noise
- [ ] `node dist/main.js --list-tiers` — audit and config in STABLE
- [ ] `node dist/main.js audit --format markdown` — produces valid report
- [ ] `node dist/main.js audit --format html --output /tmp/test.html` — writes HTML file
- [ ] `node dist/main.js audit --format json 2>/dev/null | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` — valid JSON, no banner pollution
- [ ] `node dist/main.js review-pr --format markdown` — produces valid report
- [ ] `node dist/main.js review-pr --risk-tolerance strict --format json 2>/dev/null | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` — accepts flag, valid JSON
- [ ] `grep "no code ever leaves your machine" README.md` — returns nothing (privacy language fixed)
- [ ] `grep "CI runner" README.md` — returns corrected text

## CI / Build

- [ ] CI passes on `main` branch
- [ ] `npm pack` succeeds and produces a valid tarball
- [ ] Package installs correctly: `npm install -g ./devflow-0.4.1.tgz`
- [ ] `devflow --version` returns 0.4.1

## Documentation

- [ ] README.md privacy language is precise (no absolute claims)
- [ ] action.yml uses `--risk-tolerance` correctly (flag exists on review-pr)
- [ ] action.yml fail-on logic uses JSON extraction (not grep)
- [ ] CLAUDE.md is current
- [ ] CHANGELOG.md updated for v0.4.1

## Smoke Tests

- [ ] `devflow audit` catches eval() in modified file
- [ ] `devflow audit --staged` audits only staged changes
- [ ] `devflow audit --working-tree` audits only unstaged changes
- [ ] `devflow review-pr --format html` generates standalone report
- [ ] `devflow review-pr --format json` produces machine-readable output
- [ ] `devflow review-pr --risk-tolerance strict` applies tolerance
- [ ] Stack adapters: changed TS files detected and adapter active
- [ ] Excluded files (dist/, node_modules/) not in changedFiles

## Post-release

- [ ] Tag created: `git tag v0.4.1 && git push origin v0.4.1`
- [ ] npm publish: `npm publish`
- [ ] GitHub release created with changelog notes
