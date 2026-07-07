# Release Checklist -- v0.4.0

## Pre-release

- [ ] All tests pass: `npm test`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] No stale version references: `grep -r "0.3.0" src/` returns nothing
- [ ] README commands match actual CLI: `node dist/main.js --help`
- [ ] All STABLE commands have test coverage
- [ ] All EXPERIMENTAL commands declare limitations
- [ ] All PREVIEW commands hidden behind `--all` flag
- [ ] CHANGELOG.md updated for this version
- [ ] Version bumped in package.json
- [ ] Git hooks tested: pre-commit, pre-push

## CI / Build

- [ ] CI passes on `main` branch
- [ ] `npm pack` succeeds and produces a valid tarball
- [ ] Package installs correctly: `npm install -g ./devflow-0.4.0.tgz`
- [ ] `devflow --version` returns 0.4.0
- [ ] `devflow --help` lists all STABLE commands

## Documentation

- [ ] README.md reflects all STABLE commands and their flags
- [ ] action.yml input/output documentation is accurate
- [ ] CLAUDE.md is current (AI agent instructions)
- [ ] ARCHITECTURE.md is current
- [ ] CONTRIBUTING.md setup instructions are accurate
- [ ] CHANGELOG.md entry is complete and accurate

## Smoke Tests

- [ ] `devflow audit` runs on this repository (no feature setup)
- [ ] `devflow audit --format html --output report.html` generates valid HTML
- [ ] `devflow audit --format json` produces valid JSON
- [ ] `devflow review-pr --format markdown --output report.md` succeeds
- [ ] `devflow review-pr --format html` generates standalone report
- [ ] `devflow review-pr --json` produces machine-readable output
- [ ] `devflow init --yes` scaffolds a new project correctly
- [ ] `devflow status` reports correct state
- [ ] `devflow feature new test-feature --non-interactive` creates workspace
- [ ] `devflow feature complete test-feature` runs 25 checks

## Post-release

- [ ] Tag created: `git tag v0.4.0 && git push origin v0.4.0`
- [ ] npm publish: `npm publish --access public`
- [ ] GitHub release created with changelog notes
- [ ] Release announcement in discussions
