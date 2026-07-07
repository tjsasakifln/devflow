# Devflow vs Linters (ESLint, Ruff, golangci-lint) — Governance vs Static Analysis

> Devflow is a local-first AI coding governance CLI. Linters are static analysis tools that check source code for syntax errors, style violations, and common bug patterns. They operate at fundamentally different levels: linters answer "is this code well-formed?"; Devflow answers "should this code be trusted?"

## Positioning

Linters — ESLint for JavaScript/TypeScript, Ruff for Python, golangci-lint for Go, Biome for multi-language, and dozens of others — are essential tools in every developer's workflow. They parse source files and flag patterns associated with bugs, style violations, or security vulnerabilities. They are **text-level analyzers**: they understand syntax and abstract syntax trees but have no awareness of engineering process, requirements, test plans, or review history.

Devflow is a **governance-level analyzer**. It does not parse your source code. It does not check for semicolons, indentation, or unused variables. Instead, it examines your **engineering artifacts** — the documents and records that describe what the code is supposed to do, how it was tested, and who approved it. It answers questions that no linter can address:

- Is there a requirements document that defines what this feature should do?
- Does the implementation log match the actual changes in the working tree?
- Was an adversarial review performed against 12 attack vectors?
- Was a gate approval recorded by a different actor than the implementer?
- Has the feature progressed through the required workflow states?

A linter can tell you that a variable violates camelCase convention. Devflow can tell you that the AI agent that generated this code was authorized to write it, that its output was adversarially tested for architectural drift and hallucinated dependencies, and that a human independently reviewed and approved the change before it reached the PR stage.

These are fundamentally different guarantees. A green linter means the code is syntactically consistent. A green Devflow audit means the code was produced through a governed, auditable engineering process. You need both: linters for code quality, Devflow for engineering integrity.

## Comparison

| Dimension | Devflow | Linters (ESLint, Ruff, golangci-lint, Biome) |
|---|---|---|
| **What it checks** | Governance: requirements, test evidence, adversarial review, gate approval, spec compliance, implementation log integrity | Code: syntax, formatting, style conventions, common bug patterns, anti-patterns, security lint rules |
| **When it runs** | Pre-commit, pre-push, pre-PR (governance gates in the development workflow) | Pre-commit, pre-push, in-editor, CI (wherever configured) |
| **Output format** | Markdown/HTML risk reports, JSON audit logs, structured evidence records | Terminal output, SARIF, inline IDE diagnostics, GitHub annotations |
| **Requires configuration** | Minimal defaults out of the box; `devflow config` for custom rules, risk tolerance | Required — ruleset must be defined per project (`.eslintrc`, `pyproject.toml`, `.golangci.yml`) |
| **Multi-language** | TypeScript, JavaScript, Python, Go, Rust, PHP, Java (single CLI for all) | Language-specific — one CLI per language; no unified governance across stacks |
| **CI integration** | GitHub Action + CLI for governance gates | GitHub Action per linter, pre-commit hooks, IDE plugins |
| **Evidence trail** | Full audit log with content hashes (SHA-256), actor identity, timestamps, git context | No — only pass/fail with line numbers in CI logs |
| **Enforces workflow** | Yes — feature pipeline with 15 states, blocking transitions, mandatory gates | No |
| **Adversarial review** | Yes — 12 attack vectors: bypass attempts, hallucination detection, prompt injection simulation, architecture boundary violations, dependency drift | No |
| **Constitution enforcement** | Yes — C1–C12: implementer != approver, CI mandates, evidence requirements | No |
| **Risk tolerance levels** | relaxed (advisory gates), moderate (standard blocking), strict (all blocking + CI mandatory) | Single mode — all rules are equally enforced or equally advisory |
| **Prevents premature coding** | Yes — blocks code before `feature-coding-ready` state | No |
| **PR risk report** | Yes — standalone report with governance context | No — lint results are a section in CI output |
| **Code leaves machine** | Never | Never |
| **Pricing** | Free, open-source (MIT) | Free, open-source |
| **Setup time** | ~30 seconds | Minutes to hours (config + custom rules + team alignment) |
| **False positives** | Low — checks for existence of artifacts, not content quality | Variable — depends on ruleset strictness; some rules produce noise |
| **Can block PRs** | Yes — governance gates can reject based on missing engineering evidence | Yes — lint errors can block CI checks |
| **Scope** | Engineering process and governance artifacts | Source code text only |

## When to Use Each

### Use Devflow When

- You need to verify that AI-generated code has **engineering justification** — not just correct syntax.
- You want a PR risk report that documents what governance checks were performed, which passed and failed, and who approved each stage.
- You need to enforce a development workflow where AI agents cannot skip steps: requirements first, then design, then test plan, then implementation, then adversarial review, then gate approval.
- You want adversarial review that tests AI-generated changes for bypass, hallucination, and architecture drift — risks that linters cannot detect.
- You need auditable governance records for compliance, regulatory requirements, or team accountability.
- Your project uses multiple programming languages and you want a single governance tool that covers all stacks consistently.
- You want to enforce that implementers and approvers are different people (Constitution C12).

### Use Linters When

- You want to catch syntax errors and formatting inconsistencies in every commit.
- You want automated style enforcement so the codebase stays consistent without manual reviews.
- You need in-editor feedback during development — squiggly lines for mistakes as you type.
- You are enforcing language-specific best practices (e.g., no `any` in TypeScript, no `eval` in JavaScript).
- You want security linting to catch known vulnerability patterns in dependencies or code.
- You want CI gates that block code with obvious errors before human review.

### Use Both for Complete Quality and Governance Coverage

Devflow and linters address different layers of the software quality stack:

- **Linters** handle the **code quality layer**: syntax, style, formatting, static bugs, and security patterns. They ensure the code is well-formed and follows conventions.
- **Devflow** handles the **engineering quality layer**: evidence, requirements, test planning, adversarial review, gate approval, and constitution compliance. They ensure the change was produced responsibly.
- **CI** handles the **execution quality layer**: tests passing, build succeeding, coverage meeting thresholds.

All three layers are independent and complementary. A change can pass linting, fail tests, and have no governance evidence. Or it can have full governance evidence, pass all tests, and still have style issues that a linter catches.

## Quick Test

```bash
# Linter check — example with ESLint
npx eslint src/

# Linter check — example with Ruff (Python)
ruff check src/

# Devflow governance audit — no configuration needed
devflow audit

# Devflow with strict mode — all gates blocking
devflow audit --risk-tolerance strict

# Devflow PR risk report — standalone governance document
devflow review-pr --format markdown

# Devflow doctor — 16-point health check for your setup
devflow doctor

# Compare outputs:
# Linters produce line-level warnings about code patterns
# Devflow produces a governance report about engineering process
```

The practical difference: `npx eslint src/` might flag an unused import. `devflow audit` might flag that the entire change has no requirements document, no test plan, no adversarial review, and no gate approval — and therefore should not be merged, regardless of style.

## Limitations

- Devflow does not check code syntax, style, or formatting. It will not catch unused variables, missing semicolons, or insecure code patterns.
- Linters do not check engineering process. They will not tell you that requirements are missing, that the implementer approved their own change, or that adversarial review was skipped.
- Devflow's evidence checks verify that artifacts exist, not that they are correct or complete. A requirements file with placeholder content passes the check.
- Linters produce high-confidence results for rule violations but may produce noise from overly strict rulesets.

## Next Steps

- Read the main [README](../../README.md) for the full command reference.
- Run `devflow install` to initialize governance in your project.
- Configure risk tolerance: `devflow config set riskTolerance moderate` for team use.
- Integrate both Devflow and linters into your pre-commit hooks for layered quality control.
- Explore the [integrations](../integrations/) directory for setup guides.
