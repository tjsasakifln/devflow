# Devflow vs CI/CD Pipeline — Pre-PR Governance vs Post-Push Verification

> Devflow is a local-first AI coding governance CLI. CI/CD pipelines verify that code builds, tests pass, and deployments succeed after a push. Devflow audits AI-generated changes before the push — checking for evidence, governance compliance, and engineering soundness. CI says "the build passed." Devflow says "this change has traceable justification."

## Positioning

Continuous Integration and Continuous Delivery (CI/CD) pipelines are the backbone of modern software delivery. They run automated tests, build artifacts, scan for vulnerabilities, check code coverage, and deploy to environments. They are triggered by a push to a remote repository and provide fast feedback on whether the code is functional. CI/CD pipelines are essential and every team should have them.

But CI/CD pipelines have a fundamental blind spot: they verify that the code **works**, not that the code was **produced responsibly**. A green CI pipeline tells you that tests pass, the build compiles, and coverage meets the threshold. It does not tell you whether the change has requirements, whether a test plan was written before the code, whether adversarial review was performed, whether an independent gate approval exists, or whether the implementation log matches the actual changes.

Devflow fills that gap. It runs **before CI** — on the developer's machine, before the push. It examines the engineering artifacts around the code change and determines whether the change meets governance standards. It checks for:

- **Requirements**: Does a requirements document exist for this feature?
- **Test plan**: Was a test plan written and reviewed before implementation?
- **Adversarial review**: Was the change tested against 12 attack vectors?
- **Gate approval**: Did a different actor than the implementer approve the change?
- **Implementation log**: Does the log of actions match the actual changes in the working tree?
- **State progression**: Has the feature progressed through all required workflow states?

CI tells you "the build is green." Devflow tells you "the change is governed." You need both. A CI pipeline that passes without governance evidence tells you nothing about whether the AI-generated code was properly planned, reviewed, and approved. A Devflow audit without CI tells you nothing about whether the code actually builds and passes tests.

## Comparison

| Dimension | Devflow | CI/CD Pipeline |
|---|---|---|
| **When it runs** | Pre-commit, pre-push, pre-PR — on the developer's machine | Post-push — on a CI runner (GitHub Actions, Jenkins, GitLab CI, CircleCI) |
| **What it verifies** | Governance: requirements, test evidence, adversarial review, gate approval, spec compliance, constitution rules, implementation log integrity | Build: tests pass, build succeeds, lint passes, coverage meets threshold, security scan, deployment |
| **Can block a commit or push** | Yes — pre-commit hooks can block commits; pre-push gates can block pushes | No — runs after push; can block PR merge via branch protection |
| **Evidence trail** | Full audit log with content hashes (SHA-256), actor identity, timestamps, git context, decision rationale | Build logs, test reports, coverage reports — no structured evidence trail |
| **Requires git push** | No — runs on local working tree and staged changes | Yes — triggered by push to remote |
| **Prevents premature coding** | Yes — blocks AI agents from coding before `feature-coding-ready` state | No — CI only sees code after it is pushed |
| **Adversarial review** | Yes — 12 attack vectors: bypass, hallucination, architecture drift, dependency spoofing, prompt injection simulation | No — CI may have security scanning but no adversarial review |
| **Enforces workflow** | Yes — feature pipeline with 15 progression states, blocking transitions, mandatory gates | No — CI verifies build quality, not development process |
| **PR risk report** | Yes — `devflow review-pr` generates standalone markdown or HTML report | No — CI provides status checks but no governance report |
| **Risk tolerance levels** | relaxed, moderate, strict — gates change behavior by mode | Single mode — all CI checks are blocking or all are advisory |
| **Constitution enforcement** | Yes — C1–C12 rules including implementer != approver, CI requirements, evidence mandates | No |
| **Code leaves machine** | Never | Yes — code is uploaded to CI runner (self-hosted or cloud) |
| **Internet required** | No — fully local | Yes — CI runner connects to git host, package registries, artifact stores |
| **Setup time** | ~30 seconds | Minutes to hours (pipeline configuration, environment setup) |
| **Output audience** | Developer (pre-push) and reviewer (PR report) | Developer and team (build status, test results) |
| **Granularity** | Feature-level governance (per feature workspace) | Commit-level and PR-level build quality |
| **Failure mode localization** | Identifies which governance artifacts are missing and which workflow steps were skipped | Identifies which test failed or which build step broke |
| **Recovery cost** | Low — catch governance gaps before push, fix locally | Medium — push, wait for CI, fix, push again |

## When to Use Each

### Use Devflow When

- You want to catch governance gaps **before** code is pushed — not after.
- You need to block AI-generated changes that lack requirements, test plans, adversarial reviews, or independent approvals.
- You work offline or in air-gapped environments where you cannot rely on cloud CI infrastructure.
- You need a PR risk report you can attach to every pull request before requesting human review.
- You want to enforce that AI agents cannot write code before requirements and test plans exist.
- You need an auditable evidence trail for compliance, regulatory requirements, or team accountability.
- You want to separate the governance check from the build check — governance failures should block before CI resources are consumed.

### Use CI/CD When

- You need automated builds, tests, and deployments on every push.
- You want to enforce code quality gates: test coverage thresholds, lint pass/fail, type checking.
- You need deployment pipelines that promote code through staging and production environments.
- Your team uses branch protection rules that require green CI status before merge.
- You need artifact publishing, container image builds, or infrastructure provisioning as part of your workflow.

### Use Both for Complete Coverage

Devflow and CI/CD are not alternatives — they are sequential stages in a complete quality and governance pipeline:

1. **Local Development**: Developer writes code with AI assistance. Devflow runs pre-commit to verify governance artifacts exist.
2. **Pre-Push Governance (Devflow)**: Before pushing, developer runs `devflow audit`, `devflow adversarial-review`, and `devflow gatekeep`. These checks ensure the change has evidence before it reaches CI.
3. **Post-Push CI**: After push, CI runs tests, builds, linting, coverage, and security scans. These checks ensure the code is functional.
4. **Pre-Merge Governance (Devflow in CI)**: Devflow's GitHub Action runs in CI as an additional governance gate before merge, ensuring that even in CI, governance evidence is verified.
5. **Merge**: Branch protection rules require both green CI status and green Devflow governance status.

This layered approach catches:

- **Pre-CI failures**: Missing requirements, no test plan, missing adversarial review, self-approval — caught by Devflow before the push, saving CI runner time and cost.
- **CI failures**: Test failures, build errors, coverage drops, security vulnerabilities — caught by CI after the push.
- **Post-push governance failures**: CI governance check re-verifies evidence for the final diff, catching anything that changed between pre-push audit and actual push.

## Quick Test

```bash
# Devflow pre-commit audit — checks staged changes for governance compliance
devflow audit --staged

# Devflow full audit — checks working tree
devflow audit

# Devflow PR risk report — generate before pushing
devflow review-pr --format markdown --output pre-pr-report.md

# Devflow doctor — verify governance health
devflow doctor

# Compare with CI — after push, check pipeline results:
git push origin my-branch
# Then check your CI dashboard for: test results, build status, coverage

# Devflow in CI — add to your GitHub Actions workflow:
# See action.yml for configuration
```

The key difference you will notice in practice: Devflow gives you feedback in under a second (local execution) before you push. CI gives you feedback in minutes (queue + execution) after you push. Devflow saves you from pushing code that will fail governance checks, and CI saves you from merging code that breaks tests.

## Limitations

- Devflow does not run tests, build artifacts, or deploy code. It does not verify functional correctness.
- CI/CD pipelines do not check for governance evidence. A passing CI build does not mean the change was planned, reviewed, or approved.
- Devflow's pre-push governance is voluntary — a developer can skip Devflow and push directly. CI-based Devflow gates catch this but run after the push.
- CI pipelines consume runner time and energy for every push, including pushes that fail governance checks. Devflow reduces this waste by catching failures pre-push.

## Next Steps

- Read the main [README](../../README.md) for the full command reference and architecture.
- Set up Devflow in CI using the [GitHub Action](../../action.yml) for pre-merge governance.
- Run `devflow doctor` to verify your setup is healthy across 16 dimensions.
- Configure risk tolerance: `devflow config set riskTolerance moderate` for standard team use.
- Install pre-commit hooks via `devflow init` to enforce governance before every commit.
